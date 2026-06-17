"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import {
  LandingPage,
  LandingKind,
  ContentStatus,
  CONTENT_STATUSES,
} from "@/lib/media-types";

const LANDING_KINDS: { key: LandingKind; label: string }[] = [
  { key: "CONDITION", label: "Condition" },
  { key: "SPECIALTY", label: "Specialty" },
  { key: "CITY", label: "City" },
  { key: "TOPIC", label: "Topic" },
];

const STATUS_VARIANT: Record<
  ContentStatus,
  "success" | "warning" | "danger" | "info" | "default"
> = {
  PUBLISHED: "success",
  DRAFT: "default",
  SCHEDULED: "info",
  ARCHIVED: "warning",
};

const STATUS_LABEL: Record<ContentStatus, string> = {
  PUBLISHED: "Published",
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  ARCHIVED: "Archived",
};

type Form = {
  id?: string;
  h1: string;
  slug: string;
  kind: LandingKind;
  intro: string;
  bodyMd: string;
  status: ContentStatus;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  noindex: boolean;
};

const EMPTY: Form = {
  h1: "",
  slug: "",
  kind: "CONDITION",
  intro: "",
  bodyMd: "",
  status: "DRAFT",
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
  noindex: false,
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

export default function LandingPagesPage() {
  const [rows, setRows] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = (await apiClient
      .get("/admin/media/landing")
      .catch(() => ({ data: [] }))) as { data: LandingPage[] };
    setRows(res.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = async (r: LandingPage) => {
    const res = (await apiClient.get(`/admin/media/landing/${r.id}`)) as {
      data: LandingPage;
    };
    const p = res.data ?? r;
    setForm({
      id: p.id,
      h1: p.h1,
      slug: p.slug,
      kind: p.kind,
      intro: p.intro,
      bodyMd: p.bodyMd,
      status: p.status,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      ogImage: p.ogImageUrl,
      noindex: p.noindex,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this landing page?")) return;
    await apiClient.delete(`/admin/media/landing/${id}`);
    toast.success("Landing page deleted");
    load();
  };

  const handleSave = async () => {
    if (!form.h1.trim()) return toast.error("H1 is required");
    setSaving(true);
    const payload = {
      h1: form.h1,
      slug: form.slug || undefined,
      kind: form.kind,
      intro: form.intro,
      bodyMd: form.bodyMd,
      status: form.status,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      ogImage: form.ogImage,
      noindex: form.noindex,
    };
    try {
      if (form.id) {
        await apiClient.patch(`/admin/media/landing/${form.id}`, payload);
        toast.success("Landing page updated");
      } else {
        await apiClient.post("/admin/media/landing", payload);
        toast.success("Landing page created");
      }
      setShowModal(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<LandingPage>[] = [
    {
      key: "h1",
      header: "H1",
      render: (r) => (
        <span className="font-medium text-ink truncate max-w-[240px] block">
          {r.h1}
        </span>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (r) => (
        <Badge
          label={LANDING_KINDS.find((k) => k.key === r.kind)?.label ?? r.kind}
          variant="default"
        />
      ),
    },
    {
      key: "slug",
      header: "Slug",
      render: (r) => (
        <span className="text-xs text-gray-500 truncate max-w-[200px] block">
          {r.slug || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge
          label={STATUS_LABEL[r.status] ?? r.status}
          variant={STATUS_VARIANT[r.status] ?? "default"}
        />
      ),
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (r) => (
        <span className="text-sm text-gray-500">{fmtDate(r.updatedAt)}</span>
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
        <h1 className="page-title">Landing Pages</h1>
        <button
          onClick={openAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Landing Page
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Programmatic SEO pages for conditions, specialties, cities and topics.
      </p>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No landing pages yet"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit Landing Page" : "Add Landing Page"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="label">H1</label>
            <input
              className="input"
              placeholder="e.g. Find a Cardiologist near you"
              value={form.h1}
              onChange={(e) => setForm((f) => ({ ...f, h1: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Slug (optional)</label>
            <input
              className="input"
              placeholder="auto-generated from H1 if left blank"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Kind</label>
              <select
                className="input"
                value={form.kind}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kind: e.target.value as LandingKind,
                  }))
                }
              >
                {LANDING_KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
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
                    status: e.target.value as ContentStatus,
                  }))
                }
              >
                {CONTENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Intro</label>
            <input
              className="input"
              placeholder="Short lead paragraph shown under the H1"
              value={form.intro}
              onChange={(e) =>
                setForm((f) => ({ ...f, intro: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">Body</label>
            <MarkdownEditor
              value={form.bodyMd}
              onChange={(v) => setForm((f) => ({ ...f, bodyMd: v }))}
              placeholder="Page content in Markdown..."
              rows={10}
            />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              SEO
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Meta title</label>
                <input
                  className="input"
                  placeholder="Title shown in search results"
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
                  rows={3}
                  placeholder="Description shown in search results"
                  value={form.metaDescription}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      metaDescription: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="label">OG image URL</label>
                <input
                  className="input"
                  placeholder="https://..."
                  value={form.ogImage}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ogImage: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="label mb-0">No-index</label>
                  <p className="text-xs text-gray-500">
                    Hide this page from search engines.
                  </p>
                </div>
                <Toggle
                  checked={form.noindex}
                  onChange={() =>
                    setForm((f) => ({ ...f, noindex: !f.noindex }))
                  }
                />
              </div>
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
              {saving
                ? "Saving..."
                : form.id
                  ? "Save changes"
                  : "Add Landing Page"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
