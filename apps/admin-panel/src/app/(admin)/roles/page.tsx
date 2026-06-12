"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, ShieldCheck } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { RequirePermission } from "@/components/RequirePermission";
import type { Role, PermissionGroup } from "@/types";

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    permissions: new Set<string>(),
    isSystem: false,
  });
  const [saving, setSaving] = useState(false);
  const editing = !!form.id;

  const load = () => {
    Promise.all([
      apiClient.get("/admin/hr/roles"),
      apiClient.get("/admin/hr/permissions"),
    ])
      .then(([r, p]) => {
        setRoles((r as { data: Role[] }).data ?? []);
        setCatalog((p as { data: PermissionGroup[] }).data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({
      id: "",
      name: "",
      description: "",
      permissions: new Set(),
      isSystem: false,
    });
    setShow(true);
  };
  const openEdit = (r: Role) => {
    setForm({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: new Set(r.permissions),
      isSystem: r.isSystem,
    });
    setShow(true);
  };

  const toggle = (key: string) =>
    setForm((f) => {
      const next = new Set(f.permissions);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...f, permissions: next };
    });

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setSaving(true);
    const body = {
      name: form.name,
      description: form.description,
      permissions: [...form.permissions],
    };
    try {
      if (editing) await apiClient.patch(`/admin/hr/roles/${form.id}`, body);
      else await apiClient.post("/admin/hr/roles", body);
      toast.success(editing ? "Role updated" : "Role created");
      setShow(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Role) => {
    if (r.isSystem) {
      toast.error("System roles cannot be deleted");
      return;
    }
    if (!confirm(`Delete the "${r.name}" role?`)) return;
    try {
      await apiClient.delete(`/admin/hr/roles/${r.id}`);
      toast.success("Role deleted");
      load();
    } catch {}
  };

  const cols: Column<Role>[] = [
    {
      key: "name",
      header: "Role",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{r.name}</span>
          {r.isSystem && <Badge label="System" variant="info" />}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (r) => (
        <span className="text-gray-500 text-sm">{r.description || "—"}</span>
      ),
    },
    {
      key: "perms",
      header: "Permissions",
      render: (r) => (
        <span className="tabular-nums text-sm">
          {r.isSystem && r.name === "Super Admin"
            ? "All"
            : r.permissions.length}
        </span>
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
            onClick={() => openEdit(r)}
            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Pencil size={15} />
          </button>
          {!r.isSystem && (
            <button
              onClick={() => remove(r)}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const isSuperAdminRole =
    editing && form.isSystem && form.name === "Super Admin";

  return (
    <RequirePermission perm="hr.roles">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Access control</p>
            <h1 className="page-title mt-0.5">Roles & Permissions</h1>
          </div>
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Role
          </button>
        </div>
        <div className="card p-0 overflow-hidden">
          <DataTable
            columns={cols}
            data={roles}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyMessage="No roles yet"
          />
        </div>

        <Modal
          open={show}
          onClose={() => setShow(false)}
          title={editing ? "Edit Role" : "Create Role"}
          maxWidth="max-w-2xl"
        >
          <div className="grid grid-cols-2 gap-4 mb-4">
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
          {isSuperAdminRole ? (
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 text-teal-700 p-3 text-sm">
              <ShieldCheck size={16} /> Super Admin always has every permission.
            </div>
          ) : (
            <div className="max-h-[46vh] overflow-y-auto pr-1 space-y-4">
              {catalog.map((g) => (
                <div key={g.group}>
                  <p className="section-title text-sm mb-2">{g.group}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {g.permissions.map((p) => (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 text-sm text-gray-700 rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.permissions.has(p.key)}
                          onChange={() => toggle(p.key)}
                        />
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShow(false)} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Role"}
            </button>
          </div>
        </Modal>
      </div>
    </RequirePermission>
  );
}
