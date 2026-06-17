"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { JobTeam } from "@/lib/media-types";

type Form = {
  id?: string;
  name: string;
  slug: string;
  description: string;
};

const EMPTY: Form = {
  name: "",
  slug: "",
  description: "",
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<JobTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = (await apiClient
      .get("/admin/media/teams")
      .catch(() => ({ data: [] }))) as { data: JobTeam[] };
    setTeams(res.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setForm(EMPTY);
    setShowModal(true);
  };
  const openEdit = (t: JobTeam) => {
    setForm({
      id: t.id,
      name: t.name,
      slug: t.slug ?? "",
      description: t.description ?? "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this team?")) return;
    await apiClient.delete(`/admin/media/teams/${id}`);
    toast.success("Team deleted");
    load();
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug.trim() || undefined, // API auto-generates from name when blank
      description: form.description,
    };
    try {
      if (form.id) {
        await apiClient.patch(`/admin/media/teams/${form.id}`, payload);
        toast.success("Team updated");
      } else {
        await apiClient.post("/admin/media/teams", payload);
        toast.success("Team created");
      }
      setShowModal(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<JobTeam>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => <span className="font-medium text-ink">{r.name}</span>,
    },
    {
      key: "slug",
      header: "Slug",
      render: (r) => (
        <span className="text-xs text-gray-500">{r.slug || "—"}</span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (r) => (
        <span className="text-sm text-gray-500 truncate max-w-[360px] block">
          {r.description || "—"}
        </span>
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
        <h1 className="page-title">Teams</h1>
        <button
          onClick={openAdd}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Team
        </button>
      </div>
      <p className="text-sm text-gray-500 -mt-2">
        Job departments used to group careers postings.
      </p>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={teams}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No teams yet"
        />
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? "Edit Team" : "Add Team"}
      >
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="e.g. Engineering"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Slug (optional)</label>
            <input
              className="input"
              placeholder="auto-generated from name if left blank"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="input"
              rows={4}
              placeholder="What this team does"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
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
              {saving ? "Saving..." : form.id ? "Save changes" : "Add Team"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
