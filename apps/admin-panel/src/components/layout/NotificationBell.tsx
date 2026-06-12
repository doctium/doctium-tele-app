"use client";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api";

interface AdminNotif {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const loadCount = async () => {
    try {
      const r = await (apiClient.get(
        "/admin/notifications/unread-count",
      ) as Promise<{
        data: { count: number };
      }>);
      setUnread(r.data?.count ?? 0);
    } catch {
      /* silent */
    }
  };

  const loadList = async () => {
    try {
      const r = await (apiClient.get("/admin/notifications") as Promise<{
        data: AdminNotif[];
      }>);
      setItems(r.data ?? []);
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (open) loadList();
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const openItem = (n: AdminNotif) => {
    setOpen(false);
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((arr) =>
        arr.map((x) => (x.id === n.id ? { ...x, read: true } : x)),
      );
      apiClient.patch(`/admin/notifications/${n.id}/read`).catch(() => {});
    }
    if (n.link) router.push(n.link);
  };

  const markAll = async () => {
    setUnread(0);
    setItems((arr) => arr.map((x) => ({ ...x, read: true })));
    try {
      await apiClient.patch("/admin/notifications/read-all");
    } catch {
      /* silent */
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid place-items-center w-10 h-10 rounded-xl bg-white/70 border border-border text-gray-500 hover:text-ink hover:border-navy/20 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold text-white bg-alert rounded-full ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-auto rounded-2xl bg-surface border border-border shadow-floating z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-surface">
            <span className="text-body-md font-bold text-ink">
              Notifications
            </span>
            {items.some((x) => !x.read) ? (
              <button
                onClick={markAll}
                className="text-[12px] font-semibold text-interactive hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-400 text-body-md">
              No notifications
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-3 border-b border-hairline hover:bg-muted transition-colors flex gap-3 ${
                  n.read ? "" : "bg-skyblue-50"
                }`}
              >
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    n.read ? "bg-transparent" : "bg-teal"
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink truncate">
                    {n.title}
                  </span>
                  <span className="block text-[12px] text-gray-500 mt-0.5 line-clamp-2">
                    {n.body}
                  </span>
                  <span className="block text-[11px] text-gray-400 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
