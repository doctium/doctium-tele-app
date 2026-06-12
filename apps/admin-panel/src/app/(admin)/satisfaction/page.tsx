"use client";
import { useEffect, useState } from "react";
import { Frown, Gauge, MessageSquareText, Repeat, Smile } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { apiClient } from "@/lib/api";
import { useChartTheme } from "@/lib/chart-theme";

interface DoctorNps {
  doctorId: string;
  nps: number;
  responses: number;
  name: string;
  image: string;
  designation: string;
}
interface Overview {
  nps: number | null;
  nps90: number | null;
  totalResponses: number;
  delivered: number;
  pending: number;
  expired: number;
  responseRate: number;
  detractors30d: number;
  wouldBookAgainRate: number | null;
  categories: { key: string; label: string; average: number | null }[];
  trend: {
    month: string;
    label: string;
    nps: number | null;
    responses: number;
  }[];
  topDoctors: DoctorNps[];
  bottomDoctors: DoctorNps[];
}
interface SurveyRow {
  id: string;
  status: string;
  npsScore: number | null;
  categories: Record<string, number>;
  comment: string;
  wouldBookAgain: boolean | null;
  respondedAt: string | null;
  createdAt: string;
  userId?: string;
  user: { name: string; image: string } | null;
  doctor: { name: string; designation: string } | null;
  appointment: { date: string; time: string } | null;
}

const fmtNps = (v: number | null | undefined) =>
  v == null ? "—" : v > 0 ? `+${v}` : `${v}`;

