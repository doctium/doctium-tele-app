"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Globe2,
  Repeat,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useChartTheme } from "@/lib/chart-theme";
import { format, subDays } from "date-fns";

interface Overview {
  activePatients30d: number;
  newUsers30d: number;
  newDoctors30d: number;
  payingPatients: number;
  repeatRate: number;
  avgRevenuePerPatient: number;
  churnBuckets: { high: number; medium: number; low: number };
}
interface Cohorts {
  months: string[];
  cohorts: {
    month: string;
    label: string;
    size: number;
    retention: (number | null)[];
  }[];
}
interface AtRiskUser {
  userId: string;
  name: string;
  email: string;
  mobile: string;
  image: string;
  level: "HIGH" | "MEDIUM";
  score: number;
  daysSinceLast: number;
  avgGapDays: number;
  consultations: number;
  detractor: boolean;
  npsScore: number | null;
}
interface Churn {
  buckets: { high: number; medium: number; low: number };
  atRisk: AtRiskUser[];
}
interface SpecialtyRevenue {
  specialty: string;
  revenue: number;
  adminEarning: number;
  consultations: number;
  doctors: number;
  avgFee: number;
}
interface GeoCountry {
  country: string;
  patients: number;
  doctors: number;
  consultations: number;
  revenue: number;
}

