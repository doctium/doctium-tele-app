"use client";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatsCard } from "@/components/ui/StatsCard";
import { apiClient } from "@/lib/api";
import { useChartTheme } from "@/lib/chart-theme";

interface Overview {
  assistant: string;
  sessions30d: number;
  byMode: { TRIAGE: number; QA: number };
  completionRate: number;
  redFlags30d: number;
  urgency: Record<string, number>;
  languages: Record<string, number>;
  funnel: {
    verdicts: number;
    bookable: number;
    instantConsult: number;
    booked: number;
    dismissed: number;
    linkedAppointments: number;
    conversionRate: number;
  };
  accuracy: { agree: number; disagree: number; percent: number | null };
  programSuggestions: {
    suggested: number;
    converted: number;
    conversionRate: number | null;
    byProgram: {
      programId: string;
      name: string;
      suggested: number;
      converted: number;
    }[];
  };
  daily: { date: string; triage: number; qa: number }[];
}

const URGENCY_META: { key: string; label: string; color: string }[] = [
  { key: "EMERGENCY", label: "Emergency", color: "#F0675C" },
  { key: "URGENT_CONSULT", label: "Urgent consult", color: "#F7A93D" },
  { key: "CONSULT_24H", label: "Within 24h", color: "#2E7CC2" },
  { key: "ROUTINE", label: "Routine", color: "#133157" },
  { key: "SELF_CARE", label: "Self-care", color: "#2CB7A7" },
];

const LANGUAGE_LABELS: Record<string, string> = {
  auto: "Auto",
  en: "English",
  pcm: "Pidgin",
  ha: "Hausa",
  yo: "Yorùbá",
  ig: "Igbo",
};

