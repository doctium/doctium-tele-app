"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Check,
  X,
  Eye,
  ExternalLink,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import { StarRating } from "@/components/ui/StarRating";
import { PatientLink } from "@/components/ui/PatientLink";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { languageLabel } from "@doctium/types";
import { formatMoney } from "@/lib/money";
import { format } from "date-fns";
import type { DoctorKyc, KycDocument } from "@/types";

const V_VARIANT: Record<
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
const DOC_LABEL: Record<string, string> = {
  CV: "CV / Résumé",
  MEDICAL_LICENSE: "MDCN Practising Licence",
  DEGREE_CERTIFICATE: "Medical Degree",
  GOVERNMENT_ID: "Government ID",
  SPECIALIST_CERT: "Specialist Certificate",
  INDEMNITY_INSURANCE: "Indemnity Insurance",
  PASSPORT_PHOTO: "Passport Photo",
  OTHER: "Other",
};

interface DoctorDetail {
  id: string;
  name: string;
  email: string;
  mobile: string;
  image?: string;
  designation: string;
  education: string;
  yourSelf: string;
  experience: number;
  charge: number;
  commission: number;
  defaultCommissionPercent?: number;
  rating: number;
  reviewCount: number;
  isBlock: boolean;
  degree: string[];
  language: string[];
  awards: string[];
  expertise: string[];
  clinicName: string;
  address: string;
  country: string;
  createdAt: string;
  wallet?: { balance: number; total: number };
  reviews?: {
    id: string;
    review: string;
    rating: number;
    userId?: string;
    user?: { name: string };
  }[];
  videos?: {
    id: string;
    description: string;
    videoUrl: string;
    shareCount: number;
  }[];
}

