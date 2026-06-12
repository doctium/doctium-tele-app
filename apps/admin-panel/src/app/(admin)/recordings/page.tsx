"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  FileVideo,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { PatientLink } from "@/components/ui/PatientLink";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SearchInput } from "@/components/ui/SearchInput";
import { RequirePermission } from "@/components/RequirePermission";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAdminAuth } from "@/lib/auth-context";

const STATUSES = ["ALL", "AVAILABLE", "ARCHIVED", "QUARANTINED", "DELETED"];
const RETENTION = ["ALL", "ACTIVE", "EXPIRED"];
const PAGE_SIZE = 12;

interface RecordingAsset {
  id: string;
  fileName: string;
  status: string;
  storageVendor: string;
  sizeBytes?: string | null;
  durationSeconds?: number | null;
  encrypted: boolean;
  retentionPolicy: string;
  retentionDays: number;
  retainUntil?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}

interface RecordingRow {
  id: string;
  appointmentId: string;
  date: string;
  time: string;
  type: string;
  status: string;
  user?: {
    id?: string;
    name?: string;
    image?: string;
    mobile?: string;
    country?: string;
  };
  doctor?: { name?: string; image?: string };
  consentStatus: string;
  sessionStatus: string;
  accessLogCount: number;
  assets: RecordingAsset[];
}

