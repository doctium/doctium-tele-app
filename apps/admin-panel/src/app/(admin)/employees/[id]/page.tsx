"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Trash2,
  ExternalLink,
  Check,
  Eye,
  KeyRound,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { RequirePermission } from "@/components/RequirePermission";
import { useAdminAuth } from "@/lib/auth-context";
import { formatMoney, toStoredAmount, toMajorUnits } from "@/lib/money";
import type { Employee, Role, Department, EmployeeDocument } from "@/types";
import { format } from "date-fns";

const DOC_TYPES = [
  "CONTRACT",
  "OFFER_LETTER",
  "GOVERNMENT_ID",
  "CERTIFICATE",
  "NDA",
  "RESUME",
  "OTHER",
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function EmployeeDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { can } = useAdminAuth();
  const canPay = can("hr.payroll");
  const canManage = can("hr.manage");

  const [emp, setEmp] = useState<Employee | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [tab, setTab] = useState<
    "profile" | "compensation" | "documents" | "access" | "leave"
  >("profile");
  const [loading, setLoading] = useState(true);
  const [docModal, setDocModal] = useState<EmployeeDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("CONTRACT");

  const load = () => {
    apiClient
      .get(`/admin/hr/employees/${id}`)
      .then((r: unknown) => setEmp((r as { data: Employee }).data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
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

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    );
  if (!emp)
    return (
      <div className="text-center py-20 text-gray-400">Employee not found</div>
    );

  const saveProfile = async (patch: Record<string, unknown>) => {
    try {
      await apiClient.patch(`/admin/hr/employees/${id}`, patch);
      toast.success("Saved");
      load();
    } catch {}
  };
  const setAccess = async (patch: Record<string, unknown>) => {
    try {
      const r = (await apiClient.patch(
        `/admin/hr/employees/${id}/access`,
        patch,
      )) as { data: { tempPassword?: string } };
      toast.success(
        r.data?.tempPassword
          ? `New password: ${r.data.tempPassword}`
          : "Updated",
      );
      load();
    } catch {}
  };
  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      await apiClient.post(`/admin/hr/employees/${id}/documents`, {
        type: docType,
        dataUrl,
        fileName: file.name,
        mimeType: file.type,
      });
      toast.success("Document uploaded");
      load();
    } catch {
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };
  const deleteDoc = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await apiClient.delete(`/admin/hr/documents/${docId}`);
      toast.success("Deleted");
      load();
    } catch {}
  };

  const tabs: { key: typeof tab; label: string; show: boolean }[] = [
    { key: "profile", label: "Profile", show: true },
    { key: "compensation", label: "Compensation", show: canPay },
    { key: "documents", label: "Documents", show: true },
    { key: "access", label: "Access", show: canManage },
    { key: "leave", label: "Leave", show: true },
  ];

  return (
    <RequirePermission perm="hr.view">
      <div className="space-y-5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm"
        >
          <ArrowLeft size={16} /> Back to Employees
        </button>

        <div className="card flex flex-col sm:flex-row gap-6 items-start">
          <Avatar src={emp.image} name={emp.name} size={84} />
          <div className="flex-1">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{emp.name}</h2>
                <p className="text-gray-500 text-sm">
                  {emp.position || "—"}
                  {emp.department?.name ? ` · ${emp.department.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  label={(emp.status ?? "ACTIVE").replace("_", " ")}
                  variant="info"
                />
                {emp.canLogin ? (
                  <Badge
                    label={
                      emp.isSuperAdmin
                        ? "Super Admin"
                        : (emp.role?.name ?? "No role")
                    }
                    variant="success"
                  />
                ) : (
                  <Badge label="No login" variant="default" />
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ["Email", emp.email],
                ["Phone", emp.phone || "—"],
                ["Type", (emp.employmentType ?? "").replace("_", " ")],
                ["Leave balance", `${emp.leaveBalance ?? 0} days`],
              ].map(([l, v]) => (
                <div key={l} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 uppercase font-semibold">
                    {l}
                  </p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {t.label}
              </button>
            ))}
        </div>

        <div className="card">
          {tab === "profile" && (
            <ProfileTab
              emp={emp}
              depts={depts}
              canManage={canManage}
              onSave={saveProfile}
            />
          )}
          {tab === "compensation" && canPay && (
            <CompensationTab emp={emp} onSave={saveProfile} reload={load} />
          )}
          {tab === "documents" && (
            <div>
              {canManage && (
                <div className="flex items-end gap-3 mb-5">
                  <div>
                    <label className="label">Document type</label>
                    <select
                      className="input"
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                    >
                      {DOC_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Upload size={15} /> Upload
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={onPickFile}
                  />
                </div>
              )}
              {emp.documents?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {emp.documents.map((d) => (
                    <div
                      key={d.id}
                      className="border border-border rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-ink text-sm">
                          {d.type.replace("_", " ")}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => deleteDoc(d.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setDocModal(d)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-teal-600 hover:bg-teal-500/10 transition-colors"
                        title="View document"
                      >
                        <Eye size={16} />
                      </button>
                      <p className="text-caption text-gray-400 mt-2">
                        {format(new Date(d.createdAt), "dd MMM yyyy")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No documents uploaded.</p>
              )}
            </div>
          )}
          {tab === "access" && canManage && (
            <AccessTab emp={emp} roles={roles} onSet={setAccess} />
          )}
          {tab === "leave" && (
            <LeaveTab emp={emp} canManage={canManage} reload={load} />
          )}
        </div>
      </div>

      <Modal
        open={!!docModal}
        onClose={() => setDocModal(null)}
        title={docModal ? docModal.type.replace("_", " ") : ""}
        maxWidth="max-w-3xl"
      >
        {docModal && (
          <div>
            {docModal.mimeType?.startsWith("image") ||
            /\.(png|jpe?g|webp|gif)$/i.test(docModal.fileUrl) ? (
              <img
                src={docModal.fileUrl}
                alt={docModal.type}
                className="w-full rounded-lg max-h-[70vh] object-contain bg-gray-50"
              />
            ) : (
              <iframe
                src={docModal.fileUrl}
                className="w-full h-[70vh] rounded-lg border border-border"
                title="document"
              />
            )}
            <a
              href={docModal.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-teal-600 text-sm font-medium"
            >
              <ExternalLink size={14} /> Open in new tab
            </a>
          </div>
        )}
      </Modal>
    </RequirePermission>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function ProfileTab({
  emp,
  depts,
  canManage,
  onSave,
}: {
  emp: Employee;
  depts: Department[];
  canManage: boolean;
  onSave: (p: Record<string, unknown>) => void;
}) {
  const [f, setF] = useState({
    name: emp.name,
    phone: emp.phone ?? "",
    position: emp.position ?? "",
    departmentId: emp.departmentId ?? "",
    employmentType: emp.employmentType ?? "FULL_TIME",
    status: emp.status ?? "ACTIVE",
    hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : "",
  });
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field
          label="Name"
          value={f.name}
          onChange={(v) => setF((s) => ({ ...s, name: v }))}
          disabled={!canManage}
        />
        <Field
          label="Phone"
          value={f.phone}
          onChange={(v) => setF((s) => ({ ...s, phone: v }))}
          disabled={!canManage}
        />
        <Field
          label="Position"
          value={f.position}
          onChange={(v) => setF((s) => ({ ...s, position: v }))}
          disabled={!canManage}
        />
        <div>
          <label className="label">Department</label>
          <select
            className="input"
            value={f.departmentId}
            disabled={!canManage}
            onChange={(e) =>
              setF((s) => ({ ...s, departmentId: e.target.value }))
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
            value={f.employmentType}
            disabled={!canManage}
            onChange={(e) =>
              setF((s) => ({ ...s, employmentType: e.target.value }))
            }
          >
            {["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"].map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={f.status}
            disabled={!canManage}
            onChange={(e) => setF((s) => ({ ...s, status: e.target.value }))}
          >
            {[
              "ONBOARDING",
              "ACTIVE",
              "ON_LEAVE",
              "SUSPENDED",
              "TERMINATED",
            ].map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Hire date"
          type="date"
          value={f.hireDate}
          onChange={(v) => setF((s) => ({ ...s, hireDate: v }))}
          disabled={!canManage}
        />
      </div>
      {canManage && (
        <button onClick={() => onSave(f)} className="btn-primary mt-5">
          Save changes
        </button>
      )}
    </div>
  );
}

function CompensationTab({
  emp,
  onSave,
  reload,
}: {
  emp: Employee;
  onSave: (p: Record<string, unknown>) => void;
  reload: () => void;
}) {
  const [salary, setSalary] = useState(String(toMajorUnits(emp.salary ?? 0)));
  const [payCycle, setPayCycle] = useState(emp.payCycle ?? "MONTHLY");
  const ngn = (n: number) => formatMoney(n);
  const markPaid = async (pid: string) => {
    try {
      await apiClient.patch(`/admin/hr/payslips/${pid}/paid`, {});
      toast.success("Marked paid");
      reload();
    } catch {}
  };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field
          label="Salary (₦)"
          type="number"
          value={salary}
          onChange={setSalary}
        />
        <div>
          <label className="label">Pay cycle</label>
          <select
            className="input"
            value={payCycle}
            onChange={(e) => setPayCycle(e.target.value)}
          >
            {["MONTHLY", "BIWEEKLY", "WEEKLY"].map((t) => (
              <option key={t} value={t}>
                {t.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() =>
              onSave({
                salary: toStoredAmount(parseFloat(salary) || 0),
                payCycle,
              })
            }
            className="btn-primary"
          >
            Save
          </button>
        </div>
      </div>
      <div>
        <p className="section-title mb-3">Payslips</p>
        {emp.payslips?.length ? (
          <div className="space-y-2">
            {emp.payslips.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border border-border rounded-xl px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-ink text-sm">
                    {p.periodLabel}
                  </p>
                  <p className="text-caption text-gray-400">
                    Net {ngn(p.net)} · gross {ngn(p.gross)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    label={p.status}
                    variant={p.status === "PAID" ? "success" : "warning"}
                  />
                  {p.status !== "PAID" && (
                    <button
                      onClick={() => markPaid(p.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-success-50 text-success-600 hover:bg-success-100 flex items-center gap-1"
                    >
                      <Check size={13} /> Mark paid
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            No payslips yet. Generate them from the Payroll page.
          </p>
        )}
      </div>
    </div>
  );
}

function AccessTab({
  emp,
  roles,
  onSet,
}: {
  emp: Employee;
  roles: Role[];
  onSet: (p: Record<string, unknown>) => void;
}) {
  const [roleId, setRoleId] = useState(emp.roleId ?? "");
  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-ink">Admin-panel access</p>
          <p className="text-sm text-gray-500">
            Allow this employee to log into the admin panel.
          </p>
        </div>
        <Toggle
          checked={!!emp.canLogin}
          onChange={(v) => onSet({ canLogin: v })}
          disabled={emp.isSuperAdmin}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-ink">Account active</p>
          <p className="text-sm text-gray-500">
            Disable to revoke access without deleting.
          </p>
        </div>
        <Toggle
          checked={emp.isActive !== false}
          onChange={(v) => onSet({ isActive: v })}
          disabled={emp.isSuperAdmin}
        />
      </div>
      <div>
        <label className="label">Role</label>
        <div className="flex gap-2">
          <select
            className="input"
            value={roleId}
            disabled={emp.isSuperAdmin}
            onChange={(e) => setRoleId(e.target.value)}
          >
            <option value="">— No role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => onSet({ roleId: roleId || null })}
            disabled={emp.isSuperAdmin}
            className="btn-primary"
          >
            Set
          </button>
        </div>
      </div>
      {!emp.isSuperAdmin && (
        <button
          onClick={() => onSet({ resetPassword: true })}
          className="btn-outline flex items-center gap-2"
        >
          <KeyRound size={15} /> Reset password
        </button>
      )}
    </div>
  );
}

function LeaveTab({
  emp,
  canManage,
  reload,
}: {
  emp: Employee;
  canManage: boolean;
  reload: () => void;
}) {
  const [show, setShow] = useState(false);
  const [f, setF] = useState({
    type: "ANNUAL",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const add = async () => {
    if (!f.startDate || !f.endDate) {
      toast.error("Pick dates");
      return;
    }
    try {
      await apiClient.post("/admin/hr/leave", { employeeId: emp.id, ...f });
      toast.success("Leave recorded");
      setShow(false);
      reload();
    } catch {}
  };
  return (
    <div>
      {canManage && (
        <button onClick={() => setShow(true)} className="btn-primary mb-4">
          Record leave
        </button>
      )}
      {emp.leaveRequests?.length ? (
        <div className="space-y-2">
          {emp.leaveRequests.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between border border-border rounded-xl px-4 py-3"
            >
              <div>
                <p className="font-semibold text-ink text-sm">
                  {l.type} · {l.days} day{l.days === 1 ? "" : "s"}
                </p>
                <p className="text-caption text-gray-400">
                  {format(new Date(l.startDate), "dd MMM")} –{" "}
                  {format(new Date(l.endDate), "dd MMM yyyy")}
                </p>
              </div>
              <Badge
                label={l.status}
                variant={
                  l.status === "APPROVED"
                    ? "success"
                    : l.status === "REJECTED"
                      ? "danger"
                      : "warning"
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">No leave records.</p>
      )}

      <Modal
        open={show}
        onClose={() => setShow(false)}
        title="Record leave"
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={f.type}
              onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}
            >
              {[
                "ANNUAL",
                "SICK",
                "MATERNITY",
                "PATERNITY",
                "UNPAID",
                "OTHER",
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                className="input"
                value={f.startDate}
                onChange={(e) =>
                  setF((s) => ({ ...s, startDate: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                className="input"
                value={f.endDate}
                onChange={(e) =>
                  setF((s) => ({ ...s, endDate: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label className="label">Reason</label>
            <input
              className="input"
              value={f.reason}
              onChange={(e) => setF((s) => ({ ...s, reason: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={() => setShow(false)} className="btn-ghost flex-1">
            Cancel
          </button>
          <button onClick={add} className="btn-primary flex-1">
            Record
          </button>
        </div>
      </Modal>
    </div>
  );
}
