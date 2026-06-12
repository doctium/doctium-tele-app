"use client";
import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSupport } from "@/lib/support-context";

export function MessagesBadge() {
  const router = useRouter();
  const { unread } = useSupport();

  return (
    <button
      onClick={() => router.push("/support-chat")}
      className="relative grid place-items-center w-10 h-10 rounded-xl bg-white/70 border border-border text-gray-500 hover:text-ink hover:border-navy/20 transition-colors"
      aria-label="Support messages"
    >
      <MessageSquare size={18} />
      {unread > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 grid place-items-center text-[10px] font-bold text-white bg-alert rounded-full ring-2 ring-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </button>
  );
}
