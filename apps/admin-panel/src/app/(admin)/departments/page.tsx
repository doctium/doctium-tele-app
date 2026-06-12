"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { RequirePermission } from "@/components/RequirePermission";
import type { Department } from "@/types";

export default function DepartmentsPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const editing = !!form.id;

  const load = () => {
    apiClient
      .get("/admin/hr/departments")
      .then((r: unknown) => setItems((r as { data: Department[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editing)
        await apiClient.patch(`/admin/hr/departments/${form.id}`, {
          name: form.name,
          description: form.description,
        });
      else
        await apiClient.post("/admin/hr/departments", {
          name: form.name,
          description: form.description,
        });
      toast.success(editing ? "Department updated" : "Department created");
      setShow(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this department?")) return;
    try {
      await apiClient.delete(`/admin/hr/departments/${id}`);
      toast.success("Deleted");
      load();
    } catch {}
  };

  const cols: Column<Department>[] = [
    {
      key: "name",
      header: "Department",
      render: (r) => <span className="font-semibold text-ink">{r.name}</span>,
    },
    {
      key: "description",
      header: "Description",
      render: (r) => (
        <span className="text-gray-500 text-sm">{r.description || "—"}</span>
      ),
    },
    {
      key: "count",
      header: "Employees",
      render: (r) => (
        <span className="tabular-nums">{r._count?.employees ?? 0}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex gap-1">
          <button
            onClick={() => {
              setForm({ id: r.id, name: r.name, description: r.description });
              setShow(true);
            }}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => remove(r.id)}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <RequirePermission perm="hr.view">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Departments</h1>
          <button
            onClick={() => {
              setForm({ id: "", name: "", description: "" });
              setShow(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Department
          </button>
        </div>
        <div className="card p-0 overflow-hidden">
          <DataTable
            columns={cols}
            data={items}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyMessage="No departments yet"
          />
        </div>
        <Modal
          open={show}
          onClose={() => setShow(false)}
          title={editing ? "Edit Department" : "Add Department"}
          maxWidth="max-w-md"
        >
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Description</label>
              <input
                className="input"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShow(false)} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? "Saving..." : editing ? "Save" : "Create"}
            </button>
          </div>
        </Modal>
      </div>
    </RequirePermission>
  );
}
