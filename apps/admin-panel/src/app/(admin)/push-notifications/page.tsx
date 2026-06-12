"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, ImagePlus, Users, Stethoscope, Globe, X } from "lucide-react";
import { RequirePermission } from "@/components/RequirePermission";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";

type Audience = "PATIENTS" | "DOCTORS" | "ALL";

interface Counts {
  users: number;
  usersPush: number;
  doctors: number;
  doctorsPush: number;
}
interface Broadcast {
  id: string;
  channel: string;
  audience: Audience;
  title: string;
  body: string;
  image?: string | null;
  userCount: number;
  doctorCount: number;
  sentCount: number;
  sentByName: string;
  createdAt: string;
}

const AUD_LABEL: Record<Audience, string> = {
  PATIENTS: "Patients",
  DOCTORS: "Doctors",
  ALL: "Everyone",
};

export default function PushNotificationsPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [audience, setAudience] = useState<Audience>("ALL");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(() => {
    (apiClient.get("/admin/comms/broadcasts") as Promise<{ data: Broadcast[] }>)
      .then((r) => setHistory(r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (apiClient.get("/admin/comms/audience-counts") as Promise<{ data: Counts }>)
      .then((r) => setCounts(r.data ?? null))
      .catch(() => {});
    loadHistory();
  }, [loadHistory]);

  const reach =
    audience === "PATIENTS"
      ? counts?.users
      : audience === "DOCTORS"
        ? counts?.doctors
        : (counts?.users ?? 0) + (counts?.doctors ?? 0);
  const reachPush =
    audience === "PATIENTS"
      ? counts?.usersPush
      : audience === "DOCTORS"
        ? counts?.doctorsPush
        : (counts?.usersPush ?? 0) + (counts?.doctorsPush ?? 0);

  const pickImage = (file: File) => {
    const fr = new FileReader();
    fr.onload = () => setImageDataUrl(fr.result as string);
    fr.readAsDataURL(file);
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSending(true);
    try {
      const r = (await apiClient.post("/admin/comms/push", {
        audience,
        title: title.trim(),
        body: body.trim(),
        imageDataUrl: imageDataUrl ?? undefined,
      })) as { data: { userCount: number; doctorCount: number; sent: number } };
      const d = r.data;
      toast.success(
        `Notification sent to ${(d?.userCount ?? 0) + (d?.doctorCount ?? 0)} recipients` +
          (d?.sent
            ? ` · ${d.sent} push delivered`
            : " · in-app only (push needs Firebase creds)"),
      );
      setTitle("");
      setBody("");
      setImageDataUrl(null);
      if (fileRef.current) fileRef.current.value = "";
      loadHistory();
    } catch {
      /* interceptor toasts the error */
    } finally {
      setSending(false);
    }
  };

  const audienceCards: {
    key: Audience;
    label: string;
    sub: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: "PATIENTS",
      label: "Patients",
      sub: `${counts?.users ?? "—"} total`,
      icon: <Users size={18} />,
    },
    {
      key: "DOCTORS",
      label: "Doctors",
      sub: `${counts?.doctors ?? "—"} total`,
      icon: <Stethoscope size={18} />,
    },
    {
      key: "ALL",
      label: "Everyone",
      sub: `${(counts?.users ?? 0) + (counts?.doctors ?? 0)} total`,
      icon: <Globe size={18} />,
    },
  ];

  return (
    <RequirePermission perm="comms.notifications">
      <div className="space-y-5">
        <div>
          <p className="eyebrow">Communication</p>
          <h1 className="page-title mt-0.5">Push Notifications</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Compose */}
          <div className="lg:col-span-3 card space-y-5">
            <div>
              <label className="label">Audience</label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {audienceCards.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setAudience(a.key)}
                    className={`rounded-xl border p-3 text-left transition-colors ${audience === a.key ? "border-navy bg-skyblue-50" : "border-border hover:border-navy/30"}`}
                  >
                    <div
                      className={`flex items-center gap-2 ${audience === a.key ? "text-ink" : "text-gray-500"}`}
                    >
                      {a.icon}
                      <span className="font-semibold text-sm">{a.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{a.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. New doctors available near you"
              />
            </div>

            <div>
              <label className="label">Message</label>
              <textarea
                className="input"
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={300}
                placeholder="Write the notification message…"
              />
            </div>

            <div>
              <label className="label">Image (optional)</label>
              {imageDataUrl ? (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageDataUrl}
                    alt="preview"
                    className="h-32 rounded-xl border border-border object-cover"
                  />
                  <button
                    onClick={() => {
                      setImageDataUrl(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 grid place-items-center w-6 h-6 rounded-full bg-alert text-white"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-gray-500 hover:border-navy/30"
                >
                  <ImagePlus size={18} /> Add an image
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickImage(f);
                }}
              />
              <p className="text-xs text-gray-400 mt-2">
                Images require Cloudinary credentials; without them, send
                text-only.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-hairline">
              <p className="text-sm text-gray-500">
                Reaching{" "}
                <span className="font-semibold text-ink">{reach ?? "—"}</span>{" "}
                {AUD_LABEL[audience].toLowerCase()}
                {typeof reachPush === "number" ? (
                  <span className="text-gray-400">
                    {" "}
                    · {reachPush} with push enabled
                  </span>
                ) : null}
              </p>
              <button
                onClick={send}
                disabled={sending}
                className="btn-primary flex items-center gap-1.5"
              >
                <Send size={15} /> {sending ? "Sending…" : "Send notification"}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="lg:col-span-2 card">
            <p className="section-title mb-3">Recent broadcasts</p>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                No broadcasts yet
              </p>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto">
                {history.map((b) => (
                  <div
                    key={b.id}
                    className="border border-border rounded-xl p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink text-sm truncate">
                        {b.title}
                      </span>
                      <span className="text-[10px] font-semibold text-teal-600 bg-teal-50 rounded-full px-2 py-0.5 flex-shrink-0">
                        {AUD_LABEL[b.audience] ?? b.audience}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {b.body}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-2">
                      {b.userCount + b.doctorCount} recipients · {b.sentCount}{" "}
                      push · {format(new Date(b.createdAt), "dd MMM, HH:mm")}
                      {b.sentByName ? ` · ${b.sentByName}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
