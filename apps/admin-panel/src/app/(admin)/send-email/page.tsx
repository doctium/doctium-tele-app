"use client";
import { useCallback, useEffect, useState } from "react";
import { Mail, Users, Stethoscope, Globe } from "lucide-react";
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
  title: string;
  body: string;
  userCount: number;
  doctorCount: number;
  sentCount: number;
  sentByName: string;
  createdAt: string;
}

export default function SendEmailPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [mode, setMode] = useState<"AUDIENCE" | "RECIPIENTS">("AUDIENCE");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [recipientType, setRecipientType] = useState<"USER" | "DOCTOR">("USER");
  const [selected, setSelected] = useState<Person[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Broadcast[]>([]);

  const loadHistory = useCallback(() => {
    (
      apiClient.get("/admin/comms/broadcasts", {
        params: { channel: "EMAIL" },
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

  const send = async () => {
    if (!subject.trim() || !body.trim())
      return toast.error("Subject and message are required");
    if (mode === "RECIPIENTS" && selected.length === 0)
      return toast.error("Select at least one recipient");
    setSending(true);
    try {
      const payload =
        mode === "AUDIENCE"
          ? { mode, audience, subject: subject.trim(), body: body.trim() }
          : {
              mode,
              recipientType,
              recipientIds: selected.map((s) => s.id),
              subject: subject.trim(),
              body: body.trim(),
            };
      const r = (await apiClient.post("/admin/comms/email", payload)) as {
        data: { recipientCount: number; sent: number };
      };
      const d = r.data;
      toast.success(
        `Email to ${d?.recipientCount ?? 0} recipients` +
          (d?.sent
            ? ` · ${d.sent} delivered`
            : " · 0 delivered (configure SMTP creds)"),
      );
      setSubject("");
      setBody("");
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
    <RequirePermission perm="comms.email">
      <div className="space-y-5">
        <div>
          <p className="eyebrow">Communication</p>
          <h1 className="page-title mt-0.5">Send Email</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 card space-y-5">
            {/* Mode */}
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
                channel="email"
              />
            )}

            <div>
              <label className="label">Subject</label>
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={150}
                placeholder="Email subject line"
              />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea
                className="input"
                rows={7}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email… (line breaks are preserved)"
              />
            </div>

            <div className="flex justify-end pt-1 border-t border-hairline">
              <button
                onClick={send}
                disabled={sending}
                className="btn-primary flex items-center gap-1.5"
              >
                <Mail size={15} /> {sending ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>

          {/* History */}
          <div className="lg:col-span-2 card">
            <p className="section-title mb-3">Recent emails</p>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                No emails sent yet
              </p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto">
                {history.map((b) => (
                  <div
                    key={b.id}
                    className="border border-border rounded-xl p-3"
                  >
                    <p className="font-semibold text-ink text-sm truncate">
                      {b.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
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
