"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { Badge, statusBadge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { format, subDays } from "date-fns";
import type { Appointment } from "@/types";

const STATUSES = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];

export default function AppointmentsPage() {
  return (
    <Suspense>
      <AppointmentsPageInner />
    </Suspense>
  );
}

function AppointmentsPageInner() {
  // The navbar global search deep-links here with ?search=<booking id / name>.
  const params = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debounced, setDebounced] = useState(search);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  // Server-side search (matches booking number, patient, doctor, service).
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/admin/appointments", {
        params: {
          page,
          limit: PAGE_SIZE,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          startDate,
          endDate,
          search: debounced || undefined,
        },
      })
      .then((r: unknown) =>
        setAppointments((r as { data: Appointment[] }).data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter, startDate, endDate, debounced]);

  const cols: Column<Appointment>[] = [
    {
      key: "bookingNumber",
      header: "Booking No.",
      width: "110px",
      render: (r) => (
        <Link
          href={`/appointments/${r.id}`}
          className="font-semibold text-sm text-teal-600 hover:text-teal-700 hover:underline"
        >
          #{r.bookingNumber ?? "—"}
        </Link>
      ),
    },
    {
      key: "user",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.user?.image} name={r.user?.name} size={30} />
          <PatientLink
            id={r.userId}
            name={r.user?.name}
            className="font-medium text-sm"
          />
        </div>
      ),
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.doctor?.image} name={r.doctor?.name} size={30} />
          <span className="text-sm">{r.doctor?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date & Time",
      render: (r) => (
        <span className="text-gray-600 text-sm">
          {r.date} · {r.time}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <Badge
          label={r.type}
          variant={r.type === "ONLINE" ? "info" : "default"}
        />
      ),
    },
    { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
    {
      key: "amount",
      header: "Amount",
      render: (r) => (
        <span className="font-semibold">{formatMoney(r.amount)}</span>
      ),
    },
    {
      key: "adminEarning",
      header: "Commission",
      render: (r) => (
        <span className="text-primary-600">
          {formatMoney(r.adminEarning ?? 0)}
        </span>
      ),
    },
    {
      key: "view",
      header: "",
      width: "52px",
      render: (r) => (
        <Link
          href={`/appointments/${r.id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-500/10 transition-colors"
          title="View appointment details"
        >
          <Eye size={16} />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <h1 className="page-title">All Appointments</h1>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Booking ID, patient, doctor, service..."
          />
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={appointments}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No appointments found"
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
