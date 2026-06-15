"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown, Upload } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Banner } from "@/types";

// In-app destinations a banner can deep-link to (keys mirrored in the user app).
const APP_DESTINATIONS: { key: string; label: string }[] = [
  { key: "doctors", label: "Find Doctors" },
  { key: "care-programs", label: "Care Programs" },
  { key: "medigram", label: "MediGram (videos)" },
  { key: "wallet", label: "Wallet / Top-up" },
  { key: "subscriptions", label: "DoctiumPlus" },
  { key: "appointments", label: "My Appointments" },
  { key: "leenah", label: "Leenah (AI assistant)" },
  { key: "referrals", label: "My Referrals" },
];

type Form = {
  id?: string;
  title: string;
  type: "EXTERNAL" | "APP";
  target: string;
  image: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY: Form = {
  title: "",
  type: "APP",
  target: "doctors",
  image: "",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

const toLocalInput = (iso?: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 16) : "";

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const b = (await apiClient
      .get("/admin/banners")
      .catch(() => ({ data: [] }))) as { data: Banner[] };
    setBanners(b.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setShowModal(true);
  };
  const openEdit = (b: Banner) => {
    setForm({
      id: b.id,
      title: b.title,
      type: b.type,
      target: b.target,
      image: b.image,
      isActive: b.isActive,
      startsAt: toLocalInput(b.startsAt),
      endsAt: toLocalInput(b.endsAt),
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
      setForm((f) => ({ ...f, image: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleToggle = async (b: Banner) => {
    await apiClient.patch(`/admin/banners/${b.id}`, { isActive: !b.isActive });
    toast.success(b.isActive ? "Banner hidden" : "Banner published");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await apiClient.delete(`/admin/banners/${id}`);
    toast.success("Banner deleted");
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= banners.length) return;
    const arr = [...banners];
    [arr[index], arr[next]] = [arr[next]!, arr[index]!];
    setBanners(arr);
    await apiClient.patch("/admin/banners/reorder", {
      ids: arr.map((b) => b.id),
    });
  };

  const handleSave = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.target.trim())
      return toast.error(
        form.type === "EXTERNAL"
          ? "Enter a link URL"
          : "Choose an app destination",
      );
    if (!form.image) return toast.error("Choose a banner image");
    setSaving(true);
    const payload = {
      title: form.title,
      type: form.type,
      target: form.target,
      image: form.image.startsWith("data:") ? form.image : undefined, // only resend if changed
      isActive: form.isActive,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
    };
    try {
      if (form.id) {
        await apiClient.patch(`/admin/banners/${form.id}`, payload);
        toast.success("Banner updated");
      } else {
        await apiClient.post("/admin/banners", {
          ...payload,
          image: form.image,
        });
        toast.success("Banner created");
      }
      setShowModal(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<Banner>[] = [
    {
      key: "order",
      header: "#",
      width: "72px",
      render: (r, i) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => move(i, -1)}
            disabled={i === 0}
            className="p-1 text-gray-400 hover:text-ink disabled:opacity-30"
          >
            <ArrowUp size={14} />
          </button>
          <button
            onClick={() => move(i, 1)}
            disabled={i === banners.length - 1}
            className="p-1 text-gray-400 hover:text-ink disabled:opacity-30"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      ),
    },
    {
      key: "image",
      header: "Banner",
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-24 h-8 rounded-md overflow-hidden bg-gray-100 shrink-0">
            {r.image && (
              <img
                src={r.image}
                alt={r.title}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <span className="font-medium text-ink truncate max-w-[160px]">
            {r.title}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <Badge
          label={r.type === "EXTERNAL" ? "External link" : "App"}
          variant={r.type === "EXTERNAL" ? "warning" : "info"}
        />
      ),
    },
    {
      key: "target",
      header: "Destination",
      render: (r) => (
        <span className="text-xs text-gray-500 truncate max-w-[220px] block">
          {r.type === "APP"
            ? (APP_DESTINATIONS.find((d) => d.key === r.target)?.label ??
              r.target)
            : r.target || "—"}
        </span>
      ),
    },
    {
      key: "clicks",
      header: "Taps",
      render: (r) => (
        <span className="text-sm text-gray-500">{r.clickCount}</span>
      ),
    },
    {
      key: "active",
      header: "Active",
      render: (r) => (
        <Toggle checked={r.isActive} onChange={() => handleToggle(r)} />
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
        <h1 className="page-title">Banners</h1>
        <button
          onClick={openAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Banner
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Shown in the patient app home slider (3:1). Drag order with the arrows;
        inactive or out-of-schedule banners are hidden.
      </p>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={banners}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No banners yet"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit Banner" : "Add Banner"}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="e.g. Free first consultation"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="label">Banner type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value as "EXTERNAL" | "APP",
                  target: e.target.value === "APP" ? "doctors" : "",
                }))
              }
            >
              <option value="APP">App function</option>
              <option value="EXTERNAL">External link</option>
            </select>
          </div>

          {form.type === "EXTERNAL" ? (
            <div>
              <label className="label">Link URL</label>
              <input
                className="input"
                placeholder="https://..."
                value={form.target}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target: e.target.value }))
                }
              />
            </div>
          ) : (
            <div>
              <label className="label">App destination</label>
              <select
                className="input"
                value={form.target}
                onChange={(e) =>
                  setForm((f) => ({ ...f, target: e.target.value }))
                }
              >
                {APP_DESTINATIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">
              Image (PNG / JPG, 3:1 e.g. 1200×400)
            </label>
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
              <Upload size={15} /> {form.image ? "Change image" : "Choose file"}
            </button>
            {form.image && (
              <div className="mt-2 w-full aspect-[3/1] rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={form.image}
                  alt="preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Starts (optional)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.startsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startsAt: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Ends (optional)</label>
              <input
                type="datetime-local"
                className="input"
                value={form.endsAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endsAt: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="label mb-0">Active</label>
            <Toggle
              checked={form.isActive}
              onChange={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
            />
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
              {saving ? "Saving..." : form.id ? "Save changes" : "Add Banner"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