export default function LeenahPage() {
  const ct = useChartTheme();
  const [overview, setOverview] = useState<Overview | null>(null);

  useEffect(() => {
    apiClient
      .get("/admin/triage/overview")
      .then((r) => setOverview((r as { data: Overview }).data))
      .catch(() => {});
  }, []);

  const urgencyTotal = Object.values(overview?.urgency ?? {}).reduce(
    (s, n) => s + n,
    0,
  );
  const langTotal = Object.values(overview?.languages ?? {}).reduce(
    (s, n) => s + n,
    0,
  );

  const statCards = [
    {
      title: "Sessions (30d)",
      value: overview?.sessions30d ?? "—",
      icon: MessageSquareText,
      color: "blue" as const,
    },
    {
      title: "Completion Rate",
      value: overview ? `${overview.completionRate}%` : "—",
      icon: CheckCircle2,
      color: "green" as const,
    },
    {
      title: "Booking Conversion",
      value: overview ? `${overview.funnel.conversionRate}%` : "—",
      icon: CalendarCheck,
      color: "purple" as const,
    },
    {
      title: "Routing Accuracy",
      value:
        overview?.accuracy.percent != null
          ? `${overview.accuracy.percent}%`
          : "—",
      icon: Sparkles,
      color: "orange" as const,
    },
    {
      title: "Red Flags (30d)",
      value: overview?.redFlags30d ?? "—",
      icon: AlertTriangle,
      color: "red" as const,
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">AI assistant</p>
        <h1 className="page-title mt-1 flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-teal text-white">
            <Sparkles size={19} />
          </span>
          Leenah
        </h1>
        <p className="mt-1 text-body-md text-gray-500">
          Symptom-checker and health Q&amp;A performance — routing, conversion
          and safety signals.
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

      {/* ── Daily volume ── */}
      <div className="card">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="eyebrow">Volume</p>
            <h2 className="section-title mt-0.5">Sessions per Day (14d)</h2>
          </div>
          <p className="text-caption text-gray-400">
            {overview?.byMode.TRIAGE ?? 0} symptom checks ·{" "}
            {overview?.byMode.QA ?? 0} questions (30d)
          </p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={(overview?.daily ?? []).map((d) => ({
              ...d,
              label: d.date.slice(5),
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
              allowDecimals={false}
              tick={{ fontSize: 11, fill: ct.axisTick }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: ct.cursorFill }}
              contentStyle={ct.tooltipContentStyle}
            />
            <Legend
              iconType="circle"
              iconSize={9}
              wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 8 }}
            />
            <Bar
              dataKey="triage"
              name="Symptom checks"
              stackId="a"
              fill="#133157"
              radius={[0, 0, 0, 0]}
              maxBarSize={26}
            />
            <Bar
              dataKey="qa"
              name="Questions"
              stackId="a"
              fill="#2CB7A7"
              radius={[6, 6, 0, 0]}
              maxBarSize={26}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Urgency distribution ── */}
        <div className="card">
          <p className="eyebrow">Triage outcomes</p>
          <h2 className="section-title mt-0.5 mb-5">
            Urgency Distribution (30d)
          </h2>
          <div className="space-y-4">
            {URGENCY_META.map((u) => {
              const n = overview?.urgency?.[u.key] ?? 0;
              const pct = urgencyTotal
                ? Math.round((n / urgencyTotal) * 100)
                : 0;
              return (
                <div key={u.key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-body-sm font-semibold text-ink">
                      {u.label}
                    </span>
                    <span className="text-body-sm tabular-nums text-gray-500">
                      {n} · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(n > 0 ? 3 : 0, pct)}%`,
                        backgroundColor: u.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {urgencyTotal === 0 && overview ? (
              <p className="py-4 text-center text-gray-400">
                No completed triage sessions yet
              </p>
            ) : null}
          </div>
        </div>

        {/* ── Funnel + languages ── */}
        <div className="card">
          <p className="eyebrow">Conversion</p>
          <h2 className="section-title mt-0.5 mb-5">From Verdict to Booking</h2>
          <div className="space-y-3">
            {[
              {
                label: "Verdicts issued",
                value: overview?.funnel.verdicts ?? 0,
              },
              {
                label: "Bookable (non-emergency)",
                value: overview?.funnel.bookable ?? 0,
              },
              {
                label: "Chose instant consult / booking",
                value:
                  (overview?.funnel.instantConsult ?? 0) +
                  (overview?.funnel.booked ?? 0),
              },
              {
                label: "Appointments linked",
                value: overview?.funnel.linkedAppointments ?? 0,
              },
              { label: "Dismissed", value: overview?.funnel.dismissed ?? 0 },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border-b border-gray-50 pb-2.5"
              >
                <span className="text-body-sm text-gray-600">{row.label}</span>
                <span className="font-bold tabular-nums text-ink">
                  {row.value}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-body-sm font-semibold text-ink">
                Doctor feedback
              </span>
              <span className="text-body-sm tabular-nums text-gray-600">
                {overview?.accuracy.agree ?? 0} 👍 ·{" "}
                {overview?.accuracy.disagree ?? 0} 👎
              </span>
            </div>
          </div>

          <p className="eyebrow mt-7">Languages (30d)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(overview?.languages ?? {})
              .filter(([, n]) => n > 0)
              .map(([code, n]) => (
                <span
                  key={code}
                  className="inline-flex rounded-full bg-skyblue-50 px-3 py-1.5 text-micro font-bold text-navy-mid ring-1 ring-inset ring-skyblue/30"
                >
                  {LANGUAGE_LABELS[code] ?? code} ·{" "}
                  {langTotal ? Math.round((n / langTotal) * 100) : 0}%
                </span>
              ))}
            {langTotal === 0 && overview ? (
              <span className="text-caption text-gray-400">
                No sessions yet
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Leenah → Care Programs (suggestion conversion) ── */}
      <div className="card">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Long-term care</p>
            <h2 className="section-title mt-0.5">
              Leenah → Care Programs (30d)
            </h2>
            <p className="mt-1 text-body-sm text-gray-500">
              Verdicts that suggested a care program, and how many patients
              enrolled afterwards.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-skyblue-50 px-3 py-1.5 text-micro font-bold text-navy-mid ring-1 ring-inset ring-skyblue/30">
              {overview?.programSuggestions?.suggested ?? 0} suggested
            </span>
            <span className="inline-flex rounded-full bg-teal-50 px-3 py-1.5 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20">
              {overview?.programSuggestions?.converted ?? 0} enrolled
              {overview?.programSuggestions?.conversionRate != null
                ? ` · ${overview.programSuggestions.conversionRate}%`
                : ""}
            </span>
          </div>
        </div>
        {(overview?.programSuggestions?.byProgram ?? []).length === 0 ? (
          <p className="py-4 text-center text-gray-400">
            No program suggestions in the last 30 days
          </p>
        ) : (
          <div className="space-y-3">
            {(overview?.programSuggestions?.byProgram ?? []).map((p) => {
              const pct = p.suggested
                ? Math.round((p.converted / p.suggested) * 100)
                : 0;
              return (
                <div key={p.programId}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-body-sm font-semibold text-ink">
                      {p.name || "Unknown program"}
                    </span>
                    <span className="text-body-sm tabular-nums text-gray-500">
                      {p.converted}/{p.suggested} enrolled · {pct}%
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-teal"
                      style={{
                        width: `${Math.max(p.converted > 0 ? 3 : 0, pct)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
