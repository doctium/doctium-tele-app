"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import type {
  JobPosting,
  JobTeam,
  JobType,
  WorkMode,
  JobStatus,
} from "@/lib/media-types";

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
];

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "ON_SITE", label: "On-site" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "REMOTE", label: "Remote" },
];

const JOB_STATUSES: JobStatus[] = ["DRAFT", "OPEN", "CLOSED"];

const STATUS_VARIANT: Record<
  JobStatus,
  "success" | "default" | "warning" | "info" | "danger"
> = {
  OPEN: "success",
  DRAFT: "default",
  CLOSED: "warning",
};

const teamName = (t: JobPosting["team"]) =>
  t && typeof t === "object" && "name" in t ? t.name : "";

const jobTypeLabel = (v: JobType) =>
  JOB_TYPES.find((t) => t.value === v)?.label ?? v;
const workModeLabel = (v: WorkMode) =>
  WORK_MODES.find((w) => w.value === v)?.label ?? v;

type Form = {
  id?: string;
  title: string;
  slug: string;
  teamId: string;
  location: string;
  jobType: JobType;
  workMode: WorkMode;
  status: JobStatus;
  summary: string;
  bodyMd: string;
  salaryNote: string;
  postedAt: string;
  closesAt: string;
  metaTitle: string;
  metaDescription: string;
  noindex: boolean;
};

const EMPTY: Form = {
  title: "",
  slug: "",
  teamId: "",
  location: "",
  jobType: "FULL_TIME",
  workMode: "ON_SITE",
  status: "DRAFT",
  summary: "",
  bodyMd: "",
  salaryNote: "",
  postedAt: "",
  closesAt: "",
  metaTitle: "",
  metaDescription: "",
  noindex: false,
};

const toLocalInput = (iso?: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

export default function JobsPage() {
  const [rows, setRows] = useState<JobPosting[]>([]);
  const [teams, setTeams] = useState<JobTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = (await apiClient
      .get("/admin/media/jobs")
      .catch(() => ({ data: [] }))) as { data: JobPosting[] };
    setRows(res.data ?? []);
    setLoading(false);
  };

  const loadTeams = async () => {
    const res = (await apiClient
      .get("/admin/media/teams")
      .catch(() => ({ data: [] }))) as { data: JobTeam[] };
    setTeams(res.data ?? []);
  };

  useEffect(() => {
    load();
    loadTeams();
  }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = async (r: JobPosting) => {
    const res = (await apiClient.get(`/admin/media/jobs/${r.id}`)) as {
      data: JobPosting;
    };
    const j = res.data ?? r;
    setForm({
      id: j.id,
      title: j.title ?? "",
      slug: j.slug ?? "",
      teamId: j.teamId ?? "",
      location: j.location ?? "",
      jobType: j.jobType,
      workMode: j.workMode,
      status: j.status,
      summary: j.summary ?? "",
      bodyMd: j.bodyMd ?? "",
      salaryNote: j.salaryNote ?? "",
      postedAt: toLocalInput(j.postedAt),
      closesAt: toLocalInput(j.closesAt),
      metaTitle: j.metaTitle ?? "",
      metaDescription: j.metaDescription ?? "",
      noindex: j.noindex ?? false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job posting?")) return;
    await apiClient.delete(`/admin/media/jobs/${id}`);
    toast.success("Job posting deleted");
    load();
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    const payload = {
      title: form.title,
      slug: form.slug.trim() || undefined,
      teamId: form.teamId || null,
      location: form.location,
      jobType: form.jobType,
      workMode: form.workMode,
      status: form.status,
      summary: form.summary,
      bodyMd: form.bodyMd,
      salaryNote: form.salaryNote,
      postedAt: form.postedAt ? new Date(form.postedAt).toISOString() : null,
      closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      noindex: form.noindex,
    };
    try {
      if (form.id) {
        await apiClient.patch(`/admin/media/jobs/${form.id}`, payload);
        toast.success("Job posting updated");
      } else {
        await apiClient.post("/admin/media/jobs", payload);
        toast.success("Job posting created");
      }
      setShowModal(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<JobPosting>[] = [
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink truncate max-w-[220px]">
            {r.title}
          </span>
          {teamName(r.team) && (
            <span className="text-xs text-gray-500">{teamName(r.team)}</span>
          )}
        </div>
      ),
    },
    {
      key: "jobType",
      header: "Type",
      render: (r) => (
        <span className="text-sm text-gray-500">{jobTypeLabel(r.jobType)}</span>
      ),
    },
    {
      key: "workMode",
      header: "Work mode",
      render: (r) => (
        <span className="text-sm text-gray-500">
          {workModeLabel(r.workMode)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge label={r.status} variant={STATUS_VARIANT[r.status]} />
      ),
    },
    {
      key: "applications",
      header: "Applications",
      render: (r) => (
        <span className="text-sm text-gray-500">
          {r._count?.applications ?? 0}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (r) => (
        <span className="text-xs text-gray-500">{fmtDate(r.updatedAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Job Postings</h1>
        <button
          onClick={openAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Job
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Careers listings for the website. Set a job to OPEN to publish it; DRAFT
        and CLOSED roles are hidden from applicants.
      </p>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No job postings yet"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit Job" : "Add Job"}
        maxWidth="640px"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="e.g. Senior Backend Engineer"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">Slug (optional)</label>
            <input
              className="input"
              placeholder="auto-generated from title"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Team</label>
              <select
                className="input"
                value={form.teamId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, teamId: e.target.value }))
                }
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Location</label>
              <input
                className="input"
                placeholder="e.g. Lagos, Nigeria"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Job type</label>
              <select
                className="input"
                value={form.jobType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    jobType: e.target.value as JobType,
                  }))
                }
              >
                {JOB_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Work mode</label>
              <select
                className="input"
                value={form.workMode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    workMode: e.target.value as WorkMode,
                  }))
                }
              >
                {WORK_MODES.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as JobStatus,
                  }))
                }
              >
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Summary</label>
            <input
              className="input"
              placeholder="Short one-line summary of the role"
              value={form.summary}
              onChange={(e) =>
                setForm((f) => ({ ...f, summary: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">
              Description (what you&apos;ll do / looking for / get)
            </label>
            <MarkdownEditor
              value={form.bodyMd}
              onChange={(v) => setForm((f) => ({ ...f, bodyMd: v }))}
              placeholder="## What you'll do&#10;## What we're looking for&#10;## What you'll get"
              rows={12}
            />
          </div>

          <div>
            <label className="label">Salary note</label>
            <input
              className="input"
              placeholder="e.g. Competitive, based on experience"
              value={form.salaryNote}
              onChange={(e) =>
                setForm((f) => ({ ...f, salaryNote: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Posted (optional)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.postedAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, postedAt: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Closes (optional)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.closesAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, closesAt: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              SEO
            </p>
            <div>
              <label className="label">Meta title</label>
              <input
                className="input"
                value={form.metaTitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, metaTitle: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Meta description</label>
              <textarea
                className="input"
                rows={2}
                value={form.metaDescription}
                onChange={(e) =>
                  setForm((f) => ({ ...f, metaDescription: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="label mb-0">
                No-index (hide from search engines)
              </label>
              <Toggle
                checked={form.noindex}
                onChange={() => setForm((f) => ({ ...f, noindex: !f.noindex }))}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowModal(false)}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? "Saving..." : form.id ? "Save changes" : "Add Job"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
