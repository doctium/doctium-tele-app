"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  Download,
  Search,
  Droplet,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";

interface PatientRow {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  image?: string;
  healthProfile?: { bloodType?: string } | null;
  _count?: {
    medicalConditions: number;
    allergies: number;
    clinicalNotes: number;
    medicalFiles: number;
    prescriptions: number;
  };
}

interface FullRecord {
  patient: {
    id: string;
    name: string;
    image?: string;
    mobile?: string;
    gender?: string;
    dob?: string;
    age?: number;
    healthProfile?: {
      bloodType?: string;
      genotype?: string;
      heightCm?: number;
      weightKg?: number;
    } | null;
    medicalConditions?: {
      id: string;
      name: string;
      status: string;
      onsetDate?: string;
    }[];
    allergies?: {
      id: string;
      substance: string;
      reaction?: string;
      severity: string;
    }[];
    surgeries?: { id: string; name: string; performedDate?: string }[];
    immunizations?: { id: string; vaccine: string; dateGiven?: string }[];
    medicalFiles?: {
      id: string;
      fileName: string;
      fileUrl: string;
      category: string;
    }[];
  };
  clinicalNotes?: {
    id: string;
    assessment: string;
    plan: string;
    createdAt: string;
    doctor?: { name: string };
  }[];
  prescriptions?: {
    id: string;
    diagnosis: string;
    createdAt: string;
    _count?: { items: number };
  }[];
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

async function downloadFhir(userId: string, name: string) {
  try {
    const res = await fetch(`${API_BASE}/admin/emr/patient/${userId}/fhir`, {
      credentials: "include", // send the httpOnly admin session cookie
    });
    if (!res.ok) throw new Error();
    const body = await res.json();
    const bundle = body.data ?? body;
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/fhir+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\s+/g, "-").toLowerCase()}-fhir.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Could not export the record");
  }
}

