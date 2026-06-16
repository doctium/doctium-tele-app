"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Users, Stethoscope, Globe, Paperclip, X } from "lucide-react";
import { RequirePermission } from "@/components/RequirePermission";
import { RecipientPicker, type Person } from "@/components/RecipientPicker";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

// Quill touches the DOM on import → load it client-only.
const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <div className="input" style={{ height: 180 }} />,
});

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    [{ font: [] }, { size: [] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }, { align: [] }],
    [{ indent: "-1" }, { indent: "+1" }],
    ["blockquote", "code-block", "link", "image"],
    ["clean"],
  ],
};

// Quill renders an empty document as "<p><br></p>".
const htmlIsEmpty = (html: string) => {
  const text = (html || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length === 0 && !/<img/i.test(html || "");
};

const stripHtml = (html: string) =>
  (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

type Attachment = {
  filename: string;
  content: string; // base64, no data-url prefix
  contentType: string;
  size: number;
};
const MAX_ATTACH_BYTES = 5 * 1024 * 1024; // 5MB total raw (~6.7MB base64, under the API's 10mb body cap)
const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
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

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    let total = attachments.reduce((s, a) => s + a.size, 0);
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (total + file.size > MAX_ATTACH_BYTES) {
        toast.error("Attachments exceed the 5MB total limit");
        break;
      }
      next.push({
        filename: file.name,
        content: await fileToBase64(file),
        contentType: file.type || "application/octet-stream",
        size: file.size,
      });
      total += file.size;
    }
    if (next.length) setAttachments((a) => [...a, ...next]);
  };

  const send = async () => {
    if (!subject.trim() || htmlIsEmpty(body))
      return toast.error("Subject and message are required");
    if (mode === "RECIPIENTS" && selected.length === 0)
      return toast.error("Select at least one recipient");
    setSending(true);
    try {
      const atts = attachments.map(({ filename, content, contentType }) => ({
        filename,
        content,
        contentType,
      }));
      const payload =
        mode === "AUDIENCE"
          ? {
              mode,
              audience,
              subject: subject.trim(),
              body: body.trim(),
              attachments: atts,
            }
          : {
              mode,
              recipientType,
              recipientIds: selected.map((s) => s.id),
              subject: subject.trim(),
              body: body.trim(),
              attachments: atts,
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
      setAttachments([]);
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
              <label className="label">Attachment</label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 border-2 border-dashed border-border rounded-xl px-4 py-3 text-sm text-gray-500 cursor-pointer hover:border-navy/40 transition-colors"
              >
                <Paperclip size={16} /> Drag and drop a file here, or click to
                choose
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((a, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1 text-xs text-gray-700"
                    >
                      {a.filename} · {(a.size / 1024).toFixed(0)}KB
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((arr) => arr.filter((_, j) => j !== i))
                        }
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div>
              <label className="label">Message</label>
              <div className="rounded-xl border border-border overflow-hidden bg-white">
                <ReactQuill
                  theme="snow"
                  value={body}
                  onChange={setBody}
                  modules={QUILL_MODULES}
                  placeholder="Compose your email — format text, add links, images…"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Formatting is sent as a styled HTML email.
              </p>
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
                      {stripHtml(b.body)}
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
