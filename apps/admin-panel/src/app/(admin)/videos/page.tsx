"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  X,
  Trash2,
  Eye,
  Youtube,
  Film,
  Flag,
  ExternalLink,
} from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
type Source = "UPLOAD" | "YOUTUBE";

interface Report {
  id: string;
  reason: string;
  note?: string | null;
  status: "OPEN" | "REVIEWED";
  createdAt: string;
  user?: { id: string; name?: string; image?: string };
}
interface Clip {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  videoImage?: string;
  source: Source;
  status: Status;
  rejectionReason?: string | null;
  reportCount: number;
  createdAt: string;
  doctor?: { id: string; name: string; image?: string; designation?: string };
  _count?: { likes: number; comments: number; reports: number };
  reports?: Report[];
  reasonCounts?: Record<string, number>;
}

const STATUS_VARIANT: Record<
  Status,
  "warning" | "success" | "danger" | "info"
> = {
  PENDING: "warning",
  FLAGGED: "danger",
  APPROVED: "success",
  REJECTED: "info",
};
const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Pending review",
  FLAGGED: "Flagged",
  APPROVED: "Live",
  REJECTED: "Rejected",
};
const REASON_LABEL: Record<string, string> = {
  MISINFORMATION: "Medical misinformation",
  HARMFUL_ADVICE: "Harmful or dangerous advice",
  SPAM: "Spam or misleading",
  SEXUAL_CONTENT: "Sexual / inappropriate",
  HARASSMENT: "Harassment or hate",
  COPYRIGHT: "Copyright",
  OTHER: "Other",
};

