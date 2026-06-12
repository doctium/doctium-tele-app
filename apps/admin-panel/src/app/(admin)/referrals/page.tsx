"use client";
import { useCallback, useEffect, useState } from "react";
import { GitBranch, TrendingUp, AlertTriangle } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { PatientLink } from "@/components/ui/PatientLink";
import { apiClient } from "@/lib/api";
import { format } from "date-fns";

type Status =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "BOOKED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

interface Referral {
  id: string;
  status: Status;
  urgency: "ROUTINE" | "URGENT";
  specialty?: string;
  reason?: string;
  createdAt: string;
  userId?: string;
  referringDoctor?: { name: string; image?: string; designation?: string };
  specialist?: { name: string; image?: string; designation?: string };
  user?: { name: string; image?: string };
}

interface Funnel {
  total: number;
  PENDING?: number;
  ACCEPTED?: number;
  BOOKED?: number;
  COMPLETED?: number;
  DECLINED?: number;
  conversionRate: number;
}

const STATUS_VARIANT: Record<
  Status,
  "warning" | "success" | "danger" | "info" | "default"
> = {
  PENDING: "warning",
  ACCEPTED: "info",
  DECLINED: "danger",
  BOOKED: "success",
  COMPLETED: "success",
  CANCELLED: "default",
  EXPIRED: "default",
};
const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const TABS: { key: string; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "BOOKED", label: "Booked" },
  { key: "COMPLETED", label: "Completed" },
  { key: "DECLINED", label: "Declined" },
];

export default function ReferralsPage() {
  const [rows, setRows] = useState<Referral[]>([]);
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .get("/admin/referrals", {
        params: {
          status: tab === "ALL" ? undefined : tab,
          page,
          limit: PAGE_SIZE,
        },
      })
      .then((r: unknown) =>
        setRows((r as { data: { items: Referral[] } }).data.items ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    apiClient
      .get("/admin/referrals/funnel")
      .then((r: unknown) => setFunnel((r as { data: Funnel }).data))
      .catch(() => {});
  }, []);

  const cols: Column<Referral>[] = [
    {
      key: "patient",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.user?.image} name={r.user?.name} size={32} />
          <PatientLink
            id={r.userId}
            name={r.user?.name}
            className="font-semibold text-ink"
          />
        </div>
      ),
    },
    {
      key: "route",
      header: "Referral",
      render: (r) => (
        <div className="flex items-center gap-2 text-caption">
          <span className="text-gray-600">
            Dr. {r.referringDoctor?.name ?? "—"}
          </span>
          <GitBranch size={13} className="text-gray-300 rotate-90" />
          <span className="text-ink font-medium">
            Dr. {r.specialist?.name ?? "—"}
          </span>
          {r.specialty ? (
            <span className="text-gray-400">· {r.specialty}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "urgency",
      header: "",
      width: "90px",
      render: (r) =>
        r.urgency === "URGENT" ? (
          <span className="inline-flex items-center gap-1 text-micro font-bold text-alert-600">
            <AlertTriangle size={11} /> Urgent
          </span>
        ) : (
          <span className="text-gray-300 text-caption">Routine</span>
        ),
    },
    {
      key: "date",
      header: "Sent",
      render: (r) => (
        <span className="text-gray-500 tabular-nums">
          {format(new Date(r.createdAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge
          label={STATUS_LABEL[r.status]}
          variant={STATUS_VARIANT[r.status]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Clinical Records</p>
        <h1 className="page-title mt-0.5">Referrals</h1>
        <p className="text-body-md text-gray-500 mt-1">
          Doctor-to-specialist referral funnel — keeps patients in-network and
          tracks conversion.
        </p>
      </div>

      {funnel ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
          {[
            ["Sent", funnel.total],
            ["Pending", funnel.PENDING ?? 0],
            ["Booked", (funnel.BOOKED ?? 0) + (funnel.COMPLETED ?? 0)],
            ["Completed", funnel.COMPLETED ?? 0],
          ].map(([label, val]) => (
            <div key={label} className="card p-4">
              <p className="text-h2 font-extrabold text-ink tabular-nums">
                {val}
              </p>
              <p className="text-caption text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
          <div className="card p-4 bg-gradient-to-br from-teal-500/10 to-transparent">
            <p className="text-h2 font-extrabold text-teal-600 tabular-nums flex items-center gap-1">
              <TrendingUp size={18} /> {funnel.conversionRate}%
            </p>
            <p className="text-caption text-gray-400 mt-0.5">Conversion</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={
              "px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors " +
              (tab === t.key
                ? "bg-navy text-white"
                : "bg-surfaceAlt text-gray-500 hover:text-ink")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No referrals here yet"
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
