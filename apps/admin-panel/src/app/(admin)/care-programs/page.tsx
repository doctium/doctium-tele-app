"use client";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Gauge,
  HeartPulse,
  NotebookPen,
} from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Toggle } from "@/components/ui/Toggle";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";

interface VitalConfig {
  type: string;
}
interface Program {
  id: string;
  code: string;
  name: string;
  condition: string;
  vitals: VitalConfig[];
  checkInDays: number;
  price: number;
  isActive: boolean;
  activeEnrollments: number;
  totalEnrollments: number;
}
interface Outcome {
  programId: string;
  name: string;
  vital: string;
  patients: number;
  avgFirst: number | null;
  avgLatest: number | null;
}
interface Overview {
  activeEnrollments: number;
  readings30d: number;
  alerts30d: { warning: number; critical: number };
  openAlerts: number;
  avgAdherence: number | null;
  goals: { active: number; achieved: number; missed: number };
  programs: Program[];
  outcomes: Outcome[];
  vitalCatalog: Record<
    string,
    { label: string; unit: string; lowIsBad: boolean }
  >;
}
interface ScdOutcomes {
  program: string;
  activePatients: number;
  totalEnrollments: number;
  byGenotype: Record<string, number>;
  crisisStats: {
    count90d: number;
    perActivePatient90d: number;
    hospitalizations90d: number;
    topTriggers: { trigger: string; count: number }[];
  };
  riskDistribution: Record<string, number>;
  riskTrend: { week: string; avgScore: number; assessments: number }[];
  titration: {
    onHydroxyurea: number;
    avgDoseMg: number | null;
    cbcCompliancePercent: number | null;
    flaggedLabs90d: number;
  };
  readings30d: number;
  aiScribe: { totalDraftedNotes: number; bySource: Record<string, number> };
}

