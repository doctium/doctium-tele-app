"use client";
import { useEffect, useState } from "react";
import {
  TrendingUp,
  CalendarClock,
  Users,
  AlertTriangle,
  RefreshCw,
  Banknote,
} from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatMoney } from "@/lib/money";
import type { SubscriptionRevenue } from "@/types";

type PlanRow = SubscriptionRevenue["byPlan"][number];

export default function SubscriptionRevenuePage() {
  const [data, setData] = useState<SubscriptionRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    apiClient
      .get("/admin/subscriptions/revenue")
      .then((r: unknown) =>
        setData((r as { data: SubscriptionRevenue }).data ?? null),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const runRenewals = async () => {
    if (
      !confirm(
        "Run the renewal sweep now? This charges any subscriptions due for renewal.",
      )
    )
      return;
    setRunning(true);
    try {
      const r = (await apiClient.post(
        "/admin/subscriptions/run-renewals",
        {},
      )) as { data: { processed: number } };
      toast.success(
        `Renewal sweep complete — ${r.data?.processed ?? 0} processed`,
      );
      load();
    } catch {
    } finally {
      setRunning(false);
    }
  };

  const ngn = (n: number) => formatMoney(n);

  const cols: Column<PlanRow>[] = [
    {
      key: "plan",
      header: "Plan",
      render: (r) => (
        <span className="font-semibold text-ink">{r.planName}</span>
      ),
    },
    {
      key: "audience",
      header: "For",
      render: (r) => (
        <Badge
          label={r.audience === "DOCTOR" ? "Doctors" : "Patients"}
          variant={r.audience === "DOCTOR" ? "info" : "success"}
        />
      ),
    },
    {
      key: "count",
      header: "Active",
      render: (r) => (
        <span className="tabular-nums font-semibold">{r.count}</span>
      ),
    },
    {
      key: "mrr",
      header: "MRR",
      render: (r) => (
        <span className="tabular-nums font-bold text-success-600">
          {ngn(r.mrr)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="page-title mt-0.5">Subscription Revenue</h1>
        </div>
        <button
          onClick={runRenewals}
          disabled={running}
          className="btn-outline flex items-center gap-2"
        >
          <RefreshCw size={16} className={running ? "animate-spin" : ""} />{" "}
          {running ? "Running..." : "Run renewals"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          title="MRR"
          value={ngn(data?.mrr ?? 0)}
          icon={TrendingUp}
          color="green"
        />
        <StatsCard
          title="ARR"
          value={ngn(data?.arr ?? 0)}
          icon={CalendarClock}
          color="blue"
        />
        <StatsCard
          title="Collected (all-time)"
          value={ngn(data?.totalCollected ?? 0)}
          icon={Banknote}
          color="purple"
        />
        <StatsCard
          title="Active subscribers"
          value={data?.activeCount ?? 0}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Past due (dunning)"
          value={data?.pastDueCount ?? 0}
          icon={AlertTriangle}
          color="orange"
        />
        <StatsCard
          title="Cancelled / expired"
          value={data?.cancelledCount ?? 0}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div>
        <h2 className="section-title mb-3">Recurring revenue by plan</h2>
        <div className="card p-0 overflow-hidden">
          <DataTable
            columns={cols}
            data={data?.byPlan ?? []}
            keyExtractor={(r) => r.planName}
            loading={loading}
            emptyMessage="No active subscriptions yet"
          />
        </div>
      </div>
    </div>
  );
}
