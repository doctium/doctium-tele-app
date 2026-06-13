"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";

interface Holiday {
  id: string;
  date: string;
  doctor?: { id: string; name: string; image?: string; designation?: string };
}
interface Doctor {
  id: string;
  name: string;
  image?: string;
  designation?: string;
}

export default function DoctorHolidayPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ doctorId: "", date: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    Promise.all([
      apiClient.get("/admin/doctor-holidays") as Promise<{ data: Holiday[] }>,
      apiClient.get("/admin/doctors") as Promise<{ data: Doctor[] }>,
    ])
      .then(([h, d]) => {
        setHolidays(h.data ?? []);
        setDoctors(d.data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    await apiClient.delete(`/admin/doctor-holidays/${id}`);
    toast.success("Holiday removed");
    load();
  };

  const handleAdd = async () => {
    if (!form.doctorId || !form.date) return;
    setSaving(true);
    try {
      await apiClient.post("/admin/doctor-holidays", form);
      toast.success("Holiday added");
      setShowAdd(false);
      setForm({ doctorId: "", date: "" });
      load();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<Holiday>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.doctor?.image} name={r.doctor?.name} size={36} />
          <div>
            <p className="font-medium">{r.doctor?.name}</p>
            <p className="text-xs text-gray-400">{r.doctor?.designation}</p>
          </div>
        </div>
      ),
    },
    {
      key: "date",
      header: "Holiday Date",
      render: (r) => <span className="font-semibold">{r.date}</span>,
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Doctor Holidays</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} /> Add Holiday
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={holidays}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No holidays scheduled"
        />
      </div>
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Doctor Holiday"
      >
        <div className="space-y-4">
          <div>
            <label className="label">Select Doctor</label>
            <select
              className="input"
              value={form.doctorId}
              onChange={(e) =>
                setForm((f) => ({ ...f, doctorId: e.target.value }))
              }
            >
              <option value="">Choose a doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Holiday Date</label>
            <input
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
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
              {saving ? "Saving..." : "Add Holiday"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