interface AccessLog {
  id: string;
  actorRole: string;
  actorId: string;
  action: string;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

interface RecordingRequest {
  id: string;
  type: "EXPORT" | "DELETE";
  status: string;
  reason: string;
  disputeHold: boolean;
  disputeHoldUntil?: string | null;
  disputeHoldReason?: string | null;
  exportUrl?: string | null;
  exportExpiresAt?: string | null;
  createdAt: string;
}

interface RecordingDetail extends RecordingRow {
  accessLogs: AccessLog[];
  requests: RecordingRequest[];
}

const emptyAsset = {
  objectKey: "",
  fileName: "",
  storageVendor: "s3",
  bucket: "",
  region: "",
  providerUrl: "",
  retentionDays: "90",
};

function fmtDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function retentionExpired(asset: RecordingAsset) {
  return (
    !!asset.retainUntil && new Date(asset.retainUntil).getTime() <= Date.now()
  );
}

function statusVariant(
  status: string,
): "success" | "warning" | "danger" | "info" | "default" {
  if (status === "AVAILABLE") return "success";
  if (status === "ARCHIVED") return "warning";
  if (status === "DELETED") return "danger";
  if (status === "QUARANTINED") return "info";
  return "default";
}

export default function RecordingsPage() {
  const { can } = useAdminAuth();
  const canManage = can("appointments.manage_recordings");
  const [rows, setRows] = useState<RecordingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [retention, setRetention] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<RecordingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [registerFor, setRegisterFor] = useState<RecordingRow | null>(null);
  const [assetForm, setAssetForm] = useState(emptyAsset);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .get("/admin/recordings", {
        params: {
          page,
          limit: PAGE_SIZE,
          status: status === "ALL" ? undefined : status,
          retention: retention === "ALL" ? undefined : retention,
          search: search || undefined,
        },
      })
      .then((r: unknown) => {
        const data = (r as { data: { items: RecordingRow[]; total: number } })
          .data;
        setRows(data.items ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => toast.error("Could not load recordings"))
      .finally(() => setLoading(false));
  }, [page, status, retention, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (row: RecordingRow) => {
    setDetailLoading(true);
    try {
      const r = (await apiClient.get(`/admin/recordings/${row.id}`)) as {
        data: RecordingDetail;
      };
      setDetail(r.data);
    } catch {
      toast.error("Could not load recording detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const submitAsset = async () => {
    if (!registerFor || !assetForm.objectKey.trim()) {
      toast.error("Object key is required");
      return;
    }
    setSaving(true);
    try {
      await apiClient.post(`/admin/recordings/${registerFor.id}/assets`, {
        files: [
          {
            objectKey: assetForm.objectKey.trim(),
            fileName: assetForm.fileName.trim(),
            storageVendor: assetForm.storageVendor.trim(),
            bucket: assetForm.bucket.trim() || undefined,
            region: assetForm.region.trim() || undefined,
            providerUrl: assetForm.providerUrl.trim() || undefined,
            retentionDays: Number(assetForm.retentionDays) || undefined,
          },
        ],
      });
      toast.success("Recording asset registered");
      setRegisterFor(null);
      setAssetForm(emptyAsset);
      load();
    } catch (e) {
      toast.error(
        (e as { message?: string })?.message ?? "Could not register asset",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateAssetStatus = async (
    asset: RecordingAsset,
    nextStatus: string,
  ) => {
    setSaving(true);
    try {
      await apiClient.patch(`/admin/recordings/assets/${asset.id}/retention`, {
        status: nextStatus,
      });
      toast.success(`Asset marked ${nextStatus.toLowerCase()}`);
      if (detail) await openDetail(detail);
      load();
    } catch {
      toast.error("Could not update asset");
    } finally {
      setSaving(false);
    }
  };

  const decideRequest = async (
    request: RecordingRequest,
    status: "APPROVED" | "REJECTED" | "COMPLETED",
  ) => {
    setSaving(true);
    try {
      await apiClient.patch(`/admin/recording-requests/${request.id}`, {
        status,
        decisionReason:
          status === "REJECTED" ? "Rejected by admin" : "Approved by admin",
      });
      toast.success(`Request ${status.toLowerCase()}`);
      if (detail) await openDetail(detail);
      load();
    } catch {
      toast.error("Could not update request");
    } finally {
      setSaving(false);
    }
  };

  const runRetention = async () => {
    setSaving(true);
    try {
      const r = (await apiClient.post(
        "/admin/recordings/run-retention",
        {},
      )) as { data: { processed: number; action: string } };
      toast.success(`Retention processed ${r.data.processed} asset(s)`);
      load();
    } catch {
      toast.error("Could not run retention");
    } finally {
      setSaving(false);
    }
  };

  const cols: Column<RecordingRow>[] = [
    {
      key: "consult",
      header: "Consultation",
      render: (r) => (
        <div>
          <p className="font-bold text-ink">
            #{r.appointmentId.slice(-8).toUpperCase()}
          </p>
          <p className="text-caption text-gray-500">
            {r.date} | {r.time}
          </p>
        </div>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.user?.image} name={r.user?.name} size={30} />
          <div>
            <p className="text-sm">
              <PatientLink
                id={r.user?.id}
                name={r.user?.name}
                className="font-semibold text-ink"
              />
            </p>
            <p className="text-micro text-gray-500">
              {r.user?.country || "No country"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.doctor?.image} name={r.doctor?.name} size={30} />
          <span className="text-sm">{r.doctor?.name ?? "-"}</span>
        </div>
      ),
    },
    {
      key: "session",
      header: "Consent / Session",
      render: (r) => (
        <div className="space-y-1">
          <Badge
            label={r.consentStatus}
            variant={r.consentStatus === "CONSENTED" ? "success" : "warning"}
          />
          <Badge
            label={r.sessionStatus}
            variant={r.sessionStatus === "FAILED" ? "danger" : "info"}
          />
        </div>
      ),
    },
    {
      key: "assets",
      header: "Assets",
      render: (r) => (
        <div className="space-y-1">
          <p className="font-bold text-ink">{r.assets.length}</p>
          {r.assets[0] ? (
            <Badge
              label={r.assets[0].status}
              variant={statusVariant(r.assets[0].status)}
            />
          ) : null}
        </div>
      ),
    },
    {
      key: "retention",
      header: "Retention",
      render: (r) => {
        const first = r.assets[0];
        return first ? (
          <div>
            <p className="text-sm font-semibold text-ink">
              {fmtDate(first.retainUntil)}
            </p>
            {retentionExpired(first) && first.status === "AVAILABLE" ? (
              <p className="text-micro font-bold text-alert-600">Expired</p>
            ) : (
              <p className="text-micro text-gray-500">
                {first.retentionPolicy}
              </p>
            )}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        );
      },
    },
    {
      key: "logs",
      header: "Logs",
      render: (r) => (
        <span className="font-bold text-ink">{r.accessLogCount}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openDetail(r)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Details
          </button>
          {canManage ? (
            <button
              onClick={() => setRegisterFor(r)}
              className="btn-primary text-xs px-3 py-1.5"
            >
              Add asset
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <RequirePermission perm="appointments.view">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="page-title">Consultation Recordings</h1>
            <p className="text-sm text-gray-500 mt-1">
              Review sessions, assets, retention state, and playback access
              logs.
            </p>
          </div>
          {canManage ? (
            <button
              onClick={runRetention}
              disabled={saving}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw size={16} /> Run retention
            </button>
          ) : null}
        </div>

        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
                className={`rounded-xl px-3 py-1.5 text-micro font-bold ${status === s ? "bg-navy text-white" : "bg-surfaceAlt text-gray-500"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RETENTION.map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRetention(r);
                  setPage(1);
                }}
                className={`rounded-xl px-3 py-1.5 text-micro font-bold ${retention === r ? "bg-teal-600 text-white" : "bg-surfaceAlt text-gray-500"}`}
              >
                {r}
              </button>
            ))}
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search patient, doctor or ref..."
            />
          </div>
        </div>

        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No recording assets found"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />

        <Modal
          open={!!detail || detailLoading}
          onClose={() => setDetail(null)}
          title="Recording detail"
          maxWidth="max-w-5xl"
        >
          {detailLoading && !detail ? (
            <div className="py-10 text-center text-gray-500">Loading...</div>
          ) : detail ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <Info
                  icon={<FileVideo size={18} />}
                  label="Appointment"
                  value={`#${detail.appointmentId.slice(-8).toUpperCase()}`}
                />
                <Info
                  icon={<ShieldCheck size={18} />}
                  label="Consent"
                  value={detail.consentStatus}
                />
                <Info
                  icon={<PlayCircle size={18} />}
                  label="Session"
                  value={detail.sessionStatus}
                />
              </div>

              <div>
                <h3 className="font-bold text-ink mb-3">Assets</h3>
                <div className="space-y-2">
                  {detail.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="rounded-2xl border border-hairline p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-ink">
                          {asset.fileName || asset.id}
                        </p>
                        <p className="text-caption text-gray-500">
                          {asset.storageVendor || "storage"} | retain until{" "}
                          {fmtDate(asset.retainUntil)} | {asset.retentionPolicy}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          label={asset.status}
                          variant={statusVariant(asset.status)}
                        />
                        {canManage && asset.status !== "ARCHIVED" ? (
                          <button
                            disabled={saving}
                            onClick={() => updateAssetStatus(asset, "ARCHIVED")}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-surfaceAlt text-gray-500 hover:text-ink"
                          >
                            <Archive size={16} />
                          </button>
                        ) : null}
                        {canManage && asset.status !== "DELETED" ? (
                          <button
                            disabled={saving}
                            onClick={() => updateAssetStatus(asset, "DELETED")}
                            className="grid h-9 w-9 place-items-center rounded-xl bg-alert-50 text-alert-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-ink mb-3">Requests</h3>
                <div className="space-y-2">
                  {detail.requests.length === 0 ? (
                    <p className="rounded-2xl border border-hairline p-4 text-sm text-gray-500">
                      No export or deletion requests.
                    </p>
                  ) : (
                    detail.requests.map((request) => (
                      <div
                        key={request.id}
                        className="rounded-2xl border border-hairline p-4 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              label={request.type}
                              variant={
                                request.type === "DELETE" ? "danger" : "info"
                              }
                            />
                            <Badge
                              label={request.status}
                              variant={
                                request.status === "PENDING"
                                  ? "warning"
                                  : request.status === "REJECTED"
                                    ? "danger"
                                    : "success"
                              }
                            />
                            {request.disputeHold ? (
                              <Badge label="DISPUTE HOLD" variant="warning" />
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm text-ink">
                            {request.reason || "No reason supplied"}
                          </p>
                          <p className="text-caption text-gray-500">
                            Requested{" "}
                            {new Date(request.createdAt).toLocaleString()}
                            {request.disputeHoldUntil
                              ? ` | hold until ${fmtDate(request.disputeHoldUntil)}`
                              : ""}
                          </p>
                          {request.exportUrl &&
                          request.status === "APPROVED" ? (
                            <a
                              href={request.exportUrl}
                              className="mt-2 inline-block text-sm font-bold text-teal-700"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open export link
                            </a>
                          ) : null}
                        </div>
                        {canManage && request.status === "PENDING" ? (
                          <div className="flex items-center gap-2">
                            <button
                              disabled={saving}
                              onClick={() => decideRequest(request, "APPROVED")}
                              className="btn-primary text-xs px-3 py-1.5"
                            >
                              Approve
                            </button>
                            <button
                              disabled={saving}
                              onClick={() => decideRequest(request, "REJECTED")}
                              className="btn-secondary text-xs px-3 py-1.5"
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-bold text-ink mb-3">Access logs</h3>
                <div className="max-h-72 overflow-auto rounded-2xl border border-hairline">
                  {detail.accessLogs.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">
                      No access logs yet.
                    </p>
                  ) : (
                    detail.accessLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border-b border-hairline px-4 py-3 last:border-b-0"
                      >
                        <p className="font-semibold text-ink">
                          {log.action} by {log.actorRole}
                        </p>
                        <p className="text-caption text-gray-500">
                          {new Date(log.createdAt).toLocaleString()} |{" "}
                          {log.ip || "no ip"}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal
          open={!!registerFor}
          onClose={() => setRegisterFor(null)}
          title="Register recording asset"
        >
          <div className="space-y-3">
            <Field
              label="Object key"
              value={assetForm.objectKey}
              onChange={(objectKey) =>
                setAssetForm((f) => ({ ...f, objectKey }))
              }
            />
            <Field
              label="File name"
              value={assetForm.fileName}
              onChange={(fileName) => setAssetForm((f) => ({ ...f, fileName }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Storage vendor"
                value={assetForm.storageVendor}
                onChange={(storageVendor) =>
                  setAssetForm((f) => ({ ...f, storageVendor }))
                }
              />
              <Field
                label="Retention days"
                value={assetForm.retentionDays}
                onChange={(retentionDays) =>
                  setAssetForm((f) => ({ ...f, retentionDays }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Bucket"
                value={assetForm.bucket}
                onChange={(bucket) => setAssetForm((f) => ({ ...f, bucket }))}
              />
              <Field
                label="Region"
                value={assetForm.region}
                onChange={(region) => setAssetForm((f) => ({ ...f, region }))}
              />
            </div>
            <Field
              label="Provider URL"
              value={assetForm.providerUrl}
              onChange={(providerUrl) =>
                setAssetForm((f) => ({ ...f, providerUrl }))
              }
            />
            <button
              onClick={submitAsset}
              disabled={saving}
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Register asset
            </button>
          </div>
        </Modal>
      </div>
    </RequirePermission>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surfaceAlt/60 p-4">
      <div className="flex items-center gap-2 text-gray-500">
        {icon}
        <span className="text-micro font-bold uppercase">{label}</span>
      </div>
      <p className="mt-2 font-bold text-ink">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-micro font-bold uppercase text-gray-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-hairline px-3 py-2 text-sm outline-none focus:border-navy"
      />
    </label>
  );
}
