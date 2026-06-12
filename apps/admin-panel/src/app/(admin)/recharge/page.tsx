"use client";
import { useEffect, useState } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { format, subDays } from "date-fns";

interface RechargeRecord {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
  wallet?: { user?: { id?: string; name: string; image?: string } };
}

export default function RechargePage() {
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/admin/recharges", { params: { startDate, endDate } })
      .then((r: unknown) =>
        setRecords((r as { data: RechargeRecord[] }).data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const totalDeposits = records
    .filter((r) => r.type === "DEPOSIT")
    .reduce((s, r) => s + r.amount, 0);

  const cols: Column<RechargeRecord>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "user",
      header: "Customer",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar
            name={r.wallet?.user?.name}
            src={r.wallet?.user?.image}
            size={32}
          />
          <PatientLink
            id={r.wallet?.user?.id}
            name={r.wallet?.user?.name}
            className="font-medium"
          />
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (r) => (
        <span className="text-sm text-gray-600">{r.description}</span>
      ),
    },
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
          className={`font-bold ${r.type === "DEPOSIT" ? "text-green-600" : "text-red-600"}`}
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
        <span className="text-gray-400 text-sm">
          {format(new Date(r.createdAt), "dd MMM yyyy, HH:mm")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">User Recharge History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Total deposits: {formatMoney(totalDeposits)}
          </p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={records}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No recharge records"
        />
      </div>
    </div>
  );
}
