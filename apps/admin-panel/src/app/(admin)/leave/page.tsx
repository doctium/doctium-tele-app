"use client";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { RequirePermission } from "@/components/RequirePermission";
import { useAdminAuth } from "@/lib/auth-context";
import type { LeaveRequest } from "@/types";
import { format } from "date-fns";

const TABS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;
const VARIANT: Record<
  string,
  "info" | "success" | "danger" | "warning" | "default"
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "default",
};

export default function LeavePage() {
  const { can } = useAdminAuth();
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("PENDING");
  const [acting, setActing] = useState(false);

  const load = () => {
    setLoading(true);
    apiClient
      .get("/admin/hr/leave", {
        params: { status: tab === "ALL" ? undefined : tab },
      })
      .then((r: unknown) => setRows((r as { data: LeaveRequest[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (id: string, status: "APPROVED" | "REJECTED") => {
    setActing(true);
    try {
      await apiClient.patch(`/admin/hr/leave/${id}/decision`, { status });
      toast.success(`Leave ${status.toLowerCase()}`);
      load();
    } catch {
    } finally {
      setActing(false);
    }
  };

  const cols: Column<LeaveRequest>[] = [
    {
      key: "emp",
      header: "Employee",
      render: (r) => (
        <div className="leading-tight">
          <p className="text-ink font-medium">{r.employee?.name ?? "—"}</p>
          <p className="text-caption text-gray-400">
            Balance: {r.employee?.leaveBalance ?? 0} days
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => <Badge label={r.type} variant="default" />,
    },
    {
      key: "dates",
      header: "Dates",
      render: (r) => (
        <span className="text-sm text-gray-600 tabular-nums">
          {format(new Date(r.startDate), "dd MMM")} –{" "}
          {format(new Date(r.endDate), "dd MMM")} ({r.days}d)
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (r) => (
        <span className="text-sm text-gray-500">{r.reason || "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge label={r.status} variant={VARIANT[r.status] ?? "default"} />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        r.status === "PENDING" && can("hr.manage") ? (
          <div className="flex gap-2">
            <button
              onClick={() => decide(r.id, "APPROVED")}
              disabled={acting}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-success-50 text-success-600 hover:bg-success-100 flex items-center gap-1"
            >
              <Check size={13} /> Approve
            </button>
            <button
              onClick={() => decide(r.id, "REJECTED")}
              disabled={acting}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-alert-50 text-alert-600 hover:bg-alert-100 flex items-center gap-1"
            >
              <X size={13} /> Reject
            </button>
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
  ];

  return (
    <RequirePermission perm="hr.view">
      <div className="space-y-5">
        <div>
          <p className="eyebrow">Human Resources</p>
          <h1 className="page-title mt-0.5">Leave Management</h1>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="card p-0 overflow-hidden">
          <DataTable
            columns={cols}
            data={rows}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyMessage="No leave requests"
          />
        </div>
      </div>
    </RequirePermission>
  );
}
