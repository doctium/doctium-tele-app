"use client";
import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  Calendar,
  Wallet,
  TrendingUp,
  Activity,
} from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { format, subDays } from "date-fns";
import type { AdminStats, TopDoctor, Appointment } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [topDoctors, setTopDoctors] = useState<TopDoctor[]>([]);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [chartData, setChartData] = useState<
    { date: string; revenue: number; count: number }[]
  >([]);
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate };
      const [s, t, u, c] = await Promise.all([
        apiClient.get("/admin/dashboard", { params }) as Promise<{
          data: AdminStats;
        }>,
        apiClient.get("/admin/top-doctors", { params }) as Promise<{
          data: TopDoctor[];
        }>,
        apiClient.get("/admin/upcoming") as Promise<{ data: Appointment[] }>,
        apiClient.get("/admin/chart", { params }) as Promise<{
          data: { date: string; revenue: number; count: number }[];
        }>,
      ]);
      setStats(s.data);
      setTopDoctors(t.data ?? []);
      setUpcoming(u.data ?? []);
      setChartData(c.data ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [startDate, endDate]);

  const topDoctorCols: Column<TopDoctor>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => (
        <span className="text-gray-400 font-semibold tabular-nums">
          {i + 1}
        </span>
      ),
    },
    {
      key: "name",
      header: "Doctor",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.doctorImage} name={r.name} size={34} />
          <span className="font-semibold text-ink">{r.name}</span>
        </div>
      ),
    },
    {
      key: "appointment",
      header: "Appointments",
      render: (r) => (
        <span className="font-bold text-ink tabular-nums">
          {r.appointment}
        </span>
      ),
    },
    {
      key: "doctorEarning",
      header: "Doctor's Share",
      render: (r) => (
        <span className="tabular-nums">
          {formatMoney(r.doctorEarning ?? 0)}
        </span>
      ),
    },
    {
      key: "adminEarning",
      header: "Admin Revenue",
      render: (r) => (
        <span className="text-teal-600 font-bold tabular-nums">
          {formatMoney(r.adminEarning ?? 0)}
        </span>
      ),
    },
  ];

  const upcomingCols: Column<Appointment>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => (
        <span className="text-gray-400 font-semibold tabular-nums">
          {i + 1}
        </span>
      ),
    },
    {
      key: "user",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.user?.image} name={r.user?.name} size={34} />
          <PatientLink
            id={r.userId}
            name={r.user?.name}
            className="font-semibold text-ink"
          />
        </div>
      ),
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (r) => (
        <span className="text-gray-600">{r.doctor?.name ?? "—"}</span>
      ),
    },
    {
      key: "time",
      header: "Time",
      render: (r) => (
        <span className="text-gray-600 tabular-nums">{r.time}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span
          className={
            r.type === "ONLINE"
              ? "inline-flex items-center gap-1.5 rounded-full bg-skyblue-50 px-2.5 py-1 text-micro font-bold text-navy-mid ring-1 ring-inset ring-skyblue/30"
              : "inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20"
          }
        >
          {r.type === "ONLINE" ? "Video" : "Clinic"}
        </span>
      ),
    },
  ];

  const statCards = [
    {
      title: "Total Customers",
      value: stats?.users ?? "—",
      icon: Users,
      color: "blue" as const,
      href: "/users",
    },
    {
      title: "Total Doctors",
      value: stats?.doctors ?? "—",
      icon: UserCheck,
      color: "purple" as const,
      href: "/doctors",
    },
    {
      title: "Appointments",
      value: stats?.appointments ?? "—",
      icon: Calendar,
      color: "green" as const,
      href: "/appointments",
    },
    {
      title: "Admin Revenue",
      value: stats ? formatMoney(stats.adminEarning ?? 0) : "—",
      icon: Wallet,
      color: "orange" as const,
      href: "/withdrawals",
    },
    {
      title: "Total Revenue",
      value: stats ? formatMoney(stats.revenue ?? 0) : "—",
      icon: TrendingUp,
      color: "red" as const,
      href: "/appointments/monthly",
    },
  ];

  const today = format(new Date(), "EEEE, MMMM d");

  return (
    <div className="space-y-7">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-hero text-white shadow-floating">
        <div className="pointer-events-none absolute inset-0 hero-sheen" />
        <div className="pointer-events-none absolute -top-16 right-10 h-52 w-52 rounded-full bg-teal-bright/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-60 w-60 rounded-full bg-skyblue/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 p-7 lg:flex-row lg:items-center lg:justify-between lg:p-8">
          <div>
            <div className="flex items-center gap-2 text-teal-bright">
              <Activity size={15} />
              <span className="text-micro font-bold uppercase tracking-[0.16em]">
                {today}
              </span>
            </div>
            <h2 className="mt-2 text-display-md font-extrabold tracking-tight">
              Welcome back, Admin 👋
            </h2>
            <p className="mt-2 max-w-xl text-body-md text-skyblue-100/80">
              Manage and monitor doctors, patients, appointments, earnings and
              more at a glance.
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-4 backdrop-blur-sm ring-1 ring-white/10">
            <p className="mb-2 text-micro font-bold uppercase tracking-wider text-skyblue-200/70">
              Date range
            </p>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
              onDark
            />
          </div>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {statCards.map((s, i) => (
          <div
            key={s.title}
            className="animate-fade-up"
            style={{ animationDelay: `${(i + 1) * 60}ms` }}
          >
            <StatsCard
              title={s.title}
              value={s.value}
              icon={s.icon}
              color={s.color}
              href={s.href}
            />
          </div>
        ))}
      </div>

      {/* ── Chart ────────────────────────────────────────────── */}
      <div className="card">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="eyebrow">Performance</p>
            <h2 className="section-title mt-0.5">Revenue &amp; Appointments</h2>
          </div>
          <div className="hidden items-center gap-4 text-caption font-semibold sm:flex">
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="h-2.5 w-2.5 rounded-full bg-navy" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <span className="h-2.5 w-2.5 rounded-full bg-teal" />
              Appointments
            </span>
          </div>
        </div>
        {chartData.length === 0 && !loading ? (
          <div className="flex h-64 items-center justify-center text-gray-400">
            No data for selected period
          </div>
        ) : (
          <RevenueChart data={chartData} />
        )}
      </div>

      {/* ── Tables ───────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-5">
            <p className="eyebrow">Leaderboard</p>
            <h2 className="section-title mt-0.5">Top Doctors</h2>
          </div>
          <DataTable
            columns={topDoctorCols}
            data={topDoctors}
            keyExtractor={(r) => r.doctorId}
            loading={loading}
            emptyMessage="No data for this period"
          />
        </div>
        <div className="card">
          <div className="mb-5">
            <p className="eyebrow">Today</p>
            <h2 className="section-title mt-0.5">Upcoming Appointments</h2>
          </div>
          <DataTable
            columns={upcomingCols}
            data={upcoming}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyMessage="No appointments today"
          />
        </div>
      </div>
    </div>
  );
}