export default function CareProgramsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [scd, setScd] = useState<ScdOutcomes | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    apiClient
      .get("/admin/care-programs/overview")
      .then((r) => setOverview((r as { data: Overview }).data))
      .catch(() => {})
      .finally(() => setLoading(false));
    apiClient
      .get("/admin/care-programs/scd-outcomes")
      .then((r) => setScd((r as { data: ScdOutcomes }).data))
      .catch(() => setScd(null));
  };
  useEffect(load, []);

  const downloadScdCsv = async () => {
    try {
      const csv = (await apiClient.get(
        "/admin/care-programs/scd-outcomes.csv",
        {
          responseType: "blob",
        },
      )) as unknown as Blob;
      const url = URL.createObjectURL(csv);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scd-outcomes.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const toggleActive = async (p: Program, v: boolean) => {
    // optimistic flip + revert on failure (same pattern as account blocking)
    setOverview((o) =>
      o
        ? {
            ...o,
            programs: o.programs.map((x) =>
              x.id === p.id ? { ...x, isActive: v } : x,
            ),
          }
        : o,
    );
    try {
      await apiClient.patch(`/admin/care-programs/${p.id}`, { isActive: v });
    } catch {
      setOverview((o) =>
        o
          ? {
              ...o,
              programs: o.programs.map((x) =>
                x.id === p.id ? { ...x, isActive: !v } : x,
              ),
            }
          : o,
      );
    }
  };

  const programCols: Column<Program>[] = [
    {
      key: "name",
      header: "Program",
      render: (r) => (
        <div>
          <p className="font-semibold text-ink">{r.name}</p>
          <p className="text-caption text-gray-400">{r.condition || r.code}</p>
        </div>
      ),
    },
    {
      key: "vitals",
      header: "Tracked vitals",
      render: (r) => (
        <div className="flex flex-wrap gap-1.5">
          {(r.vitals ?? []).map((v) => (
            <span
              key={v.type}
              className="inline-flex rounded-full bg-skyblue-50 px-2 py-0.5 text-micro font-bold text-navy-mid ring-1 ring-inset ring-skyblue/30"
            >
              {overview?.vitalCatalog?.[v.type]?.label ?? v.type}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (r) =>
        r.price > 0 ? (
          <span className="tabular-nums text-gray-600">
            {formatMoney(r.price)}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20">
            Free
          </span>
        ),
    },
    {
      key: "activeEnrollments",
      header: "Active patients",
      render: (r) => (
        <span className="font-bold tabular-nums text-ink">
          {r.activeEnrollments}
          <span className="font-medium text-gray-400">
            {" "}
            / {r.totalEnrollments}
          </span>
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Active",
      render: (r) => (
        <Toggle checked={r.isActive} onChange={(v) => toggleActive(r, v)} />
      ),
    },
  ];

  const outcomeCols: Column<Outcome>[] = [
    {
      key: "name",
      header: "Program",
      render: (r) => <span className="font-semibold text-ink">{r.name}</span>,
    },
    {
      key: "vital",
      header: "Primary vital",
      render: (r) => (
        <span className="text-gray-600">
          {overview?.vitalCatalog?.[r.vital]?.label ?? r.vital}
        </span>
      ),
    },
    {
      key: "patients",
      header: "Patients measured",
      render: (r) => (
        <span className="tabular-nums text-gray-600">{r.patients}</span>
      ),
    },
    {
      key: "delta",
      header: "First → latest (avg)",
      render: (r) => {
        if (r.avgFirst == null || r.avgLatest == null)
          return <span className="text-gray-300">Not enough data</span>;
        const unit = overview?.vitalCatalog?.[r.vital]?.unit ?? "";
        const lowIsBad = overview?.vitalCatalog?.[r.vital]?.lowIsBad ?? false;
        const improved = lowIsBad
          ? r.avgLatest >= r.avgFirst
          : r.avgLatest <= r.avgFirst;
        return (
          <span className="tabular-nums">
            {r.avgFirst} → {r.avgLatest} {unit}{" "}
            <span
              className={
                improved
                  ? "font-bold text-teal-600"
                  : "font-bold text-orange-600"
              }
            >
              {improved ? "▲ improving" : "▼ watch"}
            </span>
          </span>
        );
      },
    },
  ];

  const statCards = [
    {
      title: "Active Enrollments",
      value: overview?.activeEnrollments ?? "—",
      icon: HeartPulse,
      color: "green" as const,
    },
    {
      title: "Avg Adherence (7d)",
      value: overview?.avgAdherence != null ? `${overview.avgAdherence}%` : "—",
      icon: Gauge,
      color: "blue" as const,
    },
    {
      title: "Readings (30d)",
      value: overview?.readings30d ?? "—",
      icon: NotebookPen,
      color: "purple" as const,
    },
    {
      title: "Warnings (30d)",
      value: overview?.alerts30d?.warning ?? "—",
      icon: BellRing,
      color: "orange" as const,
    },
    {
      title: "Critical (30d)",
      value: overview?.alerts30d?.critical ?? "—",
      icon: AlertTriangle,
      color: "red" as const,
    },
    {
      title: "Open Alerts",
      value: overview?.openAlerts ?? "—",
      icon: Activity,
      color: "purple" as const,
    },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow">Long-term care</p>
        <h1 className="page-title mt-1">Care Programs</h1>
        <p className="mt-1 text-body-md text-gray-500">
          Chronic disease management — enrollment, vital-sign monitoring and
          outcome trends across the platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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

      <div className="card">
        <div className="mb-5">
          <p className="eyebrow">Catalog</p>
          <h2 className="section-title mt-0.5">Programs</h2>
        </div>
        <DataTable
          columns={programCols}
          data={overview?.programs ?? []}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No programs — run scripts/seed-care-programs.cjs"
        />
      </div>

      <div className="card">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow">Outcomes</p>
            <h2 className="section-title mt-0.5">Is care working?</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-skyblue-50 px-3 py-1.5 text-micro font-bold text-navy-mid ring-1 ring-inset ring-skyblue/30">
              {overview?.goals?.active ?? 0} goals active
            </span>
            <span className="inline-flex rounded-full bg-teal-50 px-3 py-1.5 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20">
              {overview?.goals?.achieved ?? 0} achieved
            </span>
            <span className="inline-flex rounded-full bg-orange-50 px-3 py-1.5 text-micro font-bold text-orange-600 ring-1 ring-inset ring-orange-500/20">
              {overview?.goals?.missed ?? 0} missed
            </span>
          </div>
        </div>
        <div className="mb-5">
          <p className="mt-1 text-body-sm text-gray-500">
            Average first vs latest reading of each program&apos;s primary
            vital, across patients with two or more readings — the headline
            metric for insurer and corporate reporting.
          </p>
        </div>
        <DataTable
          columns={outcomeCols}
          data={overview?.outcomes ?? []}
          keyExtractor={(r) => r.programId}
          loading={loading}
          emptyMessage="Outcome deltas appear once patients log repeat readings"
        />
      </div>

      {scd ? (
        <div className="card">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">Sickle cell — n-of-1 program</p>
              <h2 className="section-title mt-0.5">SCD outcomes</h2>
              <p className="mt-1 text-body-sm text-gray-500">
                Genotype-stratified protocols, crisis burden, live risk and
                hydroxyurea monitoring — the investor and payer story.
              </p>
            </div>
            <button onClick={downloadScdCsv} className="btn-primary shrink-0">
              Outcomes report (CSV)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-100 p-4">
              <p className="text-micro font-bold uppercase tracking-wide text-gray-400">
                Active patients
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
                {scd.activePatients}
              </p>
              <p className="mt-1 text-caption text-gray-500">
                {Object.entries(scd.byGenotype)
                  .map(([g, n]) => `${g}: ${n}`)
                  .join(" · ") || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 p-4">
              <p className="text-micro font-bold uppercase tracking-wide text-gray-400">
                Crises (90d)
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
                {scd.crisisStats.count90d}
              </p>
              <p className="mt-1 text-caption text-gray-500">
                {scd.crisisStats.perActivePatient90d}/patient ·{" "}
                {scd.crisisStats.hospitalizations90d} hospitalized
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 p-4">
              <p className="text-micro font-bold uppercase tracking-wide text-gray-400">
                Risk today
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
                {(scd.riskDistribution.HIGH ?? 0) +
                  (scd.riskDistribution.CRITICAL ?? 0)}{" "}
                <span className="text-body-sm font-semibold text-gray-400">
                  elevated
                </span>
              </p>
              <p className="mt-1 text-caption text-gray-500">
                {Object.entries(scd.riskDistribution)
                  .map(([l, n]) => `${l.toLowerCase()}: ${n}`)
                  .join(" · ")}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 p-4">
              <p className="text-micro font-bold uppercase tracking-wide text-gray-400">
                Hydroxyurea
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
                {scd.titration.onHydroxyurea}
              </p>
              <p className="mt-1 text-caption text-gray-500">
                {scd.titration.avgDoseMg != null
                  ? `avg ${scd.titration.avgDoseMg} mg/day · `
                  : ""}
                {scd.titration.cbcCompliancePercent != null
                  ? `CBC compliance ${scd.titration.cbcCompliancePercent}%`
                  : "no CBC data yet"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {scd.crisisStats.topTriggers.length ? (
              <span className="inline-flex rounded-full bg-orange-50 px-3 py-1.5 text-micro font-bold text-orange-600 ring-1 ring-inset ring-orange-500/20">
                Top triggers:{" "}
                {scd.crisisStats.topTriggers
                  .map((t) => `${t.trigger} (${t.count})`)
                  .join(", ")}
              </span>
            ) : null}
            <span className="inline-flex rounded-full bg-skyblue-50 px-3 py-1.5 text-micro font-bold text-navy-mid ring-1 ring-inset ring-skyblue/30">
              {scd.readings30d} readings (30d)
            </span>
            <span className="inline-flex rounded-full bg-teal-50 px-3 py-1.5 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20">
              {scd.aiScribe.totalDraftedNotes} AI-drafted notes platform-wide
            </span>
            {scd.titration.flaggedLabs90d > 0 ? (
              <span className="inline-flex rounded-full bg-orange-50 px-3 py-1.5 text-micro font-bold text-orange-600 ring-1 ring-inset ring-orange-500/20">
                {scd.titration.flaggedLabs90d} flagged labs (90d)
              </span>
            ) : null}
          </div>

          {scd.riskTrend.length > 1 ? (
            <p className="mt-4 text-caption text-gray-500">
              Avg risk by week:{" "}
              {scd.riskTrend
                .slice(-8)
                .map((w) => `${w.week.slice(5)} → ${w.avgScore}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
