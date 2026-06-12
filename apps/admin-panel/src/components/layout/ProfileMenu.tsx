"use client";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  User,
  Settings,
  LogOut,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/auth-context";
import { logout as adminLogout } from "@/lib/auth";
import { useTheme, type ThemeMode } from "@/lib/theme-context";

const THEME_OPTIONS: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
  { mode: "system", icon: Monitor, label: "System" },
  { mode: "light", icon: Sun, label: "Light" },
  { mode: "dark", icon: Moon, label: "Dark" },
];

export function ProfileMenu() {
  const router = useRouter();
  const { me, can } = useAdminAuth();
  const { mode, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };
  const logout = async () => {
    await adminLogout();
    router.push("/login");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 h-10 pl-1.5 pr-2.5 rounded-xl bg-surface/70 border border-border hover:border-navy/20 transition-colors"
      >
        {me?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.image}
            alt={me.name}
            className="w-7 h-7 rounded-lg object-cover"
          />
        ) : (
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-navy text-white text-[12px] font-bold">
            {me?.name?.[0]?.toUpperCase() ?? "A"}
          </span>
        )}
        <span className="hidden sm:block text-left leading-none">
          <span className="block text-[12px] font-semibold text-ink">
            {me?.name ?? "Admin"}
          </span>
          <span className="block text-[10px] text-gray-400 mt-0.5">
            {me?.roleName ?? "Admin"}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-surface border border-border shadow-floating overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-hairline">
            <p className="text-sm font-semibold text-ink truncate">
              {me?.name ?? "Admin"}
            </p>
            <p className="text-xs text-gray-400 truncate">{me?.email ?? ""}</p>
          </div>
          <button
            onClick={() => go("/profile")}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-muted transition-colors"
          >
            <User size={16} className="text-gray-400" /> My profile
          </button>
          {can("settings.manage") ? (
            <button
              onClick={() => go("/settings")}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-muted transition-colors"
            >
              <Settings size={16} className="text-gray-400" /> Settings
            </button>
          ) : null}

          {/* Theme switcher */}
          <div className="px-4 py-3 border-t border-hairline">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Appearance
            </p>
            <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
              {THEME_OPTIONS.map((o) => {
                const Icon = o.icon;
                const active = mode === o.mode;
                return (
                  <button
                    key={o.mode}
                    onClick={() => setMode(o.mode)}
                    title={o.label}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                      active
                        ? "bg-surface text-ink shadow-card"
                        : "text-gray-500 hover:text-ink"
                    }`}
                  >
                    <Icon size={13} /> {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-alert hover:bg-alert-50 border-t border-hairline transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