export default function SatisfactionPage() {
  const ct = useChartTheme();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [responses, setResponses] = useState<SurveyRow[]>([]);
  const [status, setStatus] = useState("COMPLETED");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/admin/satisfaction/overview")
      .then((r) => setOverview((r as { data: Overview }).data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/admin/satisfaction/responses", {
        params: { status: status || undefined, limit: 50 },
      })
      .then((r) => setResponses((r as { data: SurveyRow[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const doctorCols: Column<DoctorNps>[] = [
    {
      key: "doctor",
      header: "Doctor",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.image} name={r.name} size={34} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{r.name}</p>
            <p className="truncate text-caption text-gray-400">
              {r.designation || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "responses",
      header: "Responses",
      render: (r) => (
        <span className="tabular-nums text-gray-600">{r.responses}</span>
      ),
    },
    {
      key: "nps",
      header: "NPS",
      render: (r) => (
        <span
          className={
            r.nps >= 30
              ? "font-bold tabular-nums text-teal-600"
              : r.nps >= 0
                ? "font-bold tabular-nums text-ink"
                : "font-bold tabular-nums text-red-600"
          }
        >
          {fmtNps(r.nps)}
        </span>
      ),
    },
  ];

  const responseCols: Column<SurveyRow>[] = [
    {
      key: "user",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.user?.image} name={r.user?.name} size={32} />
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
        <span className="text-gray-600">{r.doctor?.name || "—"}</span>
      ),
    },
    {
      key: "npsScore",
      header: "NPS",
      render: (r) =>
        r.npsScore == null ? (
          <span className="text-gray-300">—</span>
        ) : (
          <span
            className={
              r.npsScore >= 9
                ? "inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20"
                : r.npsScore >= 7
                  ? "inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-micro font-bold text-orange-600 ring-1 ring-inset ring-orange-500/20"
                  : "inline-flex rounded-full bg-red-50 px-2.5 py-1 text-micro font-bold text-red-600 ring-1 ring-inset ring-red-500/20"
            }
          >
            {r.npsScore}/10
          </span>
        ),
    },
    {
      key: "comment",
      header: "Comment",
      render: (r) => (
        <span className="block max-w-md truncate text-gray-600">
          {r.comment || <span className="text-gray-300">—</span>}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className="text-caption font-bold uppercase tracking-wide text-gray-400">
          {r.status}
        </span>
      ),
    },
  ];

  const statCards = [
    {
      title: "Platform NPS (90d)",
      value: fmtNps(overview?.nps90),
      icon: Gauge,
      color: "blue" as const,
    },
    {
      title: "Responses",
      value: overview?.totalResponses ?? "—",
      icon: MessageSquareText,
      color: "purple" as const,
    },
    {
      title: "Response Rate",
      value: overview ? `${overview.responseRate}%` : "—",
      icon: Smile,
      color: "green" as const,
    },
    {
      title: "Would Book Again",
      value:
        overview?.wouldBookAgainRate != null
          ? `${overview.wouldBookAgainRate}%`
          : "—",
      icon: Repeat,
      color: "orange" as const,
    },
    {
      title: "Detractors (30d)",
      value: overview?.detractors30d ?? "—",
      icon: Frown,
      color: "red" as const,
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">Quality of care</p>
        <h1 className="page-title mt-1">Patient Satisfaction &amp; NPS</h1>
        <p className="mt-1 text-body-md text-gray-500">
          Post-consultation surveys, sent automatically 24h after every
          completed visit.
        </p>
      </div>

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

      {/* ── Trend + categories ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <p className="eyebrow">Trend</p>
          <h2 className="section-title mt-0.5 mb-5">Monthly NPS</h2>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart
              data={(overview?.trend ?? []).map((t) => ({
                ...t,
                nps: t.nps ?? 0,
              }))}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                stroke={ct.grid}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: ct.axisTick }}
                tickLine={false}
                axisLine={{ stroke: ct.axisLine }}
                dy={6}
              />
              <YAxis
                domain={[-100, 100]}
                tick={{ fontSize: 11, fill: ct.axisTick }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: ct.cursorFill }}
                contentStyle={ct.tooltipContentStyle}
                formatter={(val: number) => [fmtNps(val), "NPS"]}
              />
              <Bar dataKey="nps" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {(overview?.trend ?? []).map((t, i) => (
                  <Cell
                    key={i}
                    fill={(t.nps ?? 0) >= 0 ? "#2CB7A7" : "#F0675C"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="eyebrow">Dimensions</p>
          <h2 className="section-title mt-0.5 mb-5">Category Averages (90d)</h2>
          <div className="space-y-5">
            {(overview?.categories ?? []).map((c) => (
              <div key={c.key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-body-sm font-semibold text-ink">
                    {c.label}
                  </span>
                  <span className="text-body-sm font-bold tabular-nums text-ink">
                    {c.average != null ? `${c.average}/5` : "—"}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={
                      (c.average ?? 0) >= 4
                        ? "h-full rounded-full bg-gradient-teal"
                        : (c.average ?? 0) >= 3.5
                          ? "h-full rounded-full bg-gradient-navy"
                          : "h-full rounded-full bg-gradient-to-r from-[#F7A93D] to-[#E07B1A]"
                    }
                    style={{ width: `${((c.average ?? 0) / 5) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-caption text-gray-400">
            Delivered {overview?.delivered ?? 0} · Awaiting send{" "}
            {overview?.pending ?? 0} · Expired unanswered{" "}
            {overview?.expired ?? 0}
          </p>
        </div>
      </div>

      {/* ── Doctor leaderboards ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <p className="eyebrow">Leaders</p>
          <h2 className="section-title mt-0.5 mb-5">Highest NPS Doctors</h2>
          <DataTable
            columns={doctorCols}
            data={overview?.topDoctors ?? []}
            keyExtractor={(r) => r.doctorId}
            loading={!overview}
            emptyMessage="Needs at least 3 responses per doctor"
          />
        </div>
        <div className="card">
          <p className="eyebrow">Needs attention</p>
          <h2 className="section-title mt-0.5 mb-5">Lowest NPS Doctors</h2>
          <DataTable
            columns={doctorCols}
            data={overview?.bottomDoctors ?? []}
            keyExtractor={(r) => r.doctorId}
            loading={!overview}
            emptyMessage="Needs at least 3 responses per doctor"
          />
        </div>
      </div>

      {/* ── Raw responses ── */}
      <div className="card">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Voice of the patient</p>
            <h2 className="section-title mt-0.5">Survey Responses</h2>
          </div>
          <div className="flex items-center gap-2">
            {["COMPLETED", "SENT", "EXPIRED", ""].map((s) => (
              <button
                key={s || "all"}
                onClick={() => setStatus(s)}
                className={
                  status === s
                    ? "rounded-full bg-navy px-3.5 py-1.5 text-micro font-bold text-white"
                    : "rounded-full bg-gray-50 px-3.5 py-1.5 text-micro font-bold text-gray-500 ring-1 ring-inset ring-gray-200 hover:bg-gray-100"
                }
              >
                {s === "" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <DataTable
          columns={responseCols}
          data={responses}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No survey responses yet"
        />
      </div>
    </div>
  );
}
