"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Download,
  Gauge,
  HeartPulse,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { StatsCard } from "@/components/ui/StatsCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { Toggle } from "@/components/ui/Toggle";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useAdminAuth } from "@/lib/auth-context";

interface Member {
  id: string;
  externalRef: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    mobile: string;
    image: string;
  };
}
interface Sponsorship {
  id: string;
  seats: number;
  seatsUsed: number;
  isActive: boolean;
  endsAt: string | null;
  program: { id: string; name: string; price: number };
}
interface OutcomeRow {
  enrollmentId: string;
  member: string;
  account: string;
  program: string;
  status: string;
  startedAt: string;
  primaryVital: string | null;
  firstReading: number | null;
  latestReading: number | null;
  adherencePercent: number | null;
  openAlerts: number;
  goalsAchieved: number;
}
interface OrgDetail {
  id: string;
  name: string;
  type: string;
  status: "ACTIVE" | "SUSPENDED";
  contactName: string;
  contactEmail: string;
  members: Member[];
  sponsorships: Sponsorship[];
  enrollments: OutcomeRow[];
  summary: {
    members: number;
    sponsoredEnrollments: number;
    avgAdherence: number | null;
    openAlerts: number;
    goalsAchieved: number;
  };
}
interface Program {
  id: string;
  name: string;
  price: number;
}

