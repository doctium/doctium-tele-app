"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Upload } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import type {
  NewsPost,
  NewsKind,
  ContentStatus,
  MediaCategory,
  Author,
} from "@/lib/media-types";
import { CONTENT_STATUSES } from "@/lib/media-types";

const STATUS_VARIANT: Record<
  ContentStatus,
  "success" | "warning" | "info" | "default"
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
  title: string;
  slug: string;
  kind: NewsKind;
  excerpt: string;
  bodyMd: string;
  coverImage: string;
  status: ContentStatus;
  categoryId: string;
  authorId: string;
  outlet: string;
  outletLogoUrl: string;
  externalUrl: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
  noindex: boolean;
};

const EMPTY: Form = {
  title: "",
  slug: "",
  kind: "ANNOUNCEMENT",
  excerpt: "",
  bodyMd: "",
  coverImage: "",
  status: "DRAFT",
  categoryId: "",
  authorId: "",
  outlet: "",
  outletLogoUrl: "",
  externalUrl: "",
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
  canonicalUrl: "",
  noindex: false,
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

const catName = (c: NewsPost["category"]) =>
  c && typeof c === "object" && "name" in c ? c.name : "—";

export default function NewsPage() {
  const [rows, setRows] = useState<NewsPost[]>([]);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = (await apiClient
      .get("/admin/media/news")
      .catch(() => ({ data: [] }))) as { data: NewsPost[] };
    setRows(res.data ?? []);
    setLoading(false);
  };

  const loadRefs = async () => {
    const cats = (await apiClient
      .get("/admin/media/news-categories")
      .catch(() => ({ data: [] }))) as { data: MediaCategory[] };
    setCategories(cats.data ?? []);
    const auth = (await apiClient
      .get("/admin/media/authors")
      .catch(() => ({ data: [] }))) as { data: Author[] };
    setAuthors(auth.data ?? []);
  };

  useEffect(() => {
    load();
    loadRefs();
  }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setShowModal(true);
  };
  const openEdit = (r: NewsPost) => {
    setForm({
      id: r.id,
      title: r.title,
      slug: r.slug,
      kind: r.kind,
      excerpt: r.excerpt,
      bodyMd: r.bodyMd,
      coverImage: r.coverImageUrl,
      status: r.status,
      categoryId: r.categoryId ?? "",
      authorId: r.authorId ?? "",
      outlet: r.outlet,
      outletLogoUrl: r.outletLogoUrl,
      externalUrl: r.externalUrl,
      metaTitle: r.metaTitle,
      metaDescription: r.metaDescription,
      ogImage: r.ogImageUrl,
      canonicalUrl: r.canonicalUrl,
      noindex: r.noindex,
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
      setForm((f) => ({ ...f, coverImage: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const togglePublish = async (r: NewsPost) => {
    const next: ContentStatus =
      r.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    await apiClient.patch(`/admin/media/news/${r.id}`, { status: next });
    toast.success(next === "PUBLISHED" ? "Post published" : "Post unpublished");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this news post?")) return;
    await apiClient.delete(`/admin/media/news/${id}`);
    toast.success("News post deleted");
    load();
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    const isAnnouncement = form.kind === "ANNOUNCEMENT";
    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      kind: form.kind,
      excerpt: form.excerpt,
      bodyMd: isAnnouncement ? form.bodyMd : "",
      coverImage:
        isAnnouncement && form.coverImage.startsWith("data:")
          ? form.coverImage
          : undefined, // only resend if newly chosen
      status: form.status,
      categoryId: form.categoryId || null,
      authorId: form.authorId || null,
      outlet: isAnnouncement ? "" : form.outlet,
      outletLogoUrl: isAnnouncement ? "" : form.outletLogoUrl,
      externalUrl: isAnnouncement ? "" : form.externalUrl,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      ogImage: form.ogImage,
      canonicalUrl: form.canonicalUrl,
      noindex: form.noindex,
    };
    try {
      if (form.id) {
        await apiClient.patch(`/admin/media/news/${form.id}`, payload);
        toast.success("News post updated");
      } else {
        await apiClient.post("/admin/media/news", {
          ...payload,
          coverImage: isAnnouncement ? form.coverImage : undefined,
        });
        toast.success("News post created");
      }
      setShowModal(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<NewsPost>[] = [
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <span className="font-medium text-ink truncate max-w-[260px] block">
          {r.title}
        </span>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (r) => (
        <Badge
          label={r.kind === "ANNOUNCEMENT" ? "Announcement" : "Coverage"}
          variant={r.kind === "ANNOUNCEMENT" ? "info" : "default"}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge
          label={STATUS_LABEL[r.status]}
          variant={STATUS_VARIANT[r.status]}
        />
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (r) => (
        <span className="text-sm text-gray-500">{catName(r.category)}</span>
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
            onClick={() => togglePublish(r)}
            className="text-xs font-medium text-gray-500 hover:text-ink px-2 py-1 rounded-lg hover:bg-gray-100"
          >
            {r.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </button>
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

  const isAnnouncement = form.kind === "ANNOUNCEMENT";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">News &amp; Press</h1>
        <button
          onClick={openAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Post
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Company announcements and external press coverage. Announcements carry
        their own article body; coverage links out to the original outlet.
      </p>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No news posts yet"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit News Post" : "Add News Post"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="e.g. Doctium raises Series A"
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
              placeholder="auto-generated from title if blank"
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
                  setForm((f) => ({ ...f, kind: e.target.value as NewsKind }))
                }
              >
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="COVERAGE">Coverage</option>
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
            <label className="label">Excerpt</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Short summary shown in listings"
              value={form.excerpt}
              onChange={(e) =>
                setForm((f) => ({ ...f, excerpt: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select
                className="input"
                value={form.categoryId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, categoryId: e.target.value }))
                }
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Author</label>
              <select
                className="input"
                value={form.authorId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, authorId: e.target.value }))
                }
              >
                <option value="">No author</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isAnnouncement ? (
            <>
              <div>
                <label className="label">Body</label>
                <MarkdownEditor
                  value={form.bodyMd}
                  onChange={(v) => setForm((f) => ({ ...f, bodyMd: v }))}
                  placeholder="Write the announcement..."
                  rows={10}
                />
              </div>
              <div>
                <label className="label">Cover image (PNG / JPG)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={onFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost flex items-center gap-2 w-full justify-center border border-dashed border-gray-300"
                >
                  <Upload size={15} />{" "}
                  {form.coverImage ? "Change image" : "Choose file"}
                </button>
                {form.coverImage && (
                  <div className="mt-2 w-full aspect-[16/9] rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={form.coverImage}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Outlet</label>
                <input
                  className="input"
                  placeholder="e.g. TechCrunch"
                  value={form.outlet}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, outlet: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Outlet logo URL</label>
                <input
                  className="input"
                  placeholder="https://..."
                  value={form.outletLogoUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, outletLogoUrl: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">External URL</label>
                <input
                  className="input"
                  placeholder="https://..."
                  value={form.externalUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, externalUrl: e.target.value }))
                  }
                />
              </div>
            </>
          )}

          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              SEO
            </p>
            <div className="space-y-4">
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
              <div>
                <label className="label">Canonical URL</label>
                <input
                  className="input"
                  placeholder="https://..."
                  value={form.canonicalUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, canonicalUrl: e.target.value }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="label mb-0">No-index</label>
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
              {saving ? "Saving..." : form.id ? "Save changes" : "Add Post"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
