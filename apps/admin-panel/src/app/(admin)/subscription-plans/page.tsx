"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatMoney, toStoredAmount, toMajorUnits } from "@/lib/money";
import type { SubscriptionPlan } from "@/types";

const PATIENT_BENEFITS = {
  consultsPerCycle: 2,
  memberDiscountPercent: 10,
  familyCap: 1,
  unlimitedChat: false,
  priorityBooking: false,
  freeRxDelivery: false,
  waivedBookingFee: true,
};
const DOCTOR_BENEFITS = {
  commissionPercent: 12,
  featured: true,
  advancedAnalytics: false,
  aiScribe: false,
};

const emptyForm = {
  id: "",
  code: "",
  name: "",
  description: "",
  audience: "USER",
  interval: "MONTHLY",
  price: "",
  trialDays: "0",
  sortOrder: "0",
  benefits: JSON.stringify(PATIENT_BENEFITS, null, 2),
};

export default function SubscriptionPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const editing = !!form.id;

  const load = async () => {
    apiClient
      .get("/admin/subscription-plans")
      .then((r: unknown) =>
        setPlans((r as { data: SubscriptionPlan[] }).data ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm({ ...emptyForm });
    setShowForm(true);
  };
  const openEdit = (p: SubscriptionPlan) => {
    setForm({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      audience: p.audience,
      interval: p.interval,
      price: String(toMajorUnits(p.price)),
      trialDays: String(p.trialDays),
      sortOrder: String(p.sortOrder),
      benefits: JSON.stringify(p.benefits ?? {}, null, 2),
    });
    setShowForm(true);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await apiClient.patch(`/admin/subscription-plans/${id}/toggle`, {
      isActive: !isActive,
    });
    toast.success(isActive ? "Plan deactivated" : "Plan activated");
    load();
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Delete this plan? (Plans with subscribers cannot be deleted — deactivate instead.)",
      )
    )
      return;
    try {
      await apiClient.delete(`/admin/subscription-plans/${id}`);
      toast.success("Plan deleted");
      load();
    } catch {}
  };

  const handleSave = async () => {
    let benefits: Record<string, unknown>;
    try {
      benefits = JSON.parse(form.benefits || "{}");
    } catch {
      toast.error("Benefits must be valid JSON");
      return;
    }
    setSaving(true);
    try {
      const body = {
        code: form.code,
        name: form.name,
        description: form.description,
        audience: form.audience,
        interval: form.interval,
        price: toStoredAmount(parseFloat(form.price) || 0),
        trialDays: parseInt(form.trialDays, 10) || 0,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        benefits,
      };
      if (editing) {
        await apiClient.patch(`/admin/subscription-plans/${form.id}`, body);
        toast.success("Plan updated");
      } else {
        await apiClient.post("/admin/subscription-plans", body);
        toast.success("Plan created");
      }
      setShowForm(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // When the audience switches on a fresh plan, swap in the matching benefits template.
  const onAudienceChange = (audience: string) => {
    setForm((f) => ({
      ...f,
      audience,
      benefits: editing
        ? f.benefits
        : JSON.stringify(
            audience === "DOCTOR" ? DOCTOR_BENEFITS : PATIENT_BENEFITS,
            null,
            2,
          ),
    }));
  };

  const cols: Column<SubscriptionPlan>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "name",
      header: "Plan",
      render: (r) => (
        <div className="leading-tight">
          <p className="font-semibold text-ink">{r.name}</p>
          <p className="font-mono text-caption text-gray-400">{r.code}</p>
        </div>
      ),
    },
    {
      key: "audience",
      header: "For",
      render: (r) => (
        <Badge
          label={r.audience === "DOCTOR" ? "Doctors" : "Patients"}
          variant={r.audience === "DOCTOR" ? "info" : "success"}
        />
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (r) => (
        <span className="font-bold tabular-nums">
          {r.price > 0 ? formatMoney(r.price) : "Free"}
        </span>
      ),
    },
    {
      key: "interval",
      header: "Billing",
      render: (r) => (
        <span className="text-gray-500 capitalize">
          {r.interval.toLowerCase()}
        </span>
      ),
    },
    {
      key: "trial",
      header: "Trial",
      render: (r) => (r.trialDays > 0 ? `${r.trialDays}d` : "—"),
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

  const field = (
    key: keyof typeof form,
    label: string,
    type = "text",
    options?: string[],
  ) => (
    <div key={key}>
      <label className="label">{label}</label>
      {options ? (
        <select
          className="input"
          value={form[key]}
          onChange={(e) =>
            key === "audience"
              ? onAudienceChange(e.target.value)
              : setField(key, e.target.value)
          }
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          className="input"
          value={form[key]}
          onChange={(e) => setField(key, e.target.value)}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="page-title mt-0.5">DoctiumPlus Plans</h1>
        </div>
        <button
          onClick={openCreate}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Plan
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={plans}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No plans yet — create your first tier"
        />
      </div>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Plan" : "Create Plan"}
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("code", "Code (unique, e.g. patient_basic)")}
          {field("name", "Name")}
          {field("audience", "Audience", "text", ["USER", "DOCTOR"])}
          {field("interval", "Billing Interval", "text", [
            "MONTHLY",
            "QUARTERLY",
            "YEARLY",
          ])}
          {field("price", "Price (₦)", "number")}
          {field("trialDays", "Trial Days", "number")}
          {field("sortOrder", "Sort Order", "number")}
          <div className="col-span-2">
            {field("description", "Description")}
          </div>
          <div className="col-span-2">
            <label className="label">Benefits (JSON)</label>
            <textarea
              className="input font-mono text-[12px] leading-relaxed"
              rows={9}
              value={form.benefits}
              onChange={(e) => setField("benefits", e.target.value)}
            />
            <p className="text-caption text-gray-400 mt-1">
              {form.audience === "DOCTOR"
                ? "Keys: commissionPercent (null = platform default), featured, advancedAnalytics, aiScribe"
                : "Keys: consultsPerCycle, memberDiscountPercent, familyCap, unlimitedChat, priorityBooking, freeRxDelivery, waivedBookingFee"}
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button
            onClick={() => setShowForm(false)}
            className="btn-ghost flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving ? "Saving..." : editing ? "Save Changes" : "Create Plan"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
