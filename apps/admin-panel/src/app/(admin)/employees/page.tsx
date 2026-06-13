"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { apiClient } from "@/lib/api";
import { toStoredAmount } from "@/lib/money";
import { toast } from "@/lib/toast";
import { RequirePermission } from "@/components/RequirePermission";
import { useAdminAuth } from "@/lib/auth-context";
import type { Employee, Role, Department } from "@/types";
import { format } from "date-fns";

const STATUSES = [
  "ALL",
  "ONBOARDING",
  "ACTIVE",
  "ON_LEAVE",
  "SUSPENDED",
  "TERMINATED",
] as const;
const VARIANT: Record<
  string,
  "info" | "success" | "danger" | "warning" | "default"
> = {
  ONBOARDING: "info",
  ACTIVE: "success",
  ON_LEAVE: "warning",
  SUSPENDED: "danger",
  TERMINATED: "default",
};

export default function EmployeesPage() {
  const router = useRouter();
  const { can } = useAdminAuth();
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("ALL");
  const [roles, setRoles] = useState<Role[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    image: "",
    position: "",
    departmentId: "",
    employmentType: "FULL_TIME",
    salary: "",
    canLogin: false,
    roleId: "",
  });
  const PAGE_SIZE = 15;

  const load = () => {
    setLoading(true);
    apiClient
      .get("/admin/hr/employees", {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          status: status === "ALL" ? undefined : status,
        },
      })
      .then((r: unknown) => {
        const d = (r as { data: { items: Employee[]; total: number } }).data;
        setRows(d?.items ?? []);
        setTotal(d?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [page, status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    apiClient
      .get("/admin/hr/roles")
      .then((r: unknown) => setRoles((r as { data: Role[] }).data ?? []))
      .catch(() => {});
    apiClient
      .get("/admin/hr/departments")
      .then((r: unknown) => setDepts((r as { data: Department[] }).data ?? []))
      .catch(() => {});
  }, []);

  const add = async () => {
    if (!form.name || !form.email) {
      toast.error("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        image: form.image || undefined,
        position: form.position,
        departmentId: form.departmentId || undefined,
        employmentType: form.employmentType,
        canLogin: form.canLogin,
        roleId: form.canLogin ? form.roleId || undefined : undefined,
      };
      if (can("hr.payroll") && form.salary)
        body.salary = toStoredAmount(parseFloat(form.salary));
      const res = (await apiClient.post("/admin/hr/employees", body)) as {
        data: { tempPassword?: string };
      };
      toast.success(
        res.data?.tempPassword
          ? `Employee created. Temp password: ${res.data.tempPassword}`
          : "Employee created",
      );
      setShow(false);
      setForm({
        name: "",
        email: "",
        phone: "",
        image: "",
        position: "",
        departmentId: "",
        employmentType: "FULL_TIME",
        salary: "",
        canLogin: false,
        roleId: "",
      });
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<Employee>[] = [
    {
      key: "name",
      header: "Employee",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.image} name={r.name} size={38} />
          <div>
            <p className="font-semibold text-gray-900">{r.name}</p>
            <p className="text-xs text-gray-400">{r.position || r.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "dept",
      header: "Department",
      render: (r) => (
        <span className="text-sm text-gray-600">
          {r.department?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "role",
      header: "Access",
      render: (r) =>
        r.canLogin ? (
          <Badge
            label={r.role?.name ?? (r.isSuperAdmin ? "Super Admin" : "No role")}
            variant="info"
          />
        ) : (
          <span className="text-gray-300 text-sm">No login</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge
          label={(r.status ?? "ACTIVE").replace("_", " ")}
          variant={VARIANT[r.status ?? "ACTIVE"] ?? "default"}
        />
      ),
    },
    {
      key: "joined",
      header: "Joined",
      render: (r) => (
        <span className="text-gray-500 text-sm">
          {format(new Date(r.createdAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          onClick={() => router.push(`/employees/${r.id}`)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-500/10 transition-colors"
          title="View employee details"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];

  return (
    <RequirePermission perm="hr.view">
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="eyebrow">Human Resources</p>
            <h1 className="page-title mt-0.5">Employees</h1>
          </div>
          <div className="flex items-center gap-3">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search staff…"
            />
            {can("hr.manage") && (
              <button
                onClick={() => setShow(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={16} /> Add Employee
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${status === s ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500"}`}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="card p-0 overflow-hidden">
          <DataTable
            columns={cols}
            data={rows}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyMessage="No employees found"
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </div>

        <Modal
          open={show}
          onClose={() => setShow(false)}
          title="Add Employee"
          maxWidth="max-w-xl"
        >
          {/* Photo (≤ 1 MB, stored via image.util — data-URL fallback works without Cloudinary) */}
          <div className="flex items-center gap-4 mb-5">
            {form.image ? (
              <img
                src={form.image}
                alt="Employee photo"
                className="w-16 h-16 rounded-2xl object-cover border border-border"
              />
            ) : (
              <div className="grid place-items-center w-16 h-16 rounded-2xl bg-surfaceAlt border border-dashed border-border text-gray-400">
                <Plus size={20} />
              </div>
            )}
            <div>
              <label className="btn-secondary text-xs cursor-pointer inline-block">
                {form.image ? "Change photo" : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    if (file.size > 1024 * 1024) {
                      toast.error("Photo must be 1 MB or smaller");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      setForm((f) => ({
                        ...f,
                        image: String(reader.result ?? ""),
                      }));
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <p className="text-caption text-gray-400 mt-1.5">
                JPG or PNG, max 1 MB
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Position / title</label>
              <input
                className="input"
                value={form.position}
                onChange={(e) =>
                  setForm((f) => ({ ...f, position: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">Department</label>
              <select
                className="input"
                value={form.departmentId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, departmentId: e.target.value }))
                }
              >
                <option value="">— None —</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Employment type</label>
              <select
                className="input"
                value={form.employmentType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, employmentType: e.target.value }))
                }
              >
                {["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            {can("hr.payroll") && (
              <div>
                <label className="label">Salary (₦)</label>
                <input
                  className="input"
                  type="number"
                  value={form.salary}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, salary: e.target.value }))
                  }
                />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 mt-4 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.canLogin}
              onChange={(e) =>
                setForm((f) => ({ ...f, canLogin: e.target.checked }))
              }
            />
            Give admin-panel access (a temporary password will be generated)
          </label>
          {form.canLogin && (
            <div className="mt-3">
              <label className="label">Role</label>
              <select
                className="input"
                value={form.roleId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, roleId: e.target.value }))
                }
              >
                <option value="">— Select a role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShow(false)} className="btn-ghost flex-1">
              Cancel
            </button>
            <button
              onClick={add}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? "Creating…" : "Create Employee"}
            </button>
          </div>
        </Modal>
      </div>
    </RequirePermission>
  );
}
