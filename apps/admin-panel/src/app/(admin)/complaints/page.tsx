"use client";
import { useEffect, useState } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { statusBadge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import type { Complain } from "@/types";

const TABS: ("USER" | "DOCTOR")[] = ["USER", "DOCTOR"];

export default function ComplaintsPage() {
  const [complaints, setComplaints] = useState<Complain[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"USER" | "DOCTOR">("USER");

  const load = () => {
    apiClient
      .get("/admin/complains", { params: { role: tab } })
      .then((r: unknown) =>
        setComplaints((r as { data: Complain[] }).data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const handleResolve = async (id: string) => {
    await apiClient.patch(`/admin/complains/${id}`, { status: "SOLVED" });
    toast.success("Complaint marked as resolved");
    load();
  };

  const cols: Column<Complain>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "from",
      header: "From",
      render: (r) => {
        const person = tab === "USER" ? r.user : r.doctor;
        return (
          <div className="flex items-center gap-2">
            <Avatar src={person?.image} name={person?.name} size={32} />
            <span className="font-medium">{person?.name ?? "—"}</span>
          </div>
        );
      },
    },
    {
      key: "message",
      header: "Complaint",
      render: (r) => (
        <p
          className="text-sm text-gray-600 max-w-sm truncate"
          title={r.message}
        >
          {r.message}
        </p>
      ),
    },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
    {
      key: "createdAt",
      header: "Date",
      render: (r) => (
        <span className="text-gray-400 text-sm">
          {format(new Date(r.createdAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "PENDING" ? (
          <button
            onClick={() => handleResolve(r.id)}
            className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium"
          >
            Mark Resolved
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="page-title">Complaints</h1>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            {t === "USER" ? "👤 Patients" : "👨‍⚕️ Doctors"}
          </button>
        ))}
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={complaints}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No complaints"
        />
      </div>
    </div>
  );
}
