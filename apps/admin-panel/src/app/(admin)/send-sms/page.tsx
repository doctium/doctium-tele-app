"use client";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle, Users, Stethoscope, Globe } from "lucide-react";
import { RequirePermission } from "@/components/RequirePermission";
import { RecipientPicker, type Person } from "@/components/RecipientPicker";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";

type Audience = "PATIENTS" | "DOCTORS" | "ALL";
interface Counts {
  users: number;
  doctors: number;
}
interface Broadcast {
  id: string;
  audience: string;
  body: string;
  userCount: number;
  doctorCount: number;
  sentCount: number;
  sentByName: string;
  createdAt: string;
}

export default function SendSmsPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [mode, setMode] = useState<"AUDIENCE" | "RECIPIENTS">("AUDIENCE");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [recipientType, setRecipientType] = useState<"USER" | "DOCTOR">("USER");
  const [selected, setSelected] = useState<Person[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const loadHistory = useCallback(() => {
    (
      apiClient.get("/admin/comms/broadcasts", {
        params: { channel: "SMS" },
      }) as Promise<{ data: Broadcast[] }>
    )
      .then((r) => setHistory(r.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (apiClient.get("/admin/comms/audience-counts") as Promise<{ data: Counts }>)
      .then((r) => setCounts(r.data ?? null))
      .catch(() => {});
    loadHistory();
  }, [loadHistory]);

  const segments = Math.max(1, Math.ceil(message.length / 160));

  const send = async () => {
    if (!message.trim()) return toast.error("Message is required");
    if (mode === "RECIPIENTS" && selected.length === 0)
      return toast.error("Select at least one recipient");
    setSending(true);
    try {
      const payload =
        mode === "AUDIENCE"
          ? { mode, audience, message: message.trim() }
          : {
              mode,
              recipientType,
              recipientIds: selected.map((s) => s.id),
              message: message.trim(),
            };
      const r = (await apiClient.post("/admin/comms/sms", payload)) as {
        data: { recipientCount: number; sent: number };
      };
      const d = r.data;
      toast.success(
        `SMS to ${d?.recipientCount ?? 0} recipients` +
          (d?.sent
            ? ` · ${d.sent} delivered`
            : " · 0 delivered (configure Termii creds)"),
      );
      setMessage("");
      setSelected([]);
      loadHistory();
    } catch {
      /* interceptor toasts */
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
      sub: `${counts?.users ?? "—"}`,
      icon: <Users size={18} />,
    },
    {
      key: "DOCTORS",
      label: "Doctors",
      sub: `${counts?.doctors ?? "—"}`,
      icon: <Stethoscope size={18} />,
    },
    {
      key: "ALL",
      label: "Everyone",
      sub: `${(counts?.users ?? 0) + (counts?.doctors ?? 0)}`,
      icon: <Globe size={18} />,
    },
  ];

  return (
    <RequirePermission perm="comms.sms">
      <div className="space-y-5">
        <div>
          <p className="eyebrow">Communication</p>
          <h1 className="page-title mt-0.5">Send SMS</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 card space-y-5">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
              {(["AUDIENCE", "RECIPIENTS"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${mode === m ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500"}`}
                >
                  {m === "AUDIENCE" ? "By audience" : "Specific recipients"}
                </button>
              ))}
            </div>

            {mode === "AUDIENCE" ? (
              <div className="grid grid-cols-3 gap-3">
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
                    <p className="text-xs text-gray-400 mt-1">
                      {a.sub} recipients
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <RecipientPicker
                recipientType={recipientType}
                onRecipientTypeChange={setRecipientType}
                selected={selected}
                onSelectedChange={setSelected}
                channel="sms"
              />
            )}

            <div>
              <label className="label">Message</label>
              <textarea
                className="input"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={640}
                placeholder="Your SMS message…"
              />
              <p className="text-xs text-gray-400 mt-1">
                {message.length} characters · {segments} SMS segment
                {segments > 1 ? "s" : ""} per recipient
              </p>
            </div>

            <div className="flex justify-end pt-1 border-t border-hairline">
              <button
                onClick={send}
                disabled={sending}
                className="btn-primary flex items-center gap-1.5"
              >
                <MessageCircle size={15} /> {sending ? "Sending…" : "Send SMS"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 card">
            <p className="section-title mb-3">Recent SMS</p>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                No SMS sent yet
              </p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto">
                {history.map((b) => (
                  <div
                    key={b.id}
                    className="border border-border rounded-xl p-3"
                  >
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {b.body}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-2">
                      {b.userCount + b.doctorCount} recipients · {b.sentCount}{" "}
                      delivered ·{" "}
                      {format(new Date(b.createdAt), "dd MMM, HH:mm")}
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