export default function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAdminAuth();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [identifier, setIdentifier] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [sponsorProgramId, setSponsorProgramId] = useState("");
  const [seats, setSeats] = useState("10");
  const [busy, setBusy] = useState(false);
  const canManage = can("enterprise.manage");

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .get(`/admin/organizations/${id}`)
      .then((r) => setOrg((r as { data: OrgDetail }).data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    load();
    apiClient
      .get("/admin/care-programs")
      .then((r) => setPrograms((r as { data: Program[] }).data ?? []))
      .catch(() => {});
  }, [load]);

  const addMember = async () => {
    if (!identifier.trim()) return;
    setBusy(true);
    try {
      await apiClient.post(`/admin/organizations/${id}/members`, {
        identifier: identifier.trim(),
        externalRef: externalRef.trim() || undefined,
      });
      setIdentifier("");
      setExternalRef("");
      load();
    } catch {
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      await apiClient.delete(`/admin/organizations/${id}/members/${memberId}`);
      load();
    } catch {}
  };

  const upsertSponsorship = async (
    programId: string,
    nSeats: number,
    isActive?: boolean,
  ) => {
    try {
      await apiClient.post(`/admin/organizations/${id}/sponsorships`, {
        programId,
        seats: nSeats,
        isActive,
      });
      load();
    } catch {}
  };

  const toggleStatus = async () => {
    if (!org) return;
    try {
      await apiClient.patch(`/admin/organizations/${id}`, {
        status: org.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      });
      load();
    } catch {}
  };

  const downloadCsv = async () => {
    try {
      const csv = (await apiClient.get(
        `/admin/organizations/${id}/report.csv`,
        {
          responseType: "blob",
        },
      )) as unknown as Blob;
      const url = URL.createObjectURL(csv);
      const a = document.createElement("a");
      a.href = url;
      a.download = `outcomes-${org?.name ?? "organization"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const memberCols: Column<Member>[] = [
    {
      key: "user",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.user.image} name={r.user.name} size={32} />
          <div>
            <p>
              <PatientLink
                id={r.user.id}
                name={r.user.name}
                className="font-semibold text-ink"
              />
            </p>
            <p className="text-caption text-gray-400">
              {r.user.email || r.user.mobile}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "externalRef",
      header: "Ref",
      render: (r) => (
        <span className="text-gray-600">{r.externalRef || "—"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) =>
        canManage ? (
          <button
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            onClick={() => removeMember(r.id)}
            title="Remove member"
          >
            <Trash2 size={15} />
          </button>
        ) : null,
    },
  ];

  const sponsorshipCols: Column<Sponsorship>[] = [
    {
      key: "program",
      header: "Program",
      render: (r) => (
        <div>
          <p className="font-semibold text-ink">{r.program.name}</p>
          <p className="text-caption text-gray-400">
            {r.program.price > 0 ? formatMoney(r.program.price) : "Free"} / seat
          </p>
        </div>
      ),
    },
    {
      key: "seats",
      header: "Seats",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
            <div
              className={
                r.seatsUsed >= r.seats
                  ? "h-full rounded-full bg-gradient-to-r from-[#F7A93D] to-[#E07B1A]"
                  : "h-full rounded-full bg-gradient-teal"
              }
              style={{
                width: `${Math.min(100, (r.seatsUsed / Math.max(1, r.seats)) * 100)}%`,
              }}
            />
          </div>
          <span className="tabular-nums text-gray-600">
            {r.seatsUsed} / {r.seats}
          </span>
        </div>
      ),
    },
    {
      key: "isActive",
      header: "Active",
      render: (r) => (
        <Toggle
          checked={r.isActive}
          disabled={!canManage}
          onChange={(v) => upsertSponsorship(r.program.id, r.seats, v)}
        />
      ),
    },
  ];

  const outcomeCols: Column<OutcomeRow>[] = [
    {
      key: "member",
      header: "Member",
      render: (r) => (
        <div>
          <p className="font-semibold text-ink">{r.member || "—"}</p>
          <p className="text-caption text-gray-400">{r.account}</p>
        </div>
      ),
    },
    {
      key: "program",
      header: "Program",
      render: (r) => <span className="text-gray-600">{r.program}</span>,
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
    {
      key: "delta",
      header: "First → latest",
      render: (r) =>
        r.firstReading == null || r.latestReading == null ? (
          <span className="text-gray-300">—</span>
        ) : (
          <span className="tabular-nums text-gray-600">
            {r.firstReading} → {r.latestReading}
          </span>
        ),
    },
    {
      key: "adherencePercent",
      header: "Adherence",
      render: (r) =>
        r.adherencePercent == null ? (
          <span className="text-gray-300">—</span>
        ) : (
          <span
            className={
              r.adherencePercent >= 70
                ? "font-bold tabular-nums text-teal-600"
                : r.adherencePercent >= 40
                  ? "font-bold tabular-nums text-orange-600"
                  : "font-bold tabular-nums text-red-600"
            }
          >
            {r.adherencePercent}%
          </span>
        ),
    },
    {
      key: "openAlerts",
      header: "Alerts",
      render: (r) => (
        <span className="tabular-nums text-gray-600">{r.openAlerts}</span>
      ),
    },
    {
      key: "goalsAchieved",
      header: "Goals hit",
      render: (r) => (
        <span className="tabular-nums text-gray-600">{r.goalsAchieved}</span>
      ),
    },
  ];

  const statCards = [
    {
      title: "Members",
      value: org?.summary.members ?? "—",
      icon: Users,
      color: "blue" as const,
    },
    {
      title: "Sponsored Enrollments",
      value: org?.summary.sponsoredEnrollments ?? "—",
      icon: HeartPulse,
      color: "green" as const,
    },
    {
      title: "Avg Adherence",
      value:
        org?.summary.avgAdherence != null
          ? `${org.summary.avgAdherence}%`
          : "—",
      icon: Gauge,
      color: "purple" as const,
    },
    {
      title: "Open Alerts",
      value: org?.summary.openAlerts ?? "—",
      icon: Building2,
      color: "orange" as const,
    },
    {
      title: "Goals Achieved",
      value: org?.summary.goalsAchieved ?? "—",
      icon: Target,
      color: "red" as const,
    },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/organizations"
            className="mb-2 inline-flex items-center gap-1.5 text-caption font-bold text-gray-400 hover:text-ink"
          >
            <ArrowLeft size={14} /> Organizations
          </Link>
          <h1 className="page-title flex items-center gap-3">
            {org?.name ?? "…"}
            {org ? (
              <span
                className={
                  org.status === "ACTIVE"
                    ? "inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20"
                    : "inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-micro font-bold text-gray-500 ring-1 ring-inset ring-gray-300"
                }
              >
                {org.status === "ACTIVE" ? "Active" : "Suspended"}
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-body-md text-gray-500">
            {org?.type || "—"}
            {org?.contactName ? ` · ${org.contactName}` : ""}
            {org?.contactEmail ? ` · ${org.contactEmail}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={downloadCsv}>
            <Download size={15} /> Outcomes report (CSV)
          </button>
          {canManage && org ? (
            <button className="btn-outline" onClick={toggleStatus}>
              {org.status === "ACTIVE" ? "Suspend" : "Reactivate"}
            </button>
          ) : null}
        </div>
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

      {/* ── Sponsorships ── */}
      <div className="card">
        <div className="mb-5">
          <p className="eyebrow">Coverage</p>
          <h2 className="section-title mt-0.5">Sponsored Programs</h2>
        </div>
        {canManage ? (
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="min-w-56">
              <label className="label">Program</label>
              <select
                className="input"
                value={sponsorProgramId}
                onChange={(e) => setSponsorProgramId(e.target.value)}
              >
                <option value="">Select a program…</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.price > 0 ? ` (${formatMoney(p.price)})` : " (free)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="label">Seats</label>
              <input
                className="input"
                type="number"
                min={1}
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              />
            </div>
            <button
              className="btn-primary"
              disabled={!sponsorProgramId || !(parseInt(seats, 10) > 0)}
              onClick={() =>
                upsertSponsorship(sponsorProgramId, parseInt(seats, 10))
              }
            >
              Add / update seats
            </button>
          </div>
        ) : null}
        <DataTable
          columns={sponsorshipCols}
          data={org?.sponsorships ?? []}
          keyExtractor={(r) => r.id}
          loading={!org}
          emptyMessage="No sponsored programs yet"
        />
      </div>

      {/* ── Members ── */}
      <div className="card">
        <div className="mb-5">
          <p className="eyebrow">Roster</p>
          <h2 className="section-title mt-0.5">Members</h2>
        </div>
        {canManage ? (
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="min-w-64">
              <label className="label">Patient email or mobile</label>
              <input
                className="input"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 08000000002"
              />
            </div>
            <div className="w-44">
              <label className="label">Staff / enrollee ref</label>
              <input
                className="input"
                value={externalRef}
                onChange={(e) => setExternalRef(e.target.value)}
                placeholder="optional"
              />
            </div>
            <button
              className="btn-primary"
              onClick={addMember}
              disabled={busy || !identifier.trim()}
            >
              Add member
            </button>
          </div>
        ) : null}
        <DataTable
          columns={memberCols}
          data={org?.members ?? []}
          keyExtractor={(r) => r.id}
          loading={!org}
          emptyMessage="No members attached yet"
        />
      </div>

      {/* ── Outcomes ── */}
      <div className="card">
        <div className="mb-5">
          <p className="eyebrow">Outcomes</p>
          <h2 className="section-title mt-0.5">Sponsored Enrollments</h2>
          <p className="mt-1 text-body-sm text-gray-500">
            Per-member utilization and progress — exactly what the CSV report
            contains.
          </p>
        </div>
        <DataTable
          columns={outcomeCols}
          data={org?.enrollments ?? []}
          keyExtractor={(r) => r.enrollmentId}
          loading={!org}
          emptyMessage="No sponsored enrollments yet"
        />
      </div>
    </div>
  );
}
