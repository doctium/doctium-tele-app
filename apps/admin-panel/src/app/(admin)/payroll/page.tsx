"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Play } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { StatsCard } from "@/components/ui/StatsCard";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { RequirePermission } from "@/components/RequirePermission";
import { formatMoney } from "@/lib/money";
import type { Employee } from "@/types";

export default function PayrollPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [run, setRun] = useState({
    periodLabel: "",
    periodStart: "",
    periodEnd: "",
  });
  const [running, setRunning] = useState(false);

  const load = () => {
    apiClient
      .get("/admin/hr/employees", { params: { limit: 200 } })
      .then((r: unknown) =>
        setRows((r as { data: { items: Employee[] } }).data?.items ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const active = rows.filter((r) => r.status !== "TERMINATED");
  const monthly = active.reduce((s, r) => s + (r.salary ?? 0), 0);
  const ngn = (n: number) => formatMoney(n);

  const doRun = async () => {
    if (!run.periodLabel || !run.periodStart || !run.periodEnd) {
      toast.error("Fill in the period");
      return;
    }
    setRunning(true);
    let made = 0;
    try {
      for (const e of active) {
        try {
          await apiClient.post(`/admin/hr/employees/${e.id}/payslips`, run);
          made++;
        } catch {}
      }
      toast.success(
        `Generated ${made} draft payslip${made === 1 ? "" : "s"} for ${run.periodLabel}`,
      );
      setShow(false);
      setRun({ periodLabel: "", periodStart: "", periodEnd: "" });
    } finally {
      setRunning(false);
    }
  };

  const cols: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      render: (r) => (
        <div className="leading-tight">
          <p className="font-semibold text-ink">{r.name}</p>
          <p className="text-caption text-gray-400">
            {r.position || r.department?.name || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span className="text-sm text-gray-500 capitalize">
          {(r.employmentType ?? "").toLowerCase().replace("_", " ")}
        </span>
      ),
    },
    {
      key: "cycle",
      header: "Pay cycle",
      render: (r) => (
        <span className="text-sm text-gray-500 capitalize">
          {(r.payCycle ?? "MONTHLY").toLowerCase()}
        </span>
      ),
    },
    {
      key: "salary",
      header: "Salary",
      render: (r) => (
        <span className="font-bold tabular-nums">{ngn(r.salary ?? 0)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          onClick={() => router.push(`/employees/${r.id}`)}
          className="btn-ghost text-xs px-3 py-1.5"
        >
          Payslips
        </button>
      ),
    },
  ];

  return (
    <RequirePermission perm="hr.payroll">
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="eyebrow">Human Resources</p>
            <h1 className="page-title mt-0.5">Payroll</h1>
          </div>
          <button
            onClick={() => setShow(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Play size={15} /> Run payroll
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatsCard
            title="Active staff"
            value={active.length}
            icon={Banknote}
            color="blue"
          />
          <StatsCard
            title="Monthly salary bill"
            value={ngn(monthly)}
            icon={Banknote}
            color="green"
          />
          <StatsCard
            title="Annual run-rate"
            value={ngn(monthly * 12)}
            icon={Banknote}
            color="purple"
          />
        </div>
        <div className="card p-0 overflow-hidden">
          <DataTable
            columns={cols}
            data={rows}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyMessage="No employees yet"
          />
        </div>

        <Modal
          open={show}
          onClose={() => setShow(false)}
          title="Run payroll"
          maxWidth="max-w-md"
        >
          <p className="text-sm text-gray-500 mb-4">
            Generates a draft payslip (from each employee's salary) for every
            active employee. You can review and mark each as paid afterwards.
          </p>
          <div className="space-y-3">
            <div>
              <label className="label">Period label</label>
              <input
                className="input"
                placeholder="e.g. June 2026"
                value={run.periodLabel}
                onChange={(e) =>
                  setRun((r) => ({ ...r, periodLabel: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">From</label>
                <input
                  type="date"
                  className="input"
                  value={run.periodStart}
                  onChange={(e) =>
                    setRun((r) => ({ ...r, periodStart: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">To</label>
                <input
                  type="date"
                  className="input"
                  value={run.periodEnd}
                  onChange={(e) =>
                    setRun((r) => ({ ...r, periodEnd: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShow(false)} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              onClick={doRun}
              disabled={running}
              className="btn-primary flex-1"
            >
              {running ? "Generating…" : `Generate for ${active.length} staff`}
            </button>
          </div>
        </Modal>
      </div>
    </RequirePermission>
  );
}
