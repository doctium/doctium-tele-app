"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Upload } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { TeamMember, ContentStatus } from "@/lib/media-types";

const STATUS_VARIANT: Record<
  ContentStatus,
  "success" | "warning" | "info" | "default"
> = {
  PUBLISHED: "success",
  DRAFT: "default",
  SCHEDULED: "info",
  ARCHIVED: "warning",
};

type Form = {
  id?: string;
  name: string;
  slug: string;
  role: string;
  group: string;
  sortOrder: number;
  bioMd: string;
  avatar: string;
  linkedinUrl: string;
  xUrl: string;
  status: ContentStatus;
};

const EMPTY: Form = {
  name: "",
  slug: "",
  role: "",
  group: "",
  sortOrder: 0,
  bioMd: "",
  avatar: "",
  linkedinUrl: "",
  xUrl: "",
  status: "DRAFT",
};

export default function TeamMembersPage() {
  const [rows, setRows] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = (await apiClient
      .get("/admin/media/team-members")
      .catch(() => ({ data: [] }))) as { data: TeamMember[] };
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
  const openEdit = (m: TeamMember) => {
    setForm({
      id: m.id,
      name: m.name,
      slug: m.slug,
      role: m.role,
      group: m.group,
      sortOrder: m.sortOrder,
      bioMd: m.bioMd,
      avatar: m.avatarUrl,
      linkedinUrl: m.linkedinUrl,
      xUrl: m.xUrl,
      status: m.status,
    });
    setShowModal(true);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("Please choose a PNG, JPG or WebP image");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setForm((f) => ({ ...f, avatar: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const togglePublish = async (m: TeamMember) => {
    const next = m.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await apiClient.patch(`/admin/media/team-members/${m.id}`, {
      status: next,
    });
    toast.success(next === "PUBLISHED" ? "Member published" : "Member hidden");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    await apiClient.delete(`/admin/media/team-members/${id}`);
    toast.success("Team member removed");
    load();
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug.trim() || undefined,
      role: form.role,
      group: form.group,
      sortOrder: Number(form.sortOrder) || 0,
      bioMd: form.bioMd,
      linkedinUrl: form.linkedinUrl,
      xUrl: form.xUrl,
      status: form.status,
      // only resend the avatar when it's a freshly chosen data-URL
      avatar: form.avatar.startsWith("data:") ? form.avatar : undefined,
    };
    try {
      if (form.id) {
        await apiClient.patch(`/admin/media/team-members/${form.id}`, payload);
        toast.success("Team member updated");
      } else {
        await apiClient.post("/admin/media/team-members", {
          ...payload,
          avatar: form.avatar || undefined,
        });
        toast.success("Team member added");
      }
      setShowModal(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<TeamMember>[] = [
    {
      key: "name",
      header: "Member",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-navy-50 font-bold text-navy">
            {r.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.avatarUrl}
                alt={r.name}
                className="h-full w-full object-cover"
              />
            ) : (
              (r.name[0] ?? "?").toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-ink">{r.name}</div>
            <div className="text-xs text-gray-500">{r.role || "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "group",
      header: "Group",
      render: (r) => (
        <span className="text-sm text-gray-500">{r.group || "—"}</span>
      ),
    },
    {
      key: "sortOrder",
      header: "Order",
      width: "72px",
      render: (r) => (
        <span className="text-sm text-gray-500">{r.sortOrder}</span>
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
      key: "published",
      header: "Live",
      render: (r) => (
        <Toggle
          checked={r.status === "PUBLISHED"}
          onChange={() => togglePublish(r)}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openEdit(r)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => handleDelete(r.id)}
            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
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
        <h1 className="page-title">Team Members</h1>
        <button
          onClick={openAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Member
        </button>
      </div>
      <p className="-mt-2 text-sm text-gray-500">
        Published members appear on the website&apos;s Team page, ordered by
        &ldquo;Order&rdquo; (lowest first). Toggle &ldquo;Live&rdquo; to publish
        or hide a member.
      </p>

      <div className="card overflow-hidden p-0">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No team members yet"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit Member" : "Add Member"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                placeholder="Ada Obi"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Role / title</label>
              <input
                className="input"
                placeholder="Founder & CEO"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Group (optional)</label>
              <input
                className="input"
                placeholder="Leadership"
                value={form.group}
                onChange={(e) =>
                  setForm((f) => ({ ...f, group: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Display order</label>
              <input
                type="number"
                className="input"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div>
            <label className="label">Slug (optional — auto-generated)</label>
            <input
              className="input"
              placeholder="ada-obi"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Photo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFile}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              {form.avatar && (
                <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.avatar}
                    alt="preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost flex items-center gap-2 border border-dashed border-gray-300"
              >
                <Upload size={15} />{" "}
                {form.avatar ? "Change photo" : "Choose photo"}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Bio</label>
            <MarkdownEditor
              value={form.bioMd}
              onChange={(v) => setForm((f) => ({ ...f, bioMd: v }))}
              rows={6}
              placeholder="A short bio…"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">LinkedIn URL</label>
              <input
                className="input"
                placeholder="https://linkedin.com/in/…"
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkedinUrl: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">X (Twitter) URL</label>
              <input
                className="input"
                placeholder="https://x.com/…"
                value={form.xUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, xUrl: e.target.value }))
                }
              />
            </div>
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
              <option value="DRAFT">Draft (hidden)</option>
              <option value="PUBLISHED">Published (live on website)</option>
              <option value="ARCHIVED">Archived</option>
            </select>
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
              {saving ? "Saving..." : form.id ? "Save changes" : "Add Member"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
