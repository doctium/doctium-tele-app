"use client";
import { useEffect, useState } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { PatientLink } from "@/components/ui/PatientLink";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { Appointment } from "@/types";

export default function MonthlyReportPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [chartData, setChartData] = useState<
    { date: string; revenue: number; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd"),
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.get("/admin/appointments", {
        params: { startDate, endDate, limit: 200 },
      }),
      apiClient.get("/admin/chart", { params: { startDate, endDate } }),
    ])
      .then(([a, c]) => {
        setAppointments((a as { data: Appointment[] }).data ?? []);
        setChartData(
          (c as { data: { date: string; revenue: number; count: number }[] })
            .data ?? [],
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const totalRevenue = appointments.reduce((s, a) => s + (a.amount ?? 0), 0);
  const adminEarning = appointments.reduce(
    (s, a) => s + (a.adminEarning ?? 0),
    0,
  );
  const doctorEarning = appointments.reduce(
    (s, a) => s + (a.doctorEarning ?? 0),
    0,
  );

  const cols: Column<Appointment>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "user",
      header: "Patient",
      render: (r) => <PatientLink id={r.userId} name={r.user?.name} />,
    },
    { key: "doctor", header: "Doctor", render: (r) => r.doctor?.name ?? "—" },
    { key: "date", header: "Date", render: (r) => r.date },
    {
      key: "amount",
      header: "Total",
      render: (r) => formatMoney(r.amount),
    },
    {
      key: "adminEarning",
      header: "Admin",
      render: (r) => (
        <span className="text-primary-600">
          {formatMoney(r.adminEarning ?? 0)}
        </span>
      ),
    },
    {
      key: "doctorEarning",
      header: "Doctor",
      render: (r) => (
        <span className="text-green-600">
          {formatMoney(r.doctorEarning ?? 0)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Monthly Report</h1>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Total Revenue",
            value: formatMoney(totalRevenue),
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Admin Earnings",
            value: formatMoney(adminEarning),
            color: "bg-purple-50 text-purple-700",
          },
          {
            label: "Doctor Earnings",
            value: formatMoney(doctorEarning),
            color: "bg-green-50 text-green-700",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl p-5 ${s.color}`}>
            <p className="text-sm font-medium opacity-70">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Revenue Trend</h2>
        <RevenueChart data={chartData} />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="section-title">
            Appointment List ({appointments.length})
          </h2>
        </div>
        <DataTable
          columns={cols}
          data={appointments}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No appointments in this period"
        />
      </div>
    </div>
  );
}
