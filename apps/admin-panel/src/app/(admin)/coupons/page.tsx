"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { formatMoney, toStoredAmount } from "@/lib/money";
import type { Coupon } from "@/types";
import { format } from "date-fns";

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    description: "",
    expiryDate: "",
    discountPercent: "",
    maxDiscount: "",
    minAmountToApply: "",
    type: "APPOINTMENT",
    discountType: "PERCENT",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    apiClient
      .get("/admin/coupons")
      .then((r: unknown) => setCoupons((r as { data: Coupon[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (id: string, isActive: boolean) => {
    await apiClient.patch(`/admin/coupons/${id}/toggle`, {
      isActive: !isActive,
    });
    toast.success(isActive ? "Coupon deactivated" : "Coupon activated");
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    await apiClient.delete(`/admin/coupons/${id}`);
    toast.success("Coupon deleted");
    load();
  };

  const handleAdd = async () => {
    setSaving(true);
    try {
      // FLAT coupons store a kobo amount in discountPercent; PERCENT stores a %.
      // maxDiscount + minAmountToApply are always money (kobo).
      const isFlat = form.discountType === "FLAT";
      await apiClient.post("/admin/coupons", {
        ...form,
        discountPercent: form.discountPercent
          ? isFlat
            ? toStoredAmount(parseFloat(form.discountPercent))
            : parseFloat(form.discountPercent)
          : undefined,
        maxDiscount: form.maxDiscount
          ? toStoredAmount(parseFloat(form.maxDiscount))
          : undefined,
        minAmountToApply: toStoredAmount(
          parseFloat(form.minAmountToApply) || 0,
        ),
      });
      toast.success("Coupon created");
      setShowAdd(false);
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<Coupon>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "code",
      header: "Code",
      render: (r) => (
        <span className="font-mono font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
          {r.code}
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      render: (r) => <span className="font-medium">{r.title}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (r) => <Badge label={r.type} variant="info" />,
    },
    {
      key: "discount",
      header: "Discount",
      render: (r) => (
        <span className="font-semibold">
          {r.discountType === "FLAT"
            ? formatMoney(r.discountPercent ?? 0)
            : `${r.discountPercent}%`}{" "}
          {r.maxDiscount ? `(max ${formatMoney(r.maxDiscount)})` : ""}
        </span>
      ),
    },
    {
      key: "minAmount",
      header: "Min Amount",
      render: (r) => formatMoney(r.minAmountToApply ?? 0),
    },
    {
      key: "expiry",
      header: "Expires",
      render: (r) =>
        r.expiryDate ? (
          <span className="text-sm text-gray-500">{r.expiryDate}</span>
        ) : (
          "—"
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
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
        >
          <Trash2 size={15} />
        </button>
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
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
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
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Coupons</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Coupon
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={coupons}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No coupons created"
        />
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Create Coupon"
        maxWidth="max-w-xl"
      >
        <div className="grid grid-cols-2 gap-4">
          {field("code", "Coupon Code")}
          {field("title", "Title")}
          {field("description", "Description")}
          {field("expiryDate", "Expiry Date", "date")}
          {field("type", "Type", "text", ["APPOINTMENT", "WALLET"])}
          {field("discountType", "Discount Type", "text", ["PERCENT", "FLAT"])}
          {field("discountPercent", "Discount %", "number")}
          {field("maxDiscount", "Max Discount (₦)", "number")}
          {field("minAmountToApply", "Min Amount to Apply", "number")}
        </div>
        <div className="flex gap-3 mt-5">
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
            {saving ? "Saving..." : "Create Coupon"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
