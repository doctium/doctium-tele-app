"use client";
import { useEffect, useState } from "react";
import { Eye, Download, Mail } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { downloadCsv } from "@/lib/csv";
import {
  type ContactEnquiry,
  type EnquiryStatus,
  ENQUIRY_STATUSES,
} from "@/lib/media-types";

const STATUS_VARIANT: Record<
  EnquiryStatus,
  "info" | "warning" | "success" | "default"
> = {
  NEW: "info",
  CONTACTED: "warning",
  QUALIFIED: "success",
  CLOSED: "default",
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default function EnquiriesPage() {
  const [rows, setRows] = useState<ContactEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | EnquiryStatus>("ALL");
  const [active, setActive] = useState<ContactEnquiry | null>(null);
  const [statusDraft, setStatusDraft] = useState<EnquiryStatus>("NEW");
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const qs = filter === "ALL" ? "" : `?status=${filter}`;
    const res = (await apiClient
      .get(`/admin/media/enquiries${qs}`)
      .catch(() => ({ data: [] }))) as { data: ContactEnquiry[] };
    setRows(res.data ?? []);
    setLoading(false);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openView = (e: ContactEnquiry) => {
    setActive(e);
    setStatusDraft(e.status);
    setNotesDraft(e.adminNotes ?? "");
  };

  const saveStatus = async () => {
    if (!active) return;
    setSaving(true);
    try {
      await apiClient.patch(`/admin/media/enquiries/${active.id}/status`, {
        status: statusDraft,
        adminNotes: notesDraft,
      });
      toast.success("Updated");
      setActive(null);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () =>
    downloadCsv(
      "demo-requests",
      rows.map((r) => ({
        name: r.name,
        email: r.email,
        organization: r.organization,
        role: r.role,
        interests: r.interests.join("; "),
        status: r.status,
        message: r.message,
        createdAt: fmtDate(r.createdAt),
      })),
    );

  const cols: Column<ContactEnquiry>[] = [
    {
      key: "name",
      header: "Contact",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-ink">{r.name}</div>
          <div className="truncate text-xs text-gray-500">{r.email}</div>
        </div>
      ),
    },
    {
      key: "organization",
      header: "Organization",
      render: (r) => (
        <span className="text-sm text-gray-600">{r.organization || "—"}</span>
      ),
    },
    {
      key: "interests",
      header: "Interested in",
      render: (r) => (
        <span className="text-xs text-gray-500">
          {r.interests.length ? r.interests.join(", ") : "—"}
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
      header: "Received",
      render: (r) => (
        <span className="text-sm text-gray-500">{fmtDate(r.createdAt)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          onClick={() => openView(r)}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="View enquiry"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Demo Requests</h1>
        <button
          onClick={exportCsv}
          className="btn-ghost flex items-center gap-2"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>
      <p className="-mt-2 text-sm text-gray-500">
        Demo requests and enquiries submitted from the website contact form.
      </p>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {(["ALL", ...ENQUIRY_STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === s
                ? "bg-navy text-white"
                : "bg-surfaceAlt text-gray-500 hover:text-ink"
            }`}
          >
            {s === "ALL" ? "All" : s}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden p-0">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No demo requests yet"
        />
      </div>

      <Modal
        open={!!active}
        onClose={() => setActive(null)}
        title="Demo request"
      >
        {active && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name" value={active.name} />
              <Field
                label="Email"
                value={active.email}
                href={`mailto:${active.email}`}
              />
              <Field label="Organization" value={active.organization || "—"} />
              <Field label="Role" value={active.role || "—"} />
            </div>
            <div>
              <p className="label">Interested in</p>
              <p className="text-sm text-ink">
                {active.interests.length
                  ? active.interests.join(", ")
                  : "Not specified"}
              </p>
            </div>
            <div>
              <p className="label">Message</p>
              <p className="whitespace-pre-wrap rounded-2xl border border-line bg-canvas p-4 text-sm leading-relaxed text-ink">
                {active.message || "—"}
              </p>
            </div>
            <div className="text-xs text-gray-400">
              Received {fmtDate(active.createdAt)}
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-hairline pt-4 sm:grid-cols-2">
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={statusDraft}
                  onChange={(e) =>
                    setStatusDraft(e.target.value as EnquiryStatus)
                  }
                >
                  {ENQUIRY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <a
                  href={`mailto:${active.email}`}
                  className="btn-ghost flex w-full items-center justify-center gap-2"
                >
                  <Mail size={15} /> Reply by email
                </a>
              </div>
            </div>
            <div>
              <label className="label">Internal notes</label>
              <textarea
                className="input"
                rows={3}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Notes for your team…"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setActive(null)}
                className="btn-ghost flex-1"
              >
                Close
              </button>
              <button
                onClick={saveStatus}
                disabled={saving}
                className="btn-primary flex-1"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      {href ? (
        <a
          href={href}
          className="text-sm font-medium text-navy hover:underline"
        >
          {value}
        </a>
      ) : (
        <p className="text-sm text-ink">{value}</p>
      )}
    </div>
  );
}
