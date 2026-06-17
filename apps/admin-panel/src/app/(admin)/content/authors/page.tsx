"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Upload, Linkedin, Twitter } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Author } from "@/lib/media-types";

type Form = {
  id?: string;
  name: string;
  slug: string;
  role: string;
  bioMd: string;
  avatar: string; // data-URL on change, or existing hosted URL
  linkedinUrl: string;
  xUrl: string;
};

const EMPTY: Form = {
  name: "",
  slug: "",
  role: "",
  bioMd: "",
  avatar: "",
  linkedinUrl: "",
  xUrl: "",
};

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = (await apiClient
      .get("/admin/media/authors")
      .catch(() => ({ data: [] }))) as { data: Author[] };
    setAuthors(res.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setShowModal(true);
  };
  const openEdit = (a: Author) => {
    setForm({
      id: a.id,
      name: a.name,
      slug: a.slug,
      role: a.role,
      bioMd: a.bioMd,
      avatar: a.avatarUrl,
      linkedinUrl: a.linkedinUrl,
      xUrl: a.xUrl,
    });
    setShowModal(true);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Please choose a PNG or JPG image");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setForm((f) => ({ ...f, avatar: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this author?")) return;
    await apiClient.delete(`/admin/media/authors/${id}`);
    toast.success("Author deleted");
    load();
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug || undefined, // API auto-generates from name when blank
      role: form.role,
      bioMd: form.bioMd,
      avatar: form.avatar.startsWith("data:") ? form.avatar : undefined, // only resend if changed
      linkedinUrl: form.linkedinUrl,
      xUrl: form.xUrl,
    };
    try {
      if (form.id) {
        await apiClient.patch(`/admin/media/authors/${form.id}`, payload);
        toast.success("Author updated");
      } else {
        await apiClient.post("/admin/media/authors", {
          ...payload,
          avatar: form.avatar || undefined,
        });
        toast.success("Author created");
      }
      setShowModal(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<Author>[] = [
    {
      key: "name",
      header: "Author",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
            {r.avatarUrl ? (
              <img
                src={r.avatarUrl}
                alt={r.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium text-gray-500">
                {r.name?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <span className="font-medium text-ink truncate max-w-[200px] block">
              {r.name}
            </span>
            <span className="text-xs text-gray-500 truncate max-w-[200px] block">
              {r.slug}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (r) => (
        <span className="text-sm text-gray-500">{r.role || "—"}</span>
      ),
    },
    {
      key: "social",
      header: "Social",
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.linkedinUrl ? (
            <a
              href={r.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 hover:text-ink"
              title="LinkedIn"
            >
              <Linkedin size={15} />
            </a>
          ) : null}
          {r.xUrl ? (
            <a
              href={r.xUrl}
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 hover:text-ink"
              title="X"
            >
              <Twitter size={15} />
            </a>
          ) : null}
          {!r.linkedinUrl && !r.xUrl ? (
            <Badge label="None" variant="default" />
          ) : null}
        </div>
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
        <h1 className="page-title">Authors</h1>
        <button
          onClick={openAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Author
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Bylines for blog posts and news articles. Avatar, role and social links
        appear on the public site.
      </p>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={authors}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No authors yet"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit Author" : "Add Author"}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="e.g. Dr. Amina Bello"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Slug (optional)</label>
            <input
              className="input"
              placeholder="Auto-generated from name if left blank"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Role</label>
            <input
              className="input"
              placeholder="e.g. Chief Medical Officer"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Avatar (PNG / JPG)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={onFile}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                {form.avatar ? (
                  <img
                    src={form.avatar}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-400">No image</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn-ghost flex items-center gap-2 border border-dashed border-gray-300"
              >
                <Upload size={15} />{" "}
                {form.avatar ? "Change avatar" : "Choose file"}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Bio</label>
            <MarkdownEditor
              value={form.bioMd}
              onChange={(v) => setForm((f) => ({ ...f, bioMd: v }))}
              placeholder="Short biography (Markdown supported)"
              rows={6}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">LinkedIn URL</label>
              <input
                className="input"
                placeholder="https://linkedin.com/in/..."
                value={form.linkedinUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, linkedinUrl: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">X URL</label>
              <input
                className="input"
                placeholder="https://x.com/..."
                value={form.xUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, xUrl: e.target.value }))
                }
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
              {saving ? "Saving..." : form.id ? "Save changes" : "Add Author"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
