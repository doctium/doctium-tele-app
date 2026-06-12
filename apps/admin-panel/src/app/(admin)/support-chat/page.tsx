"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Image as ImageIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchInput } from "@/components/ui/SearchInput";
import { RequirePermission } from "@/components/RequirePermission";
import { apiClient } from "@/lib/api";
import { useAdminAuth } from "@/lib/auth-context";
import { useSupport, type SupportMessage } from "@/lib/support-context";
import { format } from "date-fns";

interface ThreadRow {
  id: string;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadAdmin: number;
  user: { id: string; name: string; image?: string; mobile?: string };
}

function Bubble({ m }: { m: SupportMessage }) {
  const mine = m.sender === "ADMIN";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-navy text-white" : "bg-surface border border-border text-gray-800"}`}
      >
        {m.type === "IMAGE" && m.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.mediaUrl}
            alt="attachment"
            className="rounded-lg max-w-[220px] max-h-[220px] object-cover"
          />
        ) : m.type === "AUDIO" && m.mediaUrl ? (
          <audio controls src={m.mediaUrl} className="max-w-[220px]" />
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
        )}
        <p
          className={`text-[10px] mt-1 ${mine ? "text-white/60" : "text-gray-400"}`}
        >
          {m.senderName && mine ? `${m.senderName} · ` : ""}
          {format(new Date(m.createdAt), "HH:mm")}
        </p>
      </div>
    </div>
  );
}

export default function SupportChatPage() {
  const { can } = useAdminAuth();
  const canReply = can("comms.support_reply");
  const { onMessage, refreshUnread } = useSupport();

  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeUser, setActiveUser] = useState<ThreadRow["user"] | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const loadThreads = useCallback(() => {
    (
      apiClient.get("/admin/support/threads", {
        params: { search: search || undefined, limit: 50 },
      }) as Promise<{ data: { items: ThreadRow[] } }>
    )
      .then((r) => setThreads(r.data?.items ?? []))
      .catch(() => {});
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadThreads, 250);
    return () => clearTimeout(t);
  }, [loadThreads]);

  const openThread = useCallback(
    (id: string) => {
      setActiveId(id);
      (
        apiClient.get(`/admin/support/threads/${id}`) as Promise<{
          data: { thread: ThreadRow; messages: SupportMessage[] };
        }>
      )
        .then((r) => {
          setMessages(r.data?.messages ?? []);
          setActiveUser(r.data?.thread?.user ?? null);
          setThreads((arr) =>
            arr.map((t) => (t.id === id ? { ...t, unreadAdmin: 0 } : t)),
          );
          refreshUnread();
        })
        .catch(() => {});
    },
    [refreshUnread],
  );

  // Live updates from the shared support socket.
  useEffect(
    () =>
      onMessage((msg) => {
        if (msg.threadId === activeIdRef.current) {
          setMessages((m) => [...m, msg]);
          if (msg.sender === "USER") {
            apiClient
              .patch(`/admin/support/threads/${msg.threadId}/read`)
              .catch(() => {});
            refreshUnread();
          }
        }
        loadThreads();
      }),
    [onMessage, loadThreads, refreshUnread],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = async (payload: {
    type: string;
    body?: string;
    dataUrl?: string;
    fileName?: string;
  }) => {
    if (!activeId) return;
    setSending(true);
    try {
      const r = (await apiClient.post(
        `/admin/support/threads/${activeId}/messages`,
        payload,
      )) as { data: SupportMessage };
      if (r.data) setMessages((m) => [...m, r.data]);
      setText("");
      loadThreads();
    } catch {
      /* interceptor toasts the error */
    } finally {
      setSending(false);
    }
  };

  const sendText = () => {
    if (text.trim()) send({ type: "TEXT", body: text.trim() });
  };

  const sendImage = async (file: File) => {
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    send({ type: "IMAGE", dataUrl, fileName: file.name });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <RequirePermission perm="comms.support_view">
      <div className="space-y-4">
        <div>
          <p className="eyebrow">Communication</p>
          <h1 className="page-title mt-0.5">Support Chat</h1>
        </div>

        <div className="card p-0 overflow-hidden flex h-[calc(100vh-220px)] min-h-[480px]">
          {/* Threads */}
          <div className="w-72 sm:w-80 border-r border-border flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-border">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search patients…"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {threads.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">
                  No conversations
                </p>
              ) : (
                threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => openThread(t.id)}
                    className={`w-full text-left px-3 py-3 border-b border-hairline flex gap-3 items-center hover:bg-muted transition-colors ${activeId === t.id ? "bg-skyblue-50" : ""}`}
                  >
                    <Avatar src={t.user?.image} name={t.user?.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-semibold text-ink text-sm truncate">
                          {t.user?.name ?? "Patient"}
                        </span>
                        {t.lastMessageAt ? (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">
                            {format(new Date(t.lastMessageAt), "dd MMM HH:mm")}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex justify-between items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 truncate">
                          {t.lastMessage || "—"}
                        </span>
                        {t.unreadAdmin > 0 ? (
                          <span className="min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold text-white bg-alert rounded-full flex-shrink-0">
                            {t.unreadAdmin}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Conversation */}
          <div className="flex-1 flex flex-col min-w-0">
            {!activeId ? (
              <div className="flex-1 grid place-items-center text-gray-400 text-sm">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                  <Avatar
                    src={activeUser?.image}
                    name={activeUser?.name}
                    size={36}
                  />
                  <div>
                    <p className="font-semibold text-ink text-sm">
                      {activeUser?.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {activeUser?.mobile}
                    </p>
                  </div>
                </div>

                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/30"
                >
                  {messages.map((m) => (
                    <Bubble key={m.id} m={m} />
                  ))}
                </div>

                {canReply ? (
                  <div className="p-3 border-t border-border flex items-center gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) sendImage(f);
                      }}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={sending}
                      className="grid place-items-center w-10 h-10 rounded-xl border border-border text-gray-500 hover:text-ink flex-shrink-0"
                      aria-label="Attach image"
                    >
                      <ImageIcon size={18} />
                    </button>
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendText();
                        }
                      }}
                      placeholder="Type a reply…"
                      className="flex-1 h-10 rounded-xl border border-border px-3 text-sm outline-none focus:border-teal-400"
                    />
                    <button
                      onClick={sendText}
                      disabled={sending || !text.trim()}
                      className="grid place-items-center w-10 h-10 rounded-xl bg-gradient-navy text-white disabled:opacity-50 flex-shrink-0"
                      aria-label="Send"
                    >
                      <Send size={17} />
                    </button>
                  </div>
                ) : (
                  <div className="p-3 border-t border-border text-center text-xs text-gray-400">
                    You don&apos;t have permission to reply.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