export default function AnalyticsPage() {
  const ct = useChartTheme();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [cohorts, setCohorts] = useState<Cohorts | null>(null);
  const [churn, setChurn] = useState<Churn | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyRevenue[]>([]);
  const [geo, setGeo] = useState<GeoCountry[]>([]);
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 90), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);

  // Cohorts + churn are all-time; only the revenue/geo widgets follow the range.
  useEffect(() => {
    Promise.all([
      apiClient.get("/admin/analytics/overview") as Promise<{ data: Overview }>,
      apiClient.get("/admin/analytics/cohorts") as Promise<{ data: Cohorts }>,
      apiClient.get("/admin/analytics/churn") as Promise<{ data: Churn }>,
    ])
      .then(([o, c, ch]) => {
        setOverview(o.data);
        setCohorts(c.data);
        setChurn(ch.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { startDate, endDate };
    Promise.all([
      apiClient.get("/admin/analytics/revenue-by-specialty", {
        params,
      }) as Promise<{
        data: SpecialtyRevenue[];
      }>,
      apiClient.get("/admin/analytics/geo", { params }) as Promise<{
        data: { countries: GeoCountry[] };
      }>,
    ])
      .then(([s, g]) => {
        setSpecialties(s.data ?? []);
        setGeo(g.data?.countries ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const atRiskCols: Column<AtRiskUser>[] = [
    {
      key: "user",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.image} name={r.name} size={34} />
          <div className="min-w-0">
            <p className="truncate">
              <PatientLink
                id={r.userId}
                name={r.name}
                className="font-semibold text-ink"
              />
            </p>
            <p className="text-caption text-gray-400 truncate">
              {r.email || r.mobile}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "level",
      header: "Risk",
      render: (r) => (
        <span
          className={
            r.level === "HIGH"
              ? "inline-flex rounded-full bg-red-50 px-2.5 py-1 text-micro font-bold text-red-600 ring-1 ring-inset ring-red-500/20"
              : "inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-micro font-bold text-orange-600 ring-1 ring-inset ring-orange-500/20"
          }
        >
          {r.level === "HIGH" ? "High" : "Medium"}
        </span>
      ),
    },
    {
      key: "signal",
      header: "Signal",
      render: (r) =>
        r.detractor ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-micro font-bold text-red-600 ring-1 ring-inset ring-red-500/20">
            NPS {r.npsScore}/10
          </span>
        ) : (
          <span className="text-caption text-gray-400">Cadence</span>
        ),
    },
    {
      key: "daysSinceLast",
      header: "Silent for",
      render: (r) => (
        <span className="tabular-nums text-gray-600">
          {r.daysSinceLast} days
        </span>
      ),
    },
    {
      key: "avgGapDays",
      header: "Usual cadence",
      render: (r) => (
        <span className="tabular-nums text-gray-500">
          every ~{r.avgGapDays}d
        </span>
      ),
    },
    {
      key: "consultations",
      header: "Consults",
      render: (r) => (
        <span className="font-bold text-ink tabular-nums">
          {r.consultations}
        </span>
      ),
    },
  ];

  const geoCols: Column<GeoCountry>[] = [
    {
      key: "country",
      header: "Country",
      render: (r) => (
        <span className="font-semibold text-ink">{r.country}</span>
      ),
    },
    {
      key: "patients",
      header: "Patients",
      render: (r) => {
        const max = Math.max(...geo.map((g) => g.patients), 1);
        return (
          <div className="flex items-center gap-3">
            <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-teal"
                style={{ width: `${Math.max(4, (r.patients / max) * 100)}%` }}
              />
            </div>
            <span className="tabular-nums text-gray-600">{r.patients}</span>
          </div>
        );
      },
    },
    {
      key: "doctors",
      header: "Doctors",
      render: (r) => (
        <span className="tabular-nums text-gray-600">{r.doctors}</span>
      ),
    },
    {
      key: "consultations",
      header: "Consults",
      render: (r) => (
        <span className="tabular-nums text-gray-600">{r.consultations}</span>
      ),
    },
    {
      key: "revenue",
      header: "Revenue",
      render: (r) => (
        <span className="font-bold text-teal-600 tabular-nums">
          {formatMoney(r.revenue)}
        </span>
      ),
    },
  ];

  const statCards = [
    {
      title: "Active Patients (30d)",
      value: overview?.activePatients30d ?? "—",
      icon: Activity,
      color: "green" as const,
    },
    {
      title: "New Sign-ups (30d)",
      value: overview?.newUsers30d ?? "—",
      icon: UserPlus,
      color: "blue" as const,
    },
    {
      title: "Repeat Patient Rate",
      value: overview ? `${overview.repeatRate}%` : "—",
      icon: Repeat,
      color: "purple" as const,
    },
    {
      title: "Avg Revenue / Patient",
      value: overview ? formatMoney(overview.avgRevenuePerPatient) : "—",
      icon: Wallet,
      color: "orange" as const,
    },
    {
      title: "High Churn Risk",
      value: overview?.churnBuckets?.high ?? "—",
      icon: AlertTriangle,
      color: "red" as const,
    },
  ];

  return (
    <div className="space-y-7">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Business intelligence</p>
          <h1 className="page-title mt-1">Advanced Analytics</h1>
          <p className="mt-1 text-body-md text-gray-500">
            Cohorts, churn prediction, revenue per specialty and geographic
            reach.
          </p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
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
            />
          </div>
        ))}
      </div>

      {/* ── Revenue per specialty ────────────────────────────── */}
      <div className="card">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-navy text-white">
            <BarChart3 size={18} />
          </div>
          <div>
            <p className="eyebrow">Revenue</p>
            <h2 className="section-title mt-0.5">Revenue per Specialty</h2>
          </div>
        </div>
        {specialties.length === 0 && !loading ? (
          <div className="flex h-56 items-center justify-center text-gray-400">
            No completed consultations in this period
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={specialties.slice(0, 8)}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke={ct.grid}
                  vertical={false}
                />
                <XAxis
                  dataKey="specialty"
                  tick={{ fontSize: 11, fill: ct.axisTick }}
                  tickLine={false}
                  axisLine={{ stroke: ct.axisLine }}
                  dy={6}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: ct.axisTick }}
                  tickFormatter={(v: number) => formatMoney(v)}
                  tickLine={false}
                  axisLine={false}
                  width={84}
                />
                <Tooltip
                  cursor={{ fill: ct.cursorFill }}
                  contentStyle={ct.tooltipContentStyle}
                  formatter={(val: number) => [formatMoney(val), "Revenue"]}
                />
                <Bar
                  dataKey="revenue"
                  fill="#2CB7A7"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={46}
                />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-caption font-bold uppercase tracking-wide text-gray-400">
                    <th className="py-2.5 pr-4">Specialty</th>
                    <th className="py-2.5 pr-4">Doctors</th>
                    <th className="py-2.5 pr-4">Consults</th>
                    <th className="py-2.5 pr-4">Avg fee</th>
                    <th className="py-2.5 pr-4">Platform share</th>
                    <th className="py-2.5">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {specialties.map((s) => (
                    <tr key={s.specialty} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 font-semibold text-ink">
                        {s.specialty}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-gray-600">
                        {s.doctors}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-gray-600">
                        {s.consultations}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-gray-600">
                        {formatMoney(s.avgFee)}
                      </td>
                      <td className="py-2.5 pr-4 tabular-nums text-gray-600">
                        {formatMoney(s.adminEarning)}
                      </td>
                      <td className="py-2.5 font-bold tabular-nums text-teal-600">
                        {formatMoney(s.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Cohort retention ─────────────────────────────────── */}
      <div className="card">
        <div className="mb-2">
          <p className="eyebrow">Retention</p>
          <h2 className="section-title mt-0.5">Sign-up Cohorts</h2>
          <p className="mt-1 text-body-sm text-gray-500">
            Share of each monthly sign-up cohort that booked an appointment 0,
            1, 2… months after joining.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr className="text-caption font-bold uppercase tracking-wide text-gray-400">
                <th className="py-2.5 pr-4">Cohort</th>
                <th className="py-2.5 pr-4">Users</th>
                {(cohorts?.cohorts[0]?.retention ?? []).map((_, k) => (
                  <th key={k} className="py-2.5 pr-2 text-center">
                    M{k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(cohorts?.cohorts ?? []).map((c) => (
                <tr key={c.month} className="border-t border-gray-50">
                  <td className="py-2 pr-4 font-semibold text-ink whitespace-nowrap">
                    {c.label}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-gray-600">
                    {c.size}
                  </td>
                  {c.retention.map((v, k) => (
                    <td key={k} className="p-1 text-center">
                      {v === null ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <span
                          className="inline-block w-full rounded-lg px-1 py-1.5 text-micro font-bold tabular-nums"
                          style={{
                            backgroundColor: `rgba(44,183,167,${Math.min(0.85, 0.06 + (v / 100) * 0.8)})`,
                            color: v >= 40 ? "#fff" : "#133157",
                          }}
                        >
                          {v}%
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(cohorts?.cohorts ?? []).every((c) => c.size === 0) && cohorts ? (
            <p className="py-6 text-center text-gray-400">
              No sign-ups in the cohort window yet
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Churn prediction ─────────────────────────────────── */}
      <div className="card">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Churn prediction</p>
            <h2 className="section-title mt-0.5">Patients Drifting Away</h2>
            <p className="mt-1 text-body-sm text-gray-500">
              Patients overdue versus their own consultation cadence, plus
              recent NPS detractors — reach out before they churn.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-micro font-bold text-red-600 ring-1 ring-inset ring-red-500/20">
              {churn?.buckets.high ?? 0} high
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-micro font-bold text-orange-600 ring-1 ring-inset ring-orange-500/20">
              {churn?.buckets.medium ?? 0} medium
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20">
              {churn?.buckets.low ?? 0} healthy
            </span>
          </div>
        </div>
        <DataTable
          columns={atRiskCols}
          data={churn?.atRisk ?? []}
          keyExtractor={(r) => r.userId}
          loading={!churn}
          emptyMessage="No at-risk patients — retention looks healthy"
        />
      </div>

      {/* ── Geographic distribution ──────────────────────────── */}
      <div className="card">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-teal text-white">
            <Globe2 size={18} />
          </div>
          <div>
            <p className="eyebrow">Reach</p>
            <h2 className="section-title mt-0.5">Geographic Distribution</h2>
          </div>
        </div>
        <DataTable
          columns={geoCols}
          data={geo}
          keyExtractor={(r) => r.country}
          loading={loading}
          emptyMessage="No location data yet"
        />
      </div>
    </div>
  );
}
