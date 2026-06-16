"use client";
import { useEffect, useState } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  isPresent: boolean;
  doctor?: { id: string; name: string; image?: string; designation?: string };
}

export default function AttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/admin/attendance", { params: { date } })
      .then((r: unknown) =>
        setRecords((r as { data: AttendanceRecord[] }).data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [date]);

  const cols: Column<AttendanceRecord>[] = [
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
          <Avatar src={r.doctor?.image} name={r.doctor?.name} size={36} />
          <div>
            <p className="font-medium">{r.doctor?.name}</p>
            <p className="text-xs text-gray-400">{r.doctor?.designation}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge
          label={r.isPresent ? "Present" : "Absent"}
          variant={r.isPresent ? "success" : "danger"}
        />
      ),
    },
    {
      key: "checkIn",
      header: "Check In",
      render: (r) =>
        r.checkIn ? (
          <span className="font-medium text-green-600">{r.checkIn}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: "checkOut",
      header: "Check Out",
      render: (r) =>
        r.checkOut ? (
          <span className="font-medium text-red-500">{r.checkOut}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ];

  const presentCount = records.filter((r) => r.isPresent).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Doctor Attendance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {presentCount} of {records.length} doctors present
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-auto"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Total Doctors",
            value: records.length,
            color: "bg-blue-50 text-blue-700",
          },
          {
            label: "Present",
            value: presentCount,
            color: "bg-green-50 text-green-700",
          },
          {
            label: "Absent",
            value: records.length - presentCount,
            color: "bg-red-50 text-red-700",
          },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
            <p className="text-sm font-medium opacity-70">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={records}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No attendance records for this date"
        />
      </div>
    </div>
  );
}
