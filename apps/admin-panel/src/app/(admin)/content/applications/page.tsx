"use client";
import { useEffect, useState } from "react";
import { Eye, Download, FileDown, ExternalLink } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";
import {
  JobApplication,
  ApplicationStatus,
  APPLICATION_STATUSES,
} from "@/lib/media-types";

const STATUS_VARIANT: Record<
  ApplicationStatus,
  "success" | "warning" | "danger" | "info" | "default"
> = {
  NEW: "info",
  REVIEWING: "warning",
  INTERVIEW: "info",
  OFFER: "success",
  HIRED: "success",
  REJECTED: "danger",
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

export default function ApplicationsPage() {
  const [rows, setRows] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ApplicationStatus | "">("");

  const [showModal, setShowModal] = useState(false);
  const [current, setCurrent] = useState<JobApplication | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>("NEW");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (status?: ApplicationStatus | "") => {
    setLoading(true);
    const qs = status ? `?status=${status}` : "";
    const res = (await apiClient
      .get(`/admin/media/applications${qs}`)
      .catch(() => ({ data: [] }))) as { data: JobApplication[] };
    setRows(res.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load(filter);
  }, [filter]);

  const openView = async (app: JobApplication) => {
    // Fetch full record (the list may be a lighter projection).
    const res = (await apiClient
      .get(`/admin/media/applications/${app.id}`)
      .catch(() => ({ data: app }))) as { data: JobApplication };
    const full = res.data ?? app;
    setCurrent(full);
    setStatus(full.status);
    setAdminNotes(full.adminNotes ?? "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await apiClient.patch(`/admin/media/applications/${current.id}/status`, {
        status,
        adminNotes,
      });
      toast.success("Application updated");
      setShowModal(false);
      load(filter);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!rows.length) return toast.error("Nothing to export");
    downloadCsv(
      "applications",
      rows.map((r) => ({
        name: r.fullName,
        email: r.email,
        job: r.job?.title ?? "",
        status: r.status,
        createdAt: r.createdAt,
      })),
    );
  };

  const cols: Column<JobApplication>[] = [
    {
      key: "fullName",
      header: "Applicant",
      render: (r) => (
        <span className="font-medium text-ink truncate max-w-[180px] block">
          {r.fullName}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (r) => (
        <span className="text-sm text-gray-500 truncate max-w-[200px] block">
          {r.email}
        </span>
      ),
    },
    {
      key: "job",
      header: "Position",
      render: (r) => (
        <span className="text-sm text-gray-500 truncate max-w-[200px] block">
          {r.job?.title ?? "—"}
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
      key: "createdAt",
      header: "Applied",
      render: (r) => (
        <span className="text-sm text-gray-500">{fmtDate(r.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "56px",
      render: (r) => (
        <button
          onClick={() => openView(r)}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
          title="View application"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Applications</h1>
        <button
          onClick={exportCsv}
          className="btn-primary flex items-center gap-2"
        >
          <FileDown size={16} /> Export CSV
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Review job applications submitted through the careers site and move them
        through your hiring workflow.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter("")}
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            filter === ""
              ? "bg-ink text-white"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          All
        </button>
        {APPLICATION_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              filter === s
                ? "bg-ink text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No applications found"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Application details"
      >
        {current && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Full name</label>
                <p className="text-ink font-medium">{current.fullName}</p>
              </div>
              <div>
                <label className="label">Applied for</label>
                <p className="text-ink font-medium">
                  {current.job?.title ?? "—"}
                </p>
              </div>
              <div>
                <label className="label">Email</label>
                <a
                  href={`mailto:${current.email}`}
                  className="text-ink break-all hover:underline"
                >
                  {current.email}
                </a>
              </div>
              <div>
                <label className="label">Phone</label>
                <p className="text-ink">{current.phone || "—"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {current.linkedinUrl && (
                <a
                  href={current.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost flex items-center gap-2"
                >
                  <ExternalLink size={14} /> LinkedIn
                </a>
              )}
              {current.portfolioUrl && (
                <a
                  href={current.portfolioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost flex items-center gap-2"
                >
                  <ExternalLink size={14} /> Portfolio
                </a>
              )}
              {current.cvUrl && (
                <a
                  href={current.cvUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost flex items-center gap-2"
                >
                  <Download size={14} /> Download CV
                </a>
              )}
            </div>

            {current.coverNote && (
              <div>
                <label className="label">Cover note</label>
                <p className="text-sm text-gray-500 whitespace-pre-wrap">
                  {current.coverNote}
                </p>
              </div>
            )}

            <div>
              <label className="label">Applied on</label>
              <p className="text-sm text-gray-500">
                {fmtDate(current.createdAt)}
              </p>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as ApplicationStatus)
                  }
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Admin notes</label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Internal notes about this candidate..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="btn-ghost flex-1"
              >
                Close
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
