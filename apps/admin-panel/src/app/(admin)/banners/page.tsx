"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { Banner, Service } from "@/types";

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    image: "",
    type: "URL",
    url: "",
    serviceId: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [b, s] = (await Promise.all([
      apiClient.get("/admin/banners") as Promise<{ data: Banner[] }>,
      apiClient.get("/services") as Promise<{ data: Service[] }>,
    ]).catch(() => [{ data: [] }, { data: [] }])) as [
      { data: Banner[] },
      { data: Service[] },
    ];
    setBanners(b.data ?? []);
    setServices(s.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (id: string, isActive: boolean) => {
    await apiClient.patch(`/admin/banners/${id}/toggle`, {
      isActive: !isActive,
    });
    toast.success(isActive ? "Banner hidden" : "Banner published");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await apiClient.delete(`/admin/banners/${id}`);
    toast.success("Banner deleted");
    load();
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      await apiClient.post("/admin/banners", form);
      toast.success("Banner created");
      setShowAdd(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<Banner>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "image",
      header: "Image",
      render: (r) => (
        <div className="w-20 h-12 rounded-lg overflow-hidden bg-gray-100">
          {r.image && (
            <img
              src={r.image}
              alt="banner"
              className="w-full h-full object-cover"
            />
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (r) => <Badge label={r.type} variant="info" />,
    },
    {
      key: "link",
      header: "Link",
      render: (r) => (
        <span className="text-xs text-gray-500 truncate max-w-xs">
          {r.url || r.service?.name || "—"}
        </span>
      ),
    },
    {
      key: "active",
      header: "Active",
      render: (r) => (
        <Toggle
          checked={r.isActive}
          onChange={() => handleToggle(r.id, r.isActive)}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          onClick={() => handleDelete(r.id)}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Banners</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Banner
        </button>
      </div>
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
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Banner"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Image URL</label>
            <input
              className="input"
              placeholder="https://..."
              value={form.image}
              onChange={(e) =>
                setForm((f) => ({ ...f, image: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Banner Type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="URL">URL Link</option>
              <option value="SERVICE">Service</option>
            </select>
          </div>
          {form.type === "URL" ? (
            <div>
              <label className="label">Target URL</label>
              <input
                className="input"
                placeholder="https://..."
                value={form.url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, url: e.target.value }))
                }
              />
            </div>
          ) : (
            <div>
              <label className="label">Service</label>
              <select
                className="input"
                value={form.serviceId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, serviceId: e.target.value }))
                }
              >
                <option value="">Select service</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowAdd(false)}
              className="btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? "Saving..." : "Add Banner"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
