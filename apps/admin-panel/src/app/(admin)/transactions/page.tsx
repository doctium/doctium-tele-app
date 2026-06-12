"use client";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  RefreshCcw,
} from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { PatientLink } from "@/components/ui/PatientLink";
import { apiClient } from "@/lib/api";
import { formatMoney, toMajorUnits } from "@/lib/money";
import { downloadCsv } from "@/lib/csv";
import { format } from "date-fns";

interface Txn {
  id: string;
  reference: string;
  type:
    | "WALLET_TOPUP"
    | "APPOINTMENT_PAYMENT"
    | "REFUND"
    | "PAYOUT"
    | "SUBSCRIPTION_PAYMENT";
  provider: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  amount: number;
  currency: string;
  channel?: string;
  createdAt: string;
  userId?: string | null;
  userName?: string | null;
  doctorName?: string | null;
}

const TYPES = [
  "ALL",
  "WALLET_TOPUP",
  "APPOINTMENT_PAYMENT",
  "SUBSCRIPTION_PAYMENT",
  "REFUND",
  "PAYOUT",
] as const;
const TYPE_LABEL: Record<string, string> = {
  WALLET_TOPUP: "Wallet top-up",
  APPOINTMENT_PAYMENT: "Appointment",
  SUBSCRIPTION_PAYMENT: "Subscription",
  REFUND: "Refund",
  PAYOUT: "Payout",
};
const TYPE_ICON: Record<Txn["type"], typeof ArrowDownLeft> = {
  WALLET_TOPUP: ArrowDownLeft,
  APPOINTMENT_PAYMENT: ArrowDownLeft,
  SUBSCRIPTION_PAYMENT: ArrowDownLeft,
  REFUND: RefreshCcw,
  PAYOUT: ArrowUpRight,
};
const STATUS_VARIANT: Record<Txn["status"], "info" | "success" | "danger"> = {
  PENDING: "info",
  SUCCESS: "success",
  FAILED: "danger",
};

export default function TransactionsPage() {
  const [rows, setRows] = useState<Txn[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<(typeof TYPES)[number]>("ALL");
  const [exporting, setExporting] = useState(false);
  const PAGE_SIZE = 25;

  // Export pulls the FULL ledger for the active type filter, not just this page.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const r: unknown = await apiClient.get("/admin/transactions", {
        params: {
          page: 1,
          limit: 10000,
          type: type === "ALL" ? undefined : type,
        },
      });
      const items = (r as { data: { items: Txn[] } }).data?.items ?? [];
      downloadCsv(
        `transactions-${type.toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}`,
        items.map((t) => ({
          Date: format(new Date(t.createdAt), "yyyy-MM-dd HH:mm"),
          Type: TYPE_LABEL[t.type] ?? t.type,
          Patient: t.userName ?? "",
          Doctor: t.doctorName ?? "",
          Via: t.provider === "MANUAL" ? "Manual" : (t.channel ?? t.provider),
          [`Amount (${items[0]?.currency ?? "NGN"})`]: toMajorUnits(t.amount),
          Status: t.status,
          Reference: t.reference,
        })),
      );
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/admin/transactions", {
        params: {
          page,
          limit: PAGE_SIZE,
          type: type === "ALL" ? undefined : type,
        },
      })
      .then((r: unknown) => {
        const d = (r as { data: { items: Txn[]; total: number } }).data;
        setRows(d?.items ?? []);
        setTotal(d?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, type]);

  const cols: Column<Txn>[] = [
    {
      key: "date",
      header: "Date",
      render: (r) => (
        <span className="text-gray-500 tabular-nums">
          {format(new Date(r.createdAt), "dd MMM, HH:mm")}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => {
        const Icon = TYPE_ICON[r.type];
        const out = r.type === "PAYOUT";
        return (
          <span className="inline-flex items-center gap-2 font-semibold text-ink">
            <span
              className={`grid place-items-center w-7 h-7 rounded-lg ${out ? "bg-alert-50 text-alert-600" : r.type === "REFUND" ? "bg-caution-50 text-caution-600" : "bg-success-50 text-success-600"}`}
            >
              <Icon size={14} />
            </span>
            {TYPE_LABEL[r.type] ?? r.type}
          </span>
        );
      },
    },
    {
      key: "party",
      header: "Party",
      render: (r) => (
        <div className="leading-tight">
          {r.userName ? (
            <p className="text-ink">
              <PatientLink id={r.userId} name={r.userName} />
            </p>
          ) : null}
          {r.doctorName ? (
            <p className="text-caption text-gray-500">Dr. {r.doctorName}</p>
          ) : null}
          {!r.userName && !r.doctorName ? (
            <span className="text-gray-400">—</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "channel",
      header: "Via",
      render: (r) => (
        <span className="text-gray-500 capitalize">
          {r.provider === "MANUAL" ? "Manual" : (r.channel ?? r.provider)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (r) => (
        <span
          className={`font-bold tabular-nums ${r.type === "PAYOUT" || r.type === "REFUND" ? "text-alert-600" : "text-success-600"}`}
        >
          {r.type === "PAYOUT" || r.type === "REFUND" ? "−" : "+"}
          {formatMoney(r.amount, r.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge
          label={
            r.status === "SUCCESS"
              ? "Success"
              : r.status === "PENDING"
                ? "Pending"
                : "Failed"
          }
          variant={STATUS_VARIANT[r.status]}
        />
      ),
    },
    {
      key: "ref",
      header: "Reference",
      render: (r) => (
        <span className="font-mono text-caption text-gray-400">
          {r.reference}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="page-title mt-0.5">Transactions</h1>
        </div>
        <button
          onClick={exportCsv}
          disabled={exporting || total === 0}
          className="btn-secondary flex items-center gap-2 disabled:opacity-40"
        >
          <Download size={15} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => {
              setType(t);
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-micro font-bold transition-colors ${type === t ? "bg-navy text-white" : "bg-surface text-gray-500 ring-1 ring-inset ring-border hover:text-ink"}`}
          >
            {t === "ALL" ? "All" : TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No transactions yet"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
