"use client";
import { useEffect, useState } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { statusBadge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { format } from "date-fns";
import type { Appointment } from "@/types";

export default function DailyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/admin/appointments", {
        params: { startDate: date, endDate: date },
      })
      .then((r: unknown) =>
        setAppointments((r as { data: Appointment[] }).data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

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
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar name={r.user?.name} src={r.user?.image} size={30} />
          <PatientLink
            id={r.userId}
            name={r.user?.name}
            className="font-medium text-sm"
          />
        </div>
      ),
    },
    { key: "doctor", header: "Doctor", render: (r) => r.doctor?.name ?? "—" },
    {
      key: "time",
      header: "Time",
      render: (r) => <span className="font-medium">{r.time}</span>,
    },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
    {
      key: "amount",
      header: "Amount",
      render: (r) => <span>{formatMoney(r.amount)}</span>,
    },
  ];

  const totalRevenue = appointments.reduce(
    (s, a) => s + (a.adminEarning ?? 0),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Daily Appointments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {appointments.length} appointments · Admin revenue:{" "}
            {formatMoney(totalRevenue)}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-auto"
        />
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={appointments}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No appointments for this date"
        />
      </div>
    </div>
  );
}