export default function MedicalRecordsPage() {
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<FullRecord | null>(null);
  const PAGE_SIZE = 15;

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .get("/admin/emr/patients", {
        params: { search: search || undefined, page, limit: PAGE_SIZE },
      })
      .then((r: unknown) =>
        setRows((r as { data: { items: PatientRow[] } }).data.items ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openDetail = async (id: string) => {
    try {
      const r = (await apiClient.get(`/admin/emr/patient/${id}`)) as {
        data: FullRecord;
      };
      setDetail(r.data);
    } catch {
      /* surfaced by interceptor */
    }
  };

  const cols: Column<PatientRow>[] = [
    {
      key: "patient",
      header: "Patient",
      render: (p) => (
        <div className="flex items-center gap-3">
          <Avatar src={p.image} name={p.name} size={34} />
          <div>
            <p>
              <PatientLink
                id={p.id}
                name={p.name}
                className="font-semibold text-ink"
              />
            </p>
            <p className="text-caption text-gray-400">
              {p.mobile || p.email || ""}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "blood",
      header: "Blood",
      render: (p) =>
        p.healthProfile?.bloodType ? (
          <span className="inline-flex items-center gap-1 text-caption font-bold text-alert-600">
            <Droplet size={12} /> {p.healthProfile.bloodType}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: "counts",
      header: "Record",
      render: (p) => (
        <div className="flex items-center gap-3 text-caption text-gray-500 tabular-nums">
          {(p._count?.allergies ?? 0) > 0 && (
            <span className="text-alert-600 font-semibold flex items-center gap-0.5">
              <AlertTriangle size={11} /> {p._count?.allergies}
            </span>
          )}
          <span title="Conditions">⚕ {p._count?.medicalConditions ?? 0}</span>
          <span title="Notes">📝 {p._count?.clinicalNotes ?? 0}</span>
          <span title="Files">📎 {p._count?.medicalFiles ?? 0}</span>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openDetail(p.id)}
            className="grid place-items-center w-8 h-8 rounded-lg text-gray-500 hover:bg-surfaceAlt hover:text-ink transition-colors"
            title="View record"
          >
            <Eye size={15} />
          </button>
          <button
            onClick={() => downloadFhir(p.id, p.name)}
            className="grid place-items-center w-8 h-8 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
            title="Export FHIR"
          >
            <Download size={15} />
          </button>
        </div>
      ),
    },
  ];

  const d = detail?.patient;

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Clinical Records</p>
        <h1 className="page-title mt-0.5">Medical records</h1>
        <p className="text-body-md text-gray-500 mt-1">
          Patient EMR oversight and FHIR data export for compliance and
          portability.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, email or phone…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-hairline text-body-md focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(p) => p.id}
          loading={loading}
          emptyMessage="No patients found"
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Medical record"
        maxWidth="max-w-2xl"
      >
        {d && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar src={d.image} name={d.name} size={44} />
                <div>
                  <p>
                    <PatientLink
                      id={d.id}
                      name={d.name}
                      className="font-bold text-ink"
                    />
                  </p>
                  <p className="text-caption text-gray-500 capitalize">
                    {[d.gender, d.age ? `${d.age} yrs` : d.dob]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => downloadFhir(d.id, d.name)}
                className="btn-secondary text-body-md"
              >
                <Download size={16} /> Export FHIR
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ["Blood type", d.healthProfile?.bloodType],
                ["Genotype", d.healthProfile?.genotype],
                [
                  "Height",
                  d.healthProfile?.heightCm
                    ? `${d.healthProfile.heightCm} cm`
                    : null,
                ],
                [
                  "Weight",
                  d.healthProfile?.weightKg
                    ? `${d.healthProfile.weightKg} kg`
                    : null,
                ],
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="rounded-xl bg-surfaceAlt px-3 py-2.5 text-center"
                >
                  <p className="font-bold text-ink">{val || "—"}</p>
                  <p className="text-micro text-gray-400">{label}</p>
                </div>
              ))}
            </div>

            <RecSection
              title="Allergies"
              icon={<AlertTriangle size={14} className="text-alert-600" />}
              empty={!d.allergies?.length}
            >
              {d.allergies?.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between py-1.5 text-body-md"
                >
                  <span className="text-ink font-medium">{a.substance}</span>
                  <span className="text-caption text-gray-400 capitalize">
                    {[a.reaction, a.severity.toLowerCase()]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              ))}
            </RecSection>

            <RecSection title="Conditions" empty={!d.medicalConditions?.length}>
              {d.medicalConditions?.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-1.5 text-body-md"
                >
                  <span className="text-ink font-medium">{c.name}</span>
                  <span className="text-caption text-gray-400 capitalize">
                    {[c.status.toLowerCase(), c.onsetDate]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              ))}
            </RecSection>

            <RecSection title="Surgeries" empty={!d.surgeries?.length}>
              {d.surgeries?.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-1.5 text-body-md"
                >
                  <span className="text-ink font-medium">{s.name}</span>
                  <span className="text-caption text-gray-400">
                    {s.performedDate}
                  </span>
                </div>
              ))}
            </RecSection>

            <RecSection title="Vaccinations" empty={!d.immunizations?.length}>
              {d.immunizations?.map((im) => (
                <div
                  key={im.id}
                  className="flex items-center justify-between py-1.5 text-body-md"
                >
                  <span className="text-ink font-medium">{im.vaccine}</span>
                  <span className="text-caption text-gray-400">
                    {im.dateGiven}
                  </span>
                </div>
              ))}
            </RecSection>

            <RecSection
              title="Documents"
              icon={<FileText size={14} className="text-teal-600" />}
              empty={!d.medicalFiles?.length}
            >
              {d.medicalFiles?.map((f) => (
                <a
                  key={f.id}
                  href={f.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between py-1.5 text-body-md hover:text-teal-600"
                >
                  <span className="font-medium truncate">{f.fileName}</span>
                  <span className="text-caption text-gray-400 capitalize">
                    {f.category.replace(/_/g, " ").toLowerCase()}
                  </span>
                </a>
              ))}
            </RecSection>

            <RecSection
              title="Consultation notes"
              empty={!detail?.clinicalNotes?.length}
            >
              {detail?.clinicalNotes?.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl border border-hairline px-4 py-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-semibold text-ink">
                      Dr. {n.doctor?.name ?? "—"}
                    </span>
                    <span className="text-micro text-gray-400">
                      {format(new Date(n.createdAt), "dd MMM yyyy")}
                    </span>
                  </div>
                  {n.assessment ? (
                    <p className="text-caption text-gray-600 mt-0.5">
                      {n.assessment}
                    </p>
                  ) : null}
                </div>
              ))}
            </RecSection>
          </div>
        )}
      </Modal>
    </div>
  );
}

function RecSection({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  empty?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow mb-1.5 flex items-center gap-1.5">
        {icon}
        {title}
      </p>
      {empty ? (
        <p className="text-caption text-gray-400">None on file.</p>
      ) : (
        <div className="divide-y divide-hairline">{children}</div>
      )}
    </div>
  );
}
