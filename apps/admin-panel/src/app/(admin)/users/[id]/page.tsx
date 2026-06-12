"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, statusBadge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatMoney } from "@/lib/money";
import { format } from "date-fns";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  mobile: string;
  image?: string;
  gender: string;
  dob: string;
  country: string;
  isBlock: boolean;
  createdAt: string;
  wallet?: {
    balance: number;
    history: {
      id: string;
      amount: number;
      type: string;
      description: string;
      createdAt: string;
    }[];
  };
  subPatients?: { id: string; name: string; relation: string; age?: number }[];
}

interface Appointment {
  id: string;
  date: string;
  time: string;
  status: string;
  amount: number;
  doctor?: { name: string };
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tab, setTab] = useState<"wallet" | "appointments" | "family">(
    "wallet",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get(`/admin/users/${id}`) as Promise<{ data: UserDetail }>,
      apiClient.get(`/admin/users/${id}/appointments`) as Promise<{
        data: Appointment[];
      }>,
    ])
      .then(([u, a]) => {
        setUser(u.data);
        setAppointments(a.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const setBlocked = async (blocked: boolean) => {
    setUser((u) => (u ? { ...u, isBlock: blocked } : u));
    try {
      await apiClient.patch(`/admin/users/${id}/block`, { isBlock: blocked });
      toast.success(
        blocked
          ? "Customer blocked — they have been notified"
          : "Customer unblocked",
      );
    } catch {
      setUser((u) => (u ? { ...u, isBlock: !blocked } : u));
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading...
      </div>
    );
  if (!user)
    return (
      <div className="text-center py-20 text-gray-400">User not found</div>
    );

  const walletCols: Column<{
    id: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
  }>[] = [
    { key: "description", header: "Description" },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <Badge
          label={r.type}
          variant={r.type === "DEPOSIT" ? "success" : "danger"}
        />
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (r) => (
        <span
          className={
            r.type === "DEPOSIT"
              ? "text-green-600 font-semibold"
              : "text-red-600 font-semibold"
          }
        >
          {r.type === "DEPOSIT" ? "+" : "-"}
          {formatMoney(r.amount)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (r) => (
        <span className="text-gray-500 text-sm">
          {format(new Date(r.createdAt), "dd MMM yyyy, HH:mm")}
        </span>
      ),
    },
  ];

  const apptCols: Column<Appointment>[] = [
    { key: "doctor", header: "Doctor", render: (r) => r.doctor?.name ?? "—" },
    { key: "date", header: "Date", render: (r) => `${r.date} ${r.time}` },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
    {
      key: "amount",
      header: "Amount",
      render: (r) => formatMoney(r.amount),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm"
        >
          <ArrowLeft size={16} /> Back to Customers
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold ${user.isBlock ? "text-alert" : "text-success-600"}`}
          >
            {user.isBlock ? "Blocked" : "Active"}
          </span>
          <Toggle
            checked={!user.isBlock}
            onChange={(active) => setBlocked(!active)}
          />
        </div>
      </div>

      {/* Profile card */}
      <div className="card flex flex-col sm:flex-row gap-6 items-start">
        <Avatar src={user.image} name={user.name} size={80} />
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            ["Name", user.name],
            ["Email", user.email || "—"],
            ["Mobile", user.mobile],
            ["Gender", user.gender || "—"],
            ["DOB", user.dob || "—"],
            ["Country", user.country || "—"],
            ["Joined", format(new Date(user.createdAt), "dd MMM yyyy")],
            ["Wallet", formatMoney(user.wallet?.balance ?? 0)],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">
                {l}
              </p>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["wallet", "appointments", "family"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "family" ? "Family" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {tab === "wallet" && (
          <DataTable
            columns={walletCols}
            data={user.wallet?.history ?? []}
            keyExtractor={(r) => r.id}
            emptyMessage="No wallet transactions"
          />
        )}
        {tab === "appointments" && (
          <DataTable
            columns={apptCols}
            data={appointments}
            keyExtractor={(r) => r.id}
            emptyMessage="No appointments"
          />
        )}
        {tab === "family" && (
          <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            {(user.subPatients ?? []).map((p) => (
              <div key={p.id} className="border border-border rounded-xl p-4">
                <p className="font-semibold text-gray-900">{p.name}</p>
                <p className="text-sm text-gray-500">
                  {p.relation}
                  {p.age ? ` · ${p.age} yrs` : ""}
                </p>
              </div>
            ))}
            {!user.subPatients?.length && (
              <p className="col-span-3 text-center text-gray-400 py-8">
                No family members added
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
