"use client";
import { useEffect, useState } from "react";
import { CheckCircle, Download, XCircle } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { statusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatMoney, toMajorUnits } from "@/lib/money";
import { downloadCsv } from "@/lib/csv";
import { format, subDays } from "date-fns";
import type { WithdrawRequest } from "@/types";

const STATUS_TABS = ["ALL", "PENDING", "ACCEPTED", "DECLINED"];

export default function WithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [declineModal, setDeclineModal] = useState<{ id: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = () => {
    apiClient
      .get("/admin/withdraw-requests", {
        params: { status: statusFilter === "ALL" ? undefined : statusFilter },
      })
      .then((r: unknown) =>
        setRequests((r as { data: WithdrawRequest[] }).data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleApprove = async (id: string) => {
    setProcessing(true);
    try {
      await apiClient.patch(`/admin/withdraw-requests/${id}`, {
        status: "ACCEPTED",
        payDate: format(new Date(), "yyyy-MM-dd"),
      });
      toast.success("Withdrawal approved");
      load();
    } catch {
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!declineModal) return;
    setProcessing(true);
    try {
      await apiClient.patch(`/admin/withdraw-requests/${declineModal.id}`, {
        status: "DECLINED",
        declineReason,
      });
      toast.success("Withdrawal declined");
      setDeclineModal(null);
      setDeclineReason("");
      load();
    } catch {
    } finally {
      setProcessing(false);
    }
  };

  const totalPending = requests
    .filter((r) => r.status === "PENDING")
    .reduce((s, r) => s + r.amount, 0);

  const exportCsv = () => {
    downloadCsv(
      `withdrawals-${statusFilter.toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}`,
      requests.map((r) => ({
        Doctor: r.doctor?.name ?? "",
        "Amount (NGN)": toMajorUnits(r.amount),
        Status: r.status,
        "Account Name": r.paymentDetails?.accountName ?? "",
        "Account Number": r.paymentDetails?.accountNumber ?? "",
        Bank: r.paymentDetails?.bankName ?? "",
        Requested: format(new Date(r.createdAt), "yyyy-MM-dd HH:mm"),
        "Paid On": r.payDate ?? "",
        "Decline Reason": r.declineReason ?? "",
      })),
    );
  };

  const cols: Column<WithdrawRequest>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.doctor?.image} name={r.doctor?.name} size={32} />
          <span className="font-medium">{r.doctor?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      render: (r) => (
        <span className="font-bold text-gray-900">{formatMoney(r.amount)}</span>
      ),
    },
    {
      key: "destination",
      header: "Destination",
      render: (r) => {
        const b = r.paymentDetails;
        if (!b?.accountNumber)
          return (
            <span className="text-xs text-gray-400 italic">
              No bank details
            </span>
          );
        return (
          <div className="leading-tight">
            <p className="font-semibold text-gray-900 text-sm">
              {b.accountName || b.bankName || "—"}
            </p>
            <p className="text-xs text-gray-500 font-mono">
              {b.accountNumber}
              {b.bankName ? ` · ${b.bankName}` : ""}
            </p>
          </div>
        );
      },
    },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
    {
      key: "createdAt",
      header: "Requested",
      render: (r) => (
        <span className="text-gray-500 text-sm">
          {format(new Date(r.createdAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "payDate",
      header: "Paid On",
      render: (r) =>
        r.payDate ? (
          <span className="text-gray-500 text-sm">{r.payDate}</span>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) =>
        r.status === "PENDING" ? (
          <div className="flex gap-2">
            <button
              onClick={() => handleApprove(r.id)}
              className="flex items-center gap-1 text-xs bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <CheckCircle size={13} /> Approve
            </button>
            <button
              onClick={() => setDeclineModal({ id: r.id })}
              className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <XCircle size={13} /> Decline
            </button>
          </div>
        ) : r.declineReason ? (
          <span className="text-xs text-gray-500 italic">
            "{r.declineReason}"
          </span>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Withdrawal Requests</h1>
          {totalPending > 0 && (
            <p className="text-sm text-yellow-600 mt-0.5 font-medium">
              ⚠️ {formatMoney(totalPending)} pending approval
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
          <button
            onClick={exportCsv}
            disabled={requests.length === 0}
            className="btn-secondary flex items-center gap-2 disabled:opacity-40"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setStatusFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === t ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={requests}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No withdrawal requests"
        />
      </div>

      <Modal
        open={!!declineModal}
        onClose={() => setDeclineModal(null)}
        title="Decline Withdrawal"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Provide a reason for declining this withdrawal request.
          </p>
          <textarea
            className="input min-h-[100px] resize-none"
            placeholder="Enter reason..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              onClick={() => setDeclineModal(null)}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleDecline}
              disabled={processing || !declineReason}
              className="btn-danger flex-1"
            >
              {processing ? "Processing..." : "Decline"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