export default function DoctorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [tab, setTab] = useState<
    "verification" | "info" | "reviews" | "videos" | "wallet"
  >("verification");
  const [loading, setLoading] = useState(true);

  const [kyc, setKyc] = useState<DoctorKyc | null>(null);
  const [vform, setVform] = useState({
    licenseExpiry: "",
    mdcnFolioNumber: "",
    licenseNumber: "",
    notes: "",
  });
  const [docModal, setDocModal] = useState<KycDocument | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);
  const [upType, setUpType] = useState("MEDICAL_LICENSE");
  const [upExpiry, setUpExpiry] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadKyc = () => {
    apiClient
      .get(`/admin/doctors/${id}/kyc`)
      .then((r: unknown) => {
        const k = (r as { data: DoctorKyc }).data;
        setKyc(k);
        setVform({
          licenseExpiry: k.licenseExpiry ? k.licenseExpiry.slice(0, 10) : "",
          mdcnFolioNumber: k.mdcnFolioNumber ?? "",
          licenseNumber: k.licenseNumber ?? "",
          notes: k.verificationNotes ?? "",
        });
      })
      .catch(() => {});
  };

  // Business Agreement (doctor-specific commission)
  const [commissionInput, setCommissionInput] = useState("0");
  const [savingCommission, setSavingCommission] = useState(false);
  const saveCommission = async () => {
    const v = parseFloat(commissionInput);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      toast.error("Commission must be between 0 and 100");
      return;
    }
    setSavingCommission(true);
    try {
      await apiClient.patch(`/admin/doctors/${id}/commission`, {
        commission: v,
      });
      setDoctor((d) => (d ? { ...d, commission: v } : d));
      toast.success(
        v > 0
          ? `Business agreement saved — ${v}% commission for this doctor`
          : "Custom agreement removed — app-wide default applies",
      );
    } catch {
      /* error toast comes from the api client */
    } finally {
      setSavingCommission(false);
    }
  };

  useEffect(() => {
    apiClient
      .get(`/admin/doctors/${id}`)
      .then((r: unknown) => {
        const d = (r as { data: DoctorDetail }).data;
        setDoctor(d);
        setCommissionInput(String(d.commission ?? 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    loadKyc();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    setActing(true);
    try {
      await fn();
      toast.success(okMsg);
      loadKyc();
    } catch {
    } finally {
      setActing(false);
    }
  };

  const setBlocked = async (blocked: boolean) => {
    setDoctor((d) => (d ? { ...d, isBlock: blocked } : d));
    try {
      await apiClient.patch(`/admin/doctors/${id}/block`, { isBlock: blocked });
      toast.success(
        blocked
          ? "Doctor blocked — they have been notified"
          : "Doctor unblocked",
      );
    } catch {
      setDoctor((d) => (d ? { ...d, isBlock: !blocked } : d));
    }
  };
  const approveReg = () =>
    act(
      () => apiClient.patch(`/admin/doctors/${id}/approve-registration`),
      "Registration approved",
    );
  const verify = () =>
    act(
      () => apiClient.patch(`/admin/doctors/${id}/verify`, vform),
      "Doctor verified",
    );
  const reject = () =>
    act(async () => {
      await apiClient.patch(`/admin/doctors/${id}/reject`, {
        reason: rejectReason,
      });
      setRejectOpen(false);
      setRejectReason("");
    }, "Doctor rejected");
  const reviewDoc = (docId: string, status: "APPROVED" | "REJECTED") =>
    act(
      () => apiClient.patch(`/admin/kyc-documents/${docId}/review`, { status }),
      `Document ${status.toLowerCase()}`,
    );

  // Admin uploads a document on the doctor's behalf (hard copies handed in at the office).
  const uploadForDoctor = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await apiClient.post(`/admin/doctors/${id}/kyc-documents`, {
        type: upType,
        dataUrl,
        fileName: file.name,
        mimeType: file.type,
        expiresAt:
          upType === "MEDICAL_LICENSE" && upExpiry ? upExpiry : undefined,
      });
      toast.success("Document uploaded");
      setUpExpiry("");
      if (fileRef.current) fileRef.current.value = "";
      loadKyc();
    } catch {
      /* interceptor toasts the error */
    } finally {
      setUploading(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading...
      </div>
    );
  if (!doctor)
    return (
      <div className="text-center py-20 text-gray-400">Doctor not found</div>
    );

  const reviewCols: Column<{
    id: string;
    review: string;
    rating: number;
    userId?: string;
    user?: { name: string };
  }>[] = [
    {
      key: "user",
      header: "Patient",
      render: (r) =>
        r.user?.name ? (
          <PatientLink id={r.userId} name={r.user.name} />
        ) : (
          "Anonymous"
        ),
    },
    {
      key: "rating",
      header: "Rating",
      render: (r) => <StarRating rating={r.rating} />,
    },
    {
      key: "review",
      header: "Review",
      render: (r) => <span className="text-gray-600 text-sm">{r.review}</span>,
    },
  ];

  const videoCols: Column<{
    id: string;
    description: string;
    videoUrl: string;
    shareCount: number;
  }>[] = [
    {
      key: "description",
      header: "Description",
      render: (r) => (
        <span className="text-sm text-gray-700">{r.description}</span>
      ),
    },
    {
      key: "shareCount",
      header: "Shares",
      render: (r) => <span>{r.shareCount}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          onClick={async () => {
            await apiClient.delete(`/admin/videos/${r.id}`);
            toast.success("Video deleted");
            setDoctor((d) =>
              d ? { ...d, videos: d.videos?.filter((v) => v.id !== r.id) } : d,
            );
          }}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm"
      >
        <ArrowLeft size={16} /> Back to Doctors
      </button>

      <div className="card flex flex-col sm:flex-row gap-6 items-start">
        <Avatar src={doctor.image} name={doctor.name} size={90} />
        <div className="flex-1">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{doctor.name}</h2>
              <p className="text-gray-500 text-sm">{doctor.designation}</p>
              <div className="mt-1">
                <StarRating rating={doctor.rating} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold ${doctor.isBlock ? "text-alert" : "text-success-600"}`}
              >
                {doctor.isBlock ? "Blocked" : "Active"}
              </span>
              <Toggle
                checked={!doctor.isBlock}
                onChange={(active) => setBlocked(!active)}
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["Experience", `${doctor.experience} yrs`],
              ["Charge", formatMoney(doctor.charge)],
              ["Wallet Balance", formatMoney(doctor.wallet?.balance ?? 0)],
              ["Total Earned", formatMoney(doctor.wallet?.total ?? 0)],
            ].map(([l, v]) => (
              <div key={l} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 uppercase font-semibold">
                  {l}
                </p>
                <p className="text-base font-bold text-gray-900 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["verification", "info", "reviews", "videos", "wallet"] as const).map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t === "verification" ? "KYC" : t}
            </button>
          ),
        )}
      </div>

      <div className="card">
        {tab === "verification" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Status:</span>
                <Badge
                  label={kyc?.verificationStatus ?? "—"}
                  variant={
                    V_VARIANT[kyc?.verificationStatus ?? "NEW"] ?? "default"
                  }
                />
                {kyc?.kycSubmittedAt && (
                  <span className="text-xs text-gray-400">
                    submitted{" "}
                    {format(new Date(kyc.kycSubmittedAt), "dd MMM yyyy")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {kyc?.verificationStatus === "NEW" && (
                  <button
                    onClick={approveReg}
                    disabled={acting}
                    className="btn-primary text-sm"
                  >
                    Approve registration
                  </button>
                )}
                {kyc && kyc.verificationStatus !== "NEW" && (
                  <>
                    <button
                      onClick={verify}
                      disabled={acting}
                      className="btn-primary text-sm flex items-center gap-1.5"
                    >
                      <ShieldCheck size={15} /> Verify doctor
                    </button>
                    <button
                      onClick={() => setRejectOpen(true)}
                      disabled={acting}
                      className="btn-danger text-sm"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>

            {kyc?.rejectionReason && (
              <div className="bg-alert-50 text-alert-700 rounded-xl p-3 text-sm">
                Rejection note: {kyc.rejectionReason}
              </div>
            )}

            {/* MDCN / licence capture (cross-check on the MDCN portal, then verify) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="label">MDCN folio / reg. no.</label>
                <input
                  className="input"
                  value={vform.mdcnFolioNumber}
                  onChange={(e) =>
                    setVform((f) => ({ ...f, mdcnFolioNumber: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Licence number</label>
                <input
                  className="input"
                  value={vform.licenseNumber}
                  onChange={(e) =>
                    setVform((f) => ({ ...f, licenseNumber: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Licence expiry</label>
                <input
                  type="date"
                  className="input"
                  value={vform.licenseExpiry}
                  onChange={(e) =>
                    setVform((f) => ({ ...f, licenseExpiry: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <input
                  className="input"
                  value={vform.notes}
                  onChange={(e) =>
                    setVform((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Upload on behalf of the doctor (hard copies handed in at the office) */}
            <div className="border border-dashed border-border rounded-xl p-4 bg-muted/40">
              <p className="section-title mb-1">Upload on behalf</p>
              <p className="text-xs text-gray-400 mb-3">
                For doctors who submit hard copies in person. Files are added to
                this doctor&apos;s KYC, then you can review &amp; verify below.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="label">Document type</label>
                  <select
                    className="input"
                    value={upType}
                    onChange={(e) => setUpType(e.target.value)}
                  >
                    {Object.entries(DOC_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                {upType === "MEDICAL_LICENSE" && (
                  <div>
                    <label className="label">Licence expiry</label>
                    <input
                      type="date"
                      className="input"
                      value={upExpiry}
                      onChange={(e) => setUpExpiry(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadForDoctor(f);
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="btn-primary text-sm flex items-center gap-1.5"
                  >
                    <Upload size={15} />
                    {uploading ? "Uploading…" : "Choose file"}
                  </button>
                </div>
              </div>
            </div>

            {/* Uploaded documents */}
            <div>
              <p className="section-title mb-3">Documents</p>
              {kyc?.kycDocuments?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kyc.kycDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="border border-border rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-ink text-sm">
                          {DOC_LABEL[doc.type] ?? doc.type}
                        </span>
                        <Badge
                          label={doc.status}
                          variant={
                            doc.status === "APPROVED"
                              ? "success"
                              : doc.status === "REJECTED"
                                ? "danger"
                                : "warning"
                          }
                        />
                      </div>
                      {doc.expiresAt && (
                        <p className="text-xs text-gray-400 mb-2">
                          Expires{" "}
                          {format(new Date(doc.expiresAt), "dd MMM yyyy")}
                        </p>
                      )}
                      <button
                        onClick={() => setDocModal(doc)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-teal-600 hover:bg-teal-500/10 transition-colors"
                        title="View document"
                      >
                        <Eye size={16} />
                      </button>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => reviewDoc(doc.id, "APPROVED")}
                          disabled={acting}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-success-50 text-success-600 hover:bg-success-100 flex items-center justify-center gap-1"
                        >
                          <Check size={13} /> Approve
                        </button>
                        <button
                          onClick={() => reviewDoc(doc.id, "REJECTED")}
                          disabled={acting}
                          className="flex-1 text-xs py-1.5 rounded-lg bg-alert-50 text-alert-600 hover:bg-alert-100 flex items-center justify-center gap-1"
                        >
                          <X size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  No documents uploaded yet.
                </p>
              )}
            </div>
          </div>
        )}
        {tab === "info" && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {[
              ["Email", doctor.email],
              ["Mobile", doctor.mobile],
              ["Country", doctor.country],
              ["Clinic", doctor.clinicName || "—"],
              ["Address", doctor.address || "—"],
              [
                "Languages",
                doctor.language?.map(languageLabel).join(", ") || "—",
              ],
              ["Degrees", doctor.degree?.join(", ") || "—"],
              ["Expertise", doctor.expertise?.join(", ") || "—"],
              ["Education", doctor.education || "—"],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">
                  {l}
                </p>
                <p className="text-sm text-gray-900 mt-0.5">{v}</p>
              </div>
            ))}
            {doctor.yourSelf && (
              <div className="col-span-full">
                <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-1">
                  About
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {doctor.yourSelf}
                </p>
              </div>
            )}
          </div>
        )}
        {tab === "reviews" && (
          <DataTable
            columns={reviewCols}
            data={doctor.reviews ?? []}
            keyExtractor={(r) => r.id}
            emptyMessage="No reviews yet"
          />
        )}
        {tab === "videos" && (
          <DataTable
            columns={videoCols}
            data={doctor.videos ?? []}
            keyExtractor={(r) => r.id}
            emptyMessage="No videos uploaded"
          />
        )}
        {tab === "wallet" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-primary-50 rounded-2xl p-6 text-center">
                <p className="text-sm text-gray-500">Available Balance</p>
                <p className="text-3xl font-bold text-primary-600 mt-1">
                  {formatMoney(doctor.wallet?.balance ?? 0)}
                </p>
              </div>
              <div className="bg-green-50 rounded-2xl p-6 text-center">
                <p className="text-sm text-gray-500">Total Earned</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {formatMoney(doctor.wallet?.total ?? 0)}
                </p>
              </div>
            </div>

            {/* ── Business Agreement: doctor-specific commission ── */}
            <div className="rounded-2xl border border-gray-100 p-6">
              <p className="section-title mb-1">Business Agreement</p>
              <p className="text-sm text-gray-500 mb-4">
                Doctium&apos;s commission on this doctor&apos;s consultation
                fees. Leave at 0 to use the app-wide default
                {doctor.defaultCommissionPercent != null
                  ? ` (currently ${doctor.defaultCommissionPercent}%)`
                  : ""}{" "}
                from Settings.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label">Custom commission (%)</label>
                  <input
                    className="input w-40"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(e.target.value)}
                  />
                </div>
                <button
                  onClick={saveCommission}
                  disabled={savingCommission}
                  className="btn-primary text-sm"
                >
                  {savingCommission ? "Saving…" : "Save agreement"}
                </button>
                <span
                  className={`inline-flex rounded-full px-3 py-1.5 text-micro font-bold ring-1 ring-inset ${
                    (parseFloat(commissionInput) || 0) > 0
                      ? "bg-teal-50 text-teal-600 ring-teal-500/20"
                      : "bg-skyblue-50 text-navy-mid ring-skyblue/30"
                  }`}
                >
                  {(parseFloat(commissionInput) || 0) > 0
                    ? `Custom agreement · ${parseFloat(commissionInput)}%`
                    : `Using app-wide default${doctor.defaultCommissionPercent != null ? ` · ${doctor.defaultCommissionPercent}%` : ""}`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Document preview */}
      <Modal
        open={!!docModal}
        onClose={() => setDocModal(null)}
        title={docModal ? (DOC_LABEL[docModal.type] ?? docModal.type) : ""}
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

      {/* Reject reason */}
      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject verification"
        maxWidth="max-w-md"
      >
        <label className="label">Reason (shown to the doctor)</label>
        <textarea
          className="input"
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="e.g. Licence document is unreadable — please re-upload a clearer copy."
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => setRejectOpen(false)}
            className="btn-ghost flex-1"
          >
            Cancel
          </button>
          <button
            onClick={reject}
            disabled={acting}
            className="btn-danger flex-1"
          >
            Reject
          </button>
        </div>
      </Modal>
    </div>
  );
}
