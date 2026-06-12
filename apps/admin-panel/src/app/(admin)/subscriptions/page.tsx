"use client";
import { useEffect, useState } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import type { AdminSubscription } from "@/types";
import { format } from "date-fns";

const STATUSES = [
  "ALL",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
  "PENDING",
] as const;
const STATUS_VARIANT: Record<
  string,
  "info" | "success" | "danger" | "warning" | "default"
> = {
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "default",
  EXPIRED: "danger",
  PENDING: "info",
};

export default function SubscriptionsPage() {
  const [rows, setRows] = useState<AdminSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const PAGE_SIZE = 25;

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/admin/subscriptions", {
        params: {
          page,
          limit: PAGE_SIZE,
          status: status === "ALL" ? undefined : status,
        },
      })
      .then((r: unknown) => {
        const d = (r as { data: { items: AdminSubscription[]; total: number } })
          .data;
        setRows(d?.items ?? []);
        setTotal(d?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, status]);

  const cols: Column<AdminSubscription>[] = [
    {
      key: "subscriber",
      header: "Subscriber",
      render: (r) => (
        <div className="leading-tight">
          <p className="text-ink font-medium">{r.subscriberName ?? "—"}</p>
          {r.subscriberEmail ? (
            <p className="text-caption text-gray-500">{r.subscriberEmail}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "who",
      header: "Type",
      render: (r) => (
        <Badge
          label={r.subscriberType === "DOCTOR" ? "Doctor" : "Patient"}
          variant={r.subscriberType === "DOCTOR" ? "info" : "success"}
        />
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (r) => (
        <span className="font-medium">{r.planName ?? r.plan?.name ?? "—"}</span>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (r) => (
        <span className="font-bold tabular-nums">
          {r.priceAtSignup > 0 ? formatMoney(r.priceAtSignup) : "Free"}
        </span>
      ),
    },
    {
      key: "via",
      header: "Via",
      render: (r) => (
        <span className="text-gray-500 capitalize">
          {r.paymentSource?.toLowerCase()}
          {r.lastFour ? ` ••${r.lastFour}` : ""}
        </span>
      ),
    },
    {
      key: "renews",
      header: "Renews",
      render: (r) =>
        r.currentPeriodEnd ? (
          <span className="text-gray-500 tabular-nums">
            {format(new Date(r.currentPeriodEnd), "dd MMM yyyy")}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <Badge
            label={r.status.replace("_", " ")}
            variant={STATUS_VARIANT[r.status] ?? "default"}
          />
          {r.cancelAtPeriodEnd && r.status === "ACTIVE" ? (
            <span className="text-caption text-gray-400">(ending)</span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Finance</p>
        <h1 className="page-title mt-0.5">Subscriptions</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-micro font-bold transition-colors ${status === s ? "bg-navy text-white" : "bg-surface text-gray-500 ring-1 ring-inset ring-border hover:text-ink"}`}
          >
            {s === "ALL" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No subscriptions yet"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
