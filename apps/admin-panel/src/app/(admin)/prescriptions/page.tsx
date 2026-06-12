"use client";
import { useEffect, useState } from "react";
import { FileText, Download, Pill } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";

interface Rx {
  id: string;
  code: string;
  status: "ISSUED" | "DISPENSED" | "CANCELLED";
  signedAt: string;
  diagnosis: string;
  notes: string;
  userId?: string;
  doctor?: { name: string; image?: string; designation?: string };
  user?: { name: string; image?: string };
  subPatient?: { name: string } | null;
  _count?: { items: number };
  items?: {
    id: string;
    drugName: string;
    dosage: string;
    frequency: string;
    duration: string;
    refills: number;
    instructions: string;
  }[];
  refillRequests?: {
    id: string;
    status: "PENDING" | "APPROVED" | "DECLINED";
    patientNote: string;
    doctorNote: string;
    createdAt: string;
    decidedAt: string | null;
  }[];
}

const REFILL_VARIANT: Record<
  "PENDING" | "APPROVED" | "DECLINED",
  "info" | "success" | "danger"
> = { PENDING: "info", APPROVED: "success", DECLINED: "danger" };

const STATUS: Record<Rx["status"], "info" | "success" | "danger"> = {
  ISSUED: "info",
  DISPENSED: "success",
  CANCELLED: "danger",
};
const STATUS_LABEL: Record<Rx["status"], string> = {
  ISSUED: "Active",
  DISPENSED: "Dispensed",
  CANCELLED: "Cancelled",
};

async function openPdf(id: string) {
  try {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
    const res = await fetch(`${base}/prescriptions/${id}/pdf`, {
      credentials: "include", // send the httpOnly admin session cookie
    });
    if (!res.ok) throw new Error("Could not load PDF");
    const url = URL.createObjectURL(await res.blob());
    window.open(url, "_blank");
  } catch {
    toast.error("Could not open the prescription PDF");
  }
}

export default function PrescriptionsPage() {
  const [rows, setRows] = useState<Rx[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Rx | null>(null);
  const PAGE_SIZE = 15;

  useEffect(() => {
    apiClient
      .get("/admin/prescriptions", { params: { page, limit: PAGE_SIZE } })
      .then((r: unknown) => setRows((r as { data: Rx[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  const openDetail = async (id: string) => {
    try {
      const r = (await apiClient.get(`/admin/prescriptions/${id}`)) as {
        data: Rx;
      };
      setDetail(r.data);
    } catch {
      /* surfaced by interceptor */
    }
  };

  const cols: Column<Rx>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => (
        <span className="text-gray-400 font-semibold tabular-nums">
          {(page - 1) * PAGE_SIZE + i + 1}
        </span>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.user?.image} name={r.user?.name} size={34} />
          <div>
            <p>
              <PatientLink
                id={r.userId}
                name={r.subPatient?.name || r.user?.name}
                className="font-semibold text-ink"
              />
            </p>
            {r.subPatient ? (
              <p className="text-caption text-gray-400">
                under <PatientLink id={r.userId} name={r.user?.name} />
              </p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (r) => (
        <span className="text-gray-600">Dr. {r.doctor?.name ?? "—"}</span>
      ),
    },
    {
      key: "meds",
      header: "Meds",
      render: (r) => (
        <span className="font-bold text-ink tabular-nums">
          {r._count?.items ?? 0}
        </span>
      ),
    },
    {
      key: "date",
      header: "Issued",
      render: (r) => (
        <span className="text-gray-500 tabular-nums">
          {format(new Date(r.signedAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge label={STATUS_LABEL[r.status]} variant={STATUS[r.status]} />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openDetail(r.id)}
            className="grid place-items-center w-8 h-8 rounded-lg text-gray-500 hover:bg-surfaceAlt hover:text-ink transition-colors"
            title="View"
          >
            <FileText size={15} />
          </button>
          <button
            onClick={() => openPdf(r.id)}
            className="grid place-items-center w-8 h-8 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
            title="Open PDF"
          >
            <Download size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Clinical</p>
        <h1 className="page-title mt-0.5">Prescriptions</h1>
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No prescriptions issued yet"
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Prescription"
        maxWidth="max-w-xl"
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  src={detail.doctor?.image}
                  name={detail.doctor?.name}
                  size={42}
                />
                <div>
                  <p className="font-bold text-ink">
                    Dr. {detail.doctor?.name}
                  </p>
                  <p className="text-caption text-gray-500">
                    {detail.doctor?.designation || "General practitioner"}
                  </p>
                </div>
              </div>
              <Badge
                label={STATUS_LABEL[detail.status]}
                variant={STATUS[detail.status]}
              />
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-body-md">
              <span className="text-gray-500">
                Patient:{" "}
                <b className="text-ink">
                  <PatientLink
                    id={detail.userId}
                    name={detail.subPatient?.name || detail.user?.name}
                  />
                </b>
              </span>
              <span className="text-gray-500">
                Issued:{" "}
                <b className="text-ink">
                  {format(new Date(detail.signedAt), "dd MMM yyyy")}
                </b>
              </span>
            </div>

            {detail.diagnosis ? (
              <div>
                <p className="eyebrow mb-1">Diagnosis</p>
                <p className="text-body-md text-gray-700">{detail.diagnosis}</p>
              </div>
            ) : null}

            <div>
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <Pill size={13} /> Medications
              </p>
              <div className="rounded-xl border border-hairline divide-y divide-hairline">
                {(detail.items ?? []).map((it) => (
                  <div key={it.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">
                        {it.drugName}
                      </span>
                      {it.refills > 0 ? (
                        <span className="text-micro font-bold text-navy-mid bg-surfaceAlt px-2 py-0.5 rounded-full">
                          {it.refills} refills
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-caption text-gray-500">
                      {it.dosage ? <span>{it.dosage}</span> : null}
                      {it.frequency ? <span>{it.frequency}</span> : null}
                      {it.duration ? <span>{it.duration}</span> : null}
                    </div>
                    {it.instructions ? (
                      <p className="mt-1 text-caption text-teal-600 italic">
                        ↳ {it.instructions}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {detail.notes ? (
              <div>
                <p className="eyebrow mb-1">Notes</p>
                <p className="text-body-md text-gray-700">{detail.notes}</p>
              </div>
            ) : null}

            {detail.refillRequests && detail.refillRequests.length > 0 ? (
              <div>
                <p className="eyebrow mb-2">Refill requests</p>
                <div className="space-y-2">
                  {detail.refillRequests.map((rr) => (
                    <div
                      key={rr.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-hairline px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-caption text-gray-500">
                          {format(new Date(rr.createdAt), "dd MMM yyyy, HH:mm")}
                        </p>
                        {rr.patientNote ? (
                          <p className="text-caption text-gray-600 mt-0.5 truncate">
                            Patient: “{rr.patientNote}”
                          </p>
                        ) : null}
                        {rr.doctorNote ? (
                          <p className="text-caption text-gray-600 mt-0.5 truncate">
                            Doctor: “{rr.doctorNote}”
                          </p>
                        ) : null}
                      </div>
                      <Badge
                        label={
                          rr.status === "PENDING"
                            ? "Pending"
                            : rr.status === "APPROVED"
                              ? "Approved"
                              : "Declined"
                        }
                        variant={REFILL_VARIANT[rr.status]}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <span className="text-caption text-gray-400">
                Ref: {detail.code}
              </span>
              <button
                onClick={() => openPdf(detail.id)}
                className="btn-secondary text-body-md"
              >
                <Download size={16} /> Open PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
