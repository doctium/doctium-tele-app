"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { apiClient } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";

interface Org {
  id: string;
  name: string;
  type: string;
  contactName: string;
  contactEmail: string;
  status: "ACTIVE" | "SUSPENDED";
  memberCount: number;
  sponsorshipCount: number;
  createdAt: string;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { can } = useAdminAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "HMO",
    contactName: "",
    contactEmail: "",
  });

  const load = () => {
    apiClient
      .get("/admin/organizations")
      .then((r) => setOrgs((r as { data: Org[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const r = (await apiClient.post("/admin/organizations", form)) as {
        data: Org;
      };
      setShowForm(false);
      setForm({ name: "", type: "HMO", contactName: "", contactEmail: "" });
      router.push(`/organizations/${r.data.id}`);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<Org>[] = [
    {
      key: "name",
      header: "Organization",
      render: (r) => (
        <button
          className="flex items-center gap-3 text-left"
          onClick={() => router.push(`/organizations/${r.id}`)}
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-navy text-white">
            <Building2 size={16} />
          </div>
          <div>
            <p className="font-semibold text-ink hover:underline">{r.name}</p>
            <p className="text-caption text-gray-400">
              {r.type || "—"}
              {r.contactEmail ? ` · ${r.contactEmail}` : ""}
            </p>
          </div>
        </button>
      ),
    },
    {
      key: "memberCount",
      header: "Members",
      render: (r) => (
        <span className="font-bold tabular-nums text-ink">
          {r.memberCount}
        </span>
      ),
    },
    {
      key: "sponsorshipCount",
      header: "Sponsorships",
      render: (r) => (
        <span className="tabular-nums text-gray-600">{r.sponsorshipCount}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span
          className={
            r.status === "ACTIVE"
              ? "inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-micro font-bold text-teal-600 ring-1 ring-inset ring-teal-500/20"
              : "inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-micro font-bold text-gray-500 ring-1 ring-inset ring-gray-300"
          }
        >
          {r.status === "ACTIVE" ? "Active" : "Suspended"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Enterprise</p>
          <h1 className="page-title mt-1">Organizations</h1>
          <p className="mt-1 text-body-md text-gray-500">
            HMOs, employers and health systems sponsoring care-program seats for
            their members.
          </p>
        </div>
        {can("enterprise.manage") ? (
          <button
            className="btn-primary"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus size={16} /> New organization
          </button>
        ) : null}
      </div>

      {showForm ? (
        <div className="card">
          <h2 className="section-title mb-4">New organization</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Hygeia HMO"
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="HMO">HMO / Insurer</option>
                <option value="EMPLOYER">Employer / Corporate</option>
                <option value="HEALTH_SYSTEM">Health system</option>
              </select>
            </div>
            <div>
              <label className="label">Contact name</label>
              <input
                className="input"
                value={form.contactName}
                onChange={(e) =>
                  setForm({ ...form, contactName: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Contact email</label>
              <input
                className="input"
                value={form.contactEmail}
                onChange={(e) =>
                  setForm({ ...form, contactEmail: e.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-5 flex gap-3">
            <button
              className="btn-primary"
              onClick={create}
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Creating…" : "Create organization"}
            </button>
            <button className="btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <DataTable
          columns={cols}
          data={orgs}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No organizations yet — create the first enterprise customer"
        />
      </div>
    </div>
  );
}