const TABS: { key: string; label: string }[] = [
  { key: "QUEUE", label: "Needs review" },
  { key: "PENDING", label: "Pending" },
  { key: "FLAGGED", label: "Flagged" },
  { key: "APPROVED", label: "Live" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

export default function VideosModerationPage() {
  const [rows, setRows] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("QUEUE");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Clip | null>(null);
  const [rejecting, setRejecting] = useState<Clip | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const PAGE_SIZE = 15;

  const load = useCallback(() => {
    setLoading(true);
    const status = tab === "QUEUE" ? undefined : tab;
    apiClient
      .get("/admin/videos", { params: { status, page, limit: PAGE_SIZE } })
      .then((r: unknown) =>
        setRows((r as { data: { items: Clip[] } }).data.items ?? []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    try {
      const r = (await apiClient.get(`/admin/videos/${id}`)) as { data: Clip };
      setDetail(r.data);
    } catch {
      /* surfaced by interceptor */
    }
  };

  const approve = async (c: Clip) => {
    setBusy(true);
    try {
      await apiClient.patch(`/admin/videos/${c.id}/approve`);
      toast.success("Clip approved — now live in MediGram");
      setDetail(null);
      load();
    } catch {
      toast.error("Could not approve the clip");
    } finally {
      setBusy(false);
    }
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await apiClient.patch(`/admin/videos/${rejecting.id}/reject`, {
        reason: rejectReason,
      });
      toast.success("Clip rejected — the doctor was notified");
      setRejecting(null);
      setRejectReason("");
      setDetail(null);
      load();
    } catch {
      toast.error("Could not reject the clip");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Clip) => {
    if (!confirm("Permanently delete this clip? This cannot be undone."))
      return;
    try {
      await apiClient.delete(`/admin/videos/${c.id}`);
      toast.success("Clip deleted");
      setDetail(null);
      load();
    } catch {
      toast.error("Could not delete the clip");
    }
  };

  const cols: Column<Clip>[] = [
    {
      key: "clip",
      header: "Clip",
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-surfaceAlt grid place-items-center flex-shrink-0">
            {c.videoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.videoImage}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <Film size={16} className="text-gray-400" />
            )}
            {c.source === "YOUTUBE" && (
              <span className="absolute bottom-0.5 right-0.5 bg-black/70 rounded p-0.5">
                <Youtube size={11} className="text-red-500" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-ink truncate max-w-[220px]">
              {c.title || "Untitled"}
            </p>
            <p className="text-caption text-gray-400">
              {format(new Date(c.createdAt), "dd MMM yyyy")}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={c.doctor?.image} name={c.doctor?.name} size={30} />
          <span className="text-gray-600">Dr. {c.doctor?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "stats",
      header: "Engagement",
      render: (c) => (
        <div className="flex items-center gap-3 text-caption text-gray-500 tabular-nums">
          <span>♥ {c._count?.likes ?? 0}</span>
          <span>💬 {c._count?.comments ?? 0}</span>
          {(c._count?.reports ?? c.reportCount) > 0 && (
            <span className="text-alert-600 font-bold flex items-center gap-0.5">
              <Flag size={11} /> {c._count?.reports ?? c.reportCount}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (c) => (
        <Badge
          label={STATUS_LABEL[c.status]}
          variant={STATUS_VARIANT[c.status]}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      render: (c) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openDetail(c.id)}
            className="grid place-items-center w-8 h-8 rounded-lg text-gray-500 hover:bg-surfaceAlt hover:text-ink transition-colors"
            title="Review"
          >
            <Eye size={15} />
          </button>
          {c.status !== "APPROVED" && (
            <button
              onClick={() => approve(c)}
              className="grid place-items-center w-8 h-8 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
              title="Approve"
            >
              <Check size={16} />
            </button>
          )}
          {c.status !== "REJECTED" && (
            <button
              onClick={() => setRejecting(c)}
              className="grid place-items-center w-8 h-8 rounded-lg text-caution-600 hover:bg-caution-50 transition-colors"
              title="Reject"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => remove(c)}
            className="grid place-items-center w-8 h-8 rounded-lg text-alert-500 hover:bg-alert-50 transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Content</p>
        <h1 className="page-title mt-0.5">MediGram moderation</h1>
        <p className="text-body-md text-gray-500 mt-1">
          Review health-education clips before they reach patients, and act on
          reported content.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={
              "px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors " +
              (tab === t.key
                ? "bg-navy text-white"
                : "bg-surfaceAlt text-gray-500 hover:text-ink")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={rows}
          keyExtractor={(c) => c.id}
          loading={loading}
          emptyMessage="Nothing here — the queue is clear."
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Review modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Review clip"
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
                variant={STATUS_VARIANT[detail.status]}
              />
            </div>

            <div className="rounded-xl overflow-hidden border border-hairline bg-surfaceAlt">
              {detail.videoImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.videoImage}
                  alt=""
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="h-44 grid place-items-center text-gray-400">
                  <Film size={28} />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                {detail.source === "YOUTUBE" ? (
                  <Youtube size={15} className="text-red-500" />
                ) : (
                  <Film size={15} className="text-teal-600" />
                )}
                <p className="font-bold text-ink">
                  {detail.title || "Untitled"}
                </p>
              </div>
              {detail.description ? (
                <p className="text-body-md text-gray-600 mt-1">
                  {detail.description}
                </p>
              ) : null}
              <a
                href={detail.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-caption text-teal-600 hover:underline mt-2"
              >
                <ExternalLink size={13} /> Open source video
              </a>
            </div>

            {detail.reports && detail.reports.length > 0 ? (
              <div>
                <p className="eyebrow mb-2 flex items-center gap-1.5 text-alert-600">
                  <Flag size={13} /> {detail.reports.length} report
                  {detail.reports.length > 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(detail.reasonCounts ?? {}).map(
                    ([reason, n]) => (
                      <span
                        key={reason}
                        className="text-micro font-bold text-navy-mid bg-surfaceAlt px-2 py-0.5 rounded-full"
                      >
                        {REASON_LABEL[reason] ?? reason}: {n}
                      </span>
                    ),
                  )}
                </div>
                <div className="rounded-xl border border-hairline divide-y divide-hairline max-h-44 overflow-y-auto">
                  {detail.reports.map((rp) => (
                    <div key={rp.id} className="px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-caption font-semibold text-ink">
                          {REASON_LABEL[rp.reason] ?? rp.reason}
                        </span>
                        <span className="text-micro text-gray-400">
                          {format(new Date(rp.createdAt), "dd MMM, HH:mm")}
                        </span>
                      </div>
                      {rp.note ? (
                        <p className="text-caption text-gray-500 mt-0.5">
                          “{rp.note}”
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {detail.rejectionReason ? (
              <div className="rounded-xl bg-alert-50 border border-alert-100 px-4 py-3">
                <p className="text-caption text-alert-600">
                  <b>Rejected:</b> {detail.rejectionReason}
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              {detail.status !== "APPROVED" && (
                <button
                  disabled={busy}
                  onClick={() => approve(detail)}
                  className="btn-primary flex-1 justify-center"
                >
                  <Check size={16} /> Approve & publish
                </button>
              )}
              {detail.status !== "REJECTED" && (
                <button
                  disabled={busy}
                  onClick={() => setRejecting(detail)}
                  className="btn-secondary flex-1 justify-center"
                >
                  <X size={16} /> Reject
                </button>
              )}
              <button
                onClick={() => remove(detail)}
                className="grid place-items-center w-10 h-10 rounded-xl text-alert-500 hover:bg-alert-50 transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject reason modal */}
      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject clip"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-body-md text-gray-600">
            The doctor will be notified with this reason.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="e.g. Makes unverified medical claims about a treatment."
            className="w-full rounded-xl border border-hairline px-4 py-3 text-body-md focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setRejecting(null)}
              className="btn-ghost flex-1 justify-center"
            >
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={confirmReject}
              className="btn-primary flex-1 justify-center"
            >
              Reject & notify
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
