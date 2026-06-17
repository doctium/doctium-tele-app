"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, Upload, Eye, EyeOff } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import type {
  BlogPost,
  Author,
  MediaCategory,
  ContentStatus,
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
  excerpt: string;
  bodyMd: string;
  coverImage: string;
  status: ContentStatus;
  authorId: string;
  categoryIds: string[];
  tags: string;
  readingMins: string;
  metaTitle: string;
  metaDescription: string;
  ogImage: string;
  canonicalUrl: string;
  noindex: boolean;
};

const EMPTY: Form = {
  title: "",
  slug: "",
  excerpt: "",
  bodyMd: "",
  coverImage: "",
  status: "DRAFT",
  authorId: "",
  categoryIds: [],
  tags: "",
  readingMins: "",
  metaTitle: "",
  metaDescription: "",
  ogImage: "",
  canonicalUrl: "",
  noindex: false,
};

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

const authorName = (a: BlogPost["author"]) =>
  a && typeof a === "object" && "name" in a ? a.name : "";

export default function BlogPostsPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = (await apiClient
      .get("/admin/media/blog")
      .catch(() => ({ data: [] }))) as { data: BlogPost[] };
    setPosts(res.data ?? []);
    setLoading(false);
  };

  const loadRefs = async () => {
    const [a, c] = await Promise.all([
      apiClient
        .get("/admin/media/authors")
        .catch(() => ({ data: [] })) as Promise<{ data: Author[] }>,
      apiClient
        .get("/admin/media/blog-categories")
        .catch(() => ({ data: [] })) as Promise<{ data: MediaCategory[] }>,
    ]);
    setAuthors(a.data ?? []);
    setCategories(c.data ?? []);
  };

  useEffect(() => {
    load();
    loadRefs();
  }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setShowModal(true);
  };

  const openEdit = (p: BlogPost) => {
    setForm({
      id: p.id,
      title: p.title,
      slug: p.slug ?? "",
      excerpt: p.excerpt ?? "",
      bodyMd: p.bodyMd ?? "",
      coverImage: p.coverImageUrl ?? "",
      status: p.status,
      authorId: p.authorId ?? "",
      categoryIds: (p.categories ?? []).map((c) => c.id),
      tags: (p.tags ?? []).join(", "),
      readingMins: p.readingMins ? String(p.readingMins) : "",
      metaTitle: p.metaTitle ?? "",
      metaDescription: p.metaDescription ?? "",
      ogImage: p.ogImageUrl ?? "",
      canonicalUrl: p.canonicalUrl ?? "",
      noindex: p.noindex ?? false,
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

  const toggleCategory = (id: string) =>
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));

  const handlePublishToggle = async (p: BlogPost) => {
    const publish = p.status !== "PUBLISHED";
    await apiClient.post(
      `/admin/media/blog/${p.id}/${publish ? "publish" : "unpublish"}`,
    );
    toast.success(publish ? "Post published" : "Post unpublished");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this blog post?")) return;
    await apiClient.delete(`/admin/media/blog/${id}`);
    toast.success("Post deleted");
    load();
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    const tags = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      title: form.title,
      slug: form.slug.trim() || undefined,
      excerpt: form.excerpt,
      bodyMd: form.bodyMd,
      coverImage: form.coverImage.startsWith("data:")
        ? form.coverImage
        : undefined, // only resend if changed
      status: form.status,
      authorId: form.authorId || null,
      categoryIds: form.categoryIds,
      tags,
      readingMins: form.readingMins ? Number(form.readingMins) : undefined,
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      ogImage: form.ogImage,
      canonicalUrl: form.canonicalUrl,
      noindex: form.noindex,
    };
    try {
      if (form.id) {
        await apiClient.patch(`/admin/media/blog/${form.id}`, payload);
        toast.success("Post updated");
      } else {
        await apiClient.post("/admin/media/blog", {
          ...payload,
          coverImage: form.coverImage || undefined,
        });
        toast.success("Post created");
      }
      setShowModal(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<BlogPost>[] = [
    {
      key: "title",
      header: "Post",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-16 h-10 rounded-md overflow-hidden bg-gray-100 shrink-0">
            {r.coverImageUrl && (
              <img
                src={r.coverImageUrl}
                alt={r.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <span className="font-medium text-ink truncate max-w-[220px]">
            {r.title}
          </span>
        </div>
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
      key: "author",
      header: "Author",
      render: (r) => (
        <span className="text-sm text-gray-500">
          {authorName(r.author) || "—"}
        </span>
      ),
    },
    {
      key: "categories",
      header: "Categories",
      render: (r) => (
        <span className="text-xs text-gray-500 truncate max-w-[200px] block">
          {(r.categories ?? []).map((c) => c.name).join(", ") || "—"}
        </span>
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
            onClick={() => handlePublishToggle(r)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
            title={r.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          >
            {r.status === "PUBLISHED" ? (
              <EyeOff size={15} />
            ) : (
              <Eye size={15} />
            )}
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Blog Posts</h1>
        <button
          onClick={openAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Post
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Long-form articles for the Doctium website. Publish to make a post live;
        drafts and archived posts stay hidden.
      </p>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={posts}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No blog posts yet"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit Post" : "Add Post"}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="e.g. 5 signs you should see a cardiologist"
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

          <div>
            <label className="label">Excerpt</label>
            <input
              className="input"
              placeholder="Short summary shown in listings"
              value={form.excerpt}
              onChange={(e) =>
                setForm((f) => ({ ...f, excerpt: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">Body</label>
            <MarkdownEditor
              value={form.bodyMd}
              onChange={(v) => setForm((f) => ({ ...f, bodyMd: v }))}
              placeholder="Write the article in Markdown…"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div>
            <label className="label">Categories</label>
            {categories.length === 0 ? (
              <p className="text-xs text-gray-400">No categories available.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm text-ink"
                  >
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Tags (comma-separated)</label>
              <input
                className="input"
                placeholder="heart, prevention"
                value={form.tags}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tags: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Reading time (mins)</label>
              <input
                type="number"
                min={0}
                className="input"
                placeholder="e.g. 6"
                value={form.readingMins}
                onChange={(e) =>
                  setForm((f) => ({ ...f, readingMins: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="pt-2 border-t border-hairline">
            <h3 className="text-sm font-semibold text-ink mb-3">SEO</h3>
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
                <input
                  className="input"
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
                  placeholder="https://…"
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
                  placeholder="https://…"
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
