"use client";
import {
  CalendarCheck,
  Loader2,
  Search,
  Stethoscope,
  Syringe,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NotificationBell } from "./NotificationBell";
import { MessagesBadge } from "./MessagesBadge";
import { ProfileMenu } from "./ProfileMenu";
import { Avatar } from "@/components/ui/Avatar";
import { apiClient } from "@/lib/api";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "Customers",
  "/doctors": "Doctors",
  "/reviews": "Reviews",
  "/complaints": "Complaints",
  "/suggestions": "Suggestions",
  "/attendance": "Attendance",
  "/services": "Services",
  "/suggested-services": "Suggested Services",
  "/appointments": "All Appointments",
  "/appointments/daily": "Daily Appointments",
  "/appointments/monthly": "Monthly Report",
  "/prescriptions": "Prescriptions",
  "/coupons": "Coupons",
  "/subscription-plans": "DoctiumPlus Plans",
  "/subscriptions": "Subscriptions",
  "/subscriptions/revenue": "Subscription Revenue",
  "/transactions": "Transactions",
  "/withdrawals": "Withdrawals",
  "/recharge": "User Recharge",
  "/doctor-holiday": "Doctor Holidays",
  "/banners": "Banners",
  "/employees": "Employees",
  "/departments": "Departments",
  "/leave": "Leave Management",
  "/payroll": "Payroll",
  "/roles": "Roles & Permissions",
  "/audit": "Audit Log",
  "/profile": "My Profile",
  "/settings": "Settings",
  "/support-chat": "Support Chat",
  "/push-notifications": "Push Notifications",
  "/send-email": "Send Email",
  "/send-sms": "Send SMS",
};

interface SearchResults {
  bookings: {
    id: string;
    bookingNumber?: number;
    date?: string;
    time?: string;
    status?: string;
    user?: { name?: string };
    doctor?: { name?: string };
  }[];
  patients: { id: string; name?: string; mobile?: string; image?: string }[];
  doctors: {
    id: string;
    name?: string;
    designation?: string;
    image?: string;
  }[];
  services: { id: string; name?: string }[];
}

const EMPTY: SearchResults = {
  bookings: [],
  patients: [],
  doctors: [],
  services: [],
};

/** Console-wide search: booking IDs, patients, doctors, service types. */
function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced lookup.
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      apiClient
        .get("/admin/search", { params: { q: needle } })
        .then((r: unknown) =>
          setResults((r as { data: SearchResults }).data ?? EMPTY),
        )
        .catch(() => setResults(EMPTY))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const total =
    results.bookings.length +
    results.patients.length +
    results.doctors.length +
    results.services.length;
  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative hidden md:block">
      <div className="flex items-center gap-2 h-10 w-72 rounded-xl bg-white/70 border border-border px-3 text-gray-400 focus-within:border-teal-400 focus-within:ring-4 focus-within:ring-teal-500/10 transition-all">
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Search size={16} />
        )}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && q.trim())
              go(`/appointments?search=${encodeURIComponent(q.trim())}`);
          }}
          placeholder="Booking ID, patient, doctor, service…"
          className="flex-1 bg-transparent text-body-md text-gray-700 placeholder:text-gray-400 outline-none"
        />
      </div>

      {showPanel && (
        <div className="absolute right-0 top-12 w-[26rem] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-floating p-2 z-50">
          {total === 0 && !loading ? (
            <p className="px-3 py-6 text-sm text-gray-400 text-center">
              No matches for “{q.trim()}”
            </p>
          ) : (
            <>
              {results.bookings.length > 0 && (
                <Section label="Bookings">
                  {results.bookings.map((b) => (
                    <Row
                      key={b.id}
                      onClick={() => go(`/appointments/${b.id}`)}
                      icon={
                        <span className="grid place-items-center w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600">
                          <CalendarCheck size={15} />
                        </span>
                      }
                      title={`#${b.bookingNumber ?? "—"} · ${b.user?.name ?? "Patient"}`}
                      sub={`${b.doctor?.name ?? ""} · ${b.date ?? ""} ${b.time ?? ""} · ${b.status ?? ""}`}
                    />
                  ))}
                </Section>
              )}
              {results.patients.length > 0 && (
                <Section label="Patients">
                  {results.patients.map((p) => (
                    <Row
                      key={p.id}
                      onClick={() => go(`/users/${p.id}`)}
                      icon={<Avatar src={p.image} name={p.name} size={32} />}
                      title={p.name ?? "—"}
                      sub={p.mobile ?? ""}
                      fallbackIcon={<User size={15} />}
                    />
                  ))}
                </Section>
              )}
              {results.doctors.length > 0 && (
                <Section label="Doctors">
                  {results.doctors.map((d) => (
                    <Row
                      key={d.id}
                      onClick={() => go(`/doctors/${d.id}`)}
                      icon={<Avatar src={d.image} name={d.name} size={32} />}
                      title={d.name ?? "—"}
                      sub={d.designation ?? ""}
                      fallbackIcon={<Stethoscope size={15} />}
                    />
                  ))}
                </Section>
              )}
              {results.services.length > 0 && (
                <Section label="Service types">
                  {results.services.map((s) => (
                    <Row
                      key={s.id}
                      onClick={() => go(`/services`)}
                      icon={
                        <span className="grid place-items-center w-8 h-8 rounded-lg bg-skyblue/20 text-primary-600">
                          <Syringe size={15} />
                        </span>
                      }
                      title={s.name ?? "—"}
                      sub="Service"
                    />
                  ))}
                </Section>
              )}
              <button
                onClick={() =>
                  go(`/appointments?search=${encodeURIComponent(q.trim())}`)
                }
                className="w-full mt-1 px-3 py-2.5 rounded-xl text-xs font-semibold text-teal-600 hover:bg-teal-500/10 text-left transition-colors"
              >
                See all booking results for “{q.trim()}” ↵
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.12em] uppercase text-gray-400">
        {label}
      </p>
      {children}
    </div>
  );
}

function Row({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  onClick: () => void;
  fallbackIcon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted text-left transition-colors"
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink truncate">
          {title}
        </span>
        {sub ? (
          <span className="block text-xs text-gray-400 truncate">{sub}</span>
        ) : null}
      </span>
    </button>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Doctium Admin";

  return (
    <header className="sticky top-0 z-30 h-16 glass border-b border-white/50 flex items-center justify-between px-6 flex-shrink-0">
      <div className="min-w-0">
        <p className="eyebrow leading-none">Doctium Console</p>
        <h1 className="text-heading-sm font-bold text-ink leading-tight mt-0.5 truncate">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Global search */}
        <GlobalSearch />

        {/* Support messages */}
        <MessagesBadge />

        {/* Notifications */}
        <NotificationBell />

        {/* Profile + settings dropdown */}
        <ProfileMenu />
      </div>
    </header>
  );
}
