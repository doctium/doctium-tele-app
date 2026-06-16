"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import type { Doctor } from "@/types";
import { SUPPORTED_LANGUAGES } from "@doctium/types";

// Mirrors the doctor app signup specialty options.
const SPECIALTIES = ["General Practitioner", "Resident Doctor", "Consultant"];

const TABS: { label: string; status?: string }[] = [
  { label: "All" },
  { label: "New Registrations", status: "NEW" },
  { label: "Pending KYC", status: "PENDING_KYC" },
  { label: "Under Review", status: "UNDER_REVIEW" },
  { label: "Verified", status: "VERIFIED" },
  { label: "Rejected", status: "REJECTED" },
];

const STATUS_VARIANT: Record<
  string,
  "info" | "success" | "danger" | "warning" | "default"
> = {
  NEW: "info",
  PENDING_KYC: "warning",
  UNDER_REVIEW: "info",
  VERIFIED: "success",
  REJECTED: "danger",
  EXPIRED: "danger",
};
const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  PENDING_KYC: "Pending KYC",
  UNDER_REVIEW: "Under Review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

export default function DoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    password: "",
    speciality: "",
    consultantSpeciality: "",
    languages: [] as string[],
    verify: false,
  });
  const [saving, setSaving] = useState(false);
  const PAGE_SIZE = 15;

  const load = async () => {
    setLoading(true);
    try {
      const status = TABS.find((t) => t.label === tab)?.status;
      const res = (await apiClient.get("/admin/doctor-registrations", {
        params: { page, limit: PAGE_SIZE, status },
      })) as { data: { items: Doctor[]; total: number } };
      setDoctors(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const setBlocked = async (id: string, blocked: boolean) => {
    setDoctors((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isBlock: blocked } : d)),
    );
    try {
      await apiClient.patch(`/admin/doctors/${id}/block`, { isBlock: blocked });
      toast.success(
        blocked
          ? "Doctor blocked — they have been notified"
          : "Doctor unblocked",
      );
    } catch {
      setDoctors((prev) =>
        prev.map((d) => (d.id === id ? { ...d, isBlock: !blocked } : d)),
      );
    }
  };

  const handleAdd = async () => {
    if (
      !form.firstName ||
      !form.lastName ||
      !form.email ||
      !form.mobile ||
      !form.password ||
      !form.speciality
    ) {
      toast.error(
        "First name, last name, email, mobile, password and specialty are required",
      );
      return;
    }
    setSaving(true);
    try {
      const res = (await apiClient.post("/admin/doctors", form)) as {
        data: { tempPassword?: string };
      };
      toast.success(
        res.data?.tempPassword
          ? `Doctor created. Temp password: ${res.data.tempPassword}`
          : "Doctor created",
      );
      setShowAdd(false);
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        password: "",
        speciality: "",
        consultantSpeciality: "",
        languages: [],
        verify: false,
      });
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const filtered = doctors.filter(
    (d) =>
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase()),
  );

  const cols: Column<Doctor>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => (
        <span className="text-gray-400 text-sm">
          {(page - 1) * PAGE_SIZE + i + 1}
        </span>
      ),
    },
    {
      key: "name",
      header: "Doctor",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.image} name={r.name} size={38} />
          <div>
            <p className="font-semibold text-gray-900">{r.name}</p>
            <p className="text-xs text-gray-400">{r.designation || r.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "verification",
      header: "Verification",
      render: (r) => (
        <Badge
          label={
            STATUS_LABEL[r.verificationStatus ?? "NEW"] ??
            r.verificationStatus ??
            "—"
          }
          variant={STATUS_VARIANT[r.verificationStatus ?? "NEW"] ?? "default"}
        />
      ),
    },
    {
      key: "block",
      header: "Account",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Toggle
            checked={!r.isBlock}
            onChange={(active) => setBlocked(r.id, !active)}
          />
          <span
            className={`text-xs font-semibold ${r.isBlock ? "text-alert" : "text-success-600"}`}
          >
            {r.isBlock ? "Blocked" : "Active"}
          </span>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (r) => (
        <span className="text-gray-500 text-sm">
          {format(new Date(r.createdAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <button
          onClick={() => router.push(`/doctors/${r.id}`)}
          className="btn-ghost text-xs px-3 py-1.5"
        >
          Review
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Doctors</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} doctors</p>
        </div>
        <div className="flex items-center gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search doctors..."
          />
          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> Add Doctor
          </button>
        </div>
      </div>
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => {
              setTab(t.label);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.label ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={filtered}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No doctors found"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Doctor"
        maxWidth="max-w-lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">First name</label>
            <input
              className="input"
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Last name</label>
            <input
              className="input"
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
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
            <label className="label">Mobile</label>
            <input
              className="input"
              value={form.mobile}
              onChange={(e) =>
                setForm((f) => ({ ...f, mobile: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              placeholder="Set a temporary password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="label">Specialty</label>
            <select
              className="input"
              value={form.speciality}
              onChange={(e) =>
                setForm((f) => ({ ...f, speciality: e.target.value }))
              }
            >
              <option value="">Select specialty</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {form.speciality === "Consultant" ? (
            <div className="col-span-2">
              <label className="label">Consultant specialty</label>
              <input
                className="input"
                placeholder="e.g. Cardiology"
                value={form.consultantSpeciality}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    consultantSpeciality: e.target.value,
                  }))
                }
              />
            </div>
          ) : null}
        </div>
        <div className="mt-4">
          <label className="label">Languages spoken</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {SUPPORTED_LANGUAGES.map((l) => {
              const on = form.languages.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      languages: on
                        ? f.languages.filter((c) => c !== l.code)
                        : [...f.languages, l.code],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    on
                      ? "bg-[#2CB7A7] text-white border-[#2CB7A7]"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={form.verify}
            onChange={(e) =>
              setForm((f) => ({ ...f, verify: e.target.checked }))
            }
          />
          Mark as Verified immediately (skip KYC — only if you have vetted this
          doctor)
        </label>
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
            {saving ? "Creating..." : "Create Doctor"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
