"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar,
  Wallet,
  LogOut,
  ChevronDown,
  Crown,
  Briefcase,
  Send,
  TrendingUp,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { logout as adminLogout } from "@/lib/auth";
import { useAdminAuth } from "@/lib/auth-context";

interface NavChild {
  label: string;
  href: string;
  perm?: string;
}
interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  perm?: string;
  children?: NavChild[];
}

// Module → sub-module navigation. Each top-level entry is a domain module
// that expands; a module is hidden entirely when the admin can see none of
// its sub-modules (see visibleNav). Exported so the landing redirect can pick
// the first route a given admin is permitted to open (see lib/landing.ts).
export const nav: { group: string; items: NavItem[] }[] = [
  {
    group: "OVERVIEW",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: <LayoutDashboard size={18} />,
        perm: "dashboard.view",
      },
      {
        label: "Insights",
        icon: <TrendingUp size={18} />,
        children: [
          { label: "Analytics", href: "/analytics", perm: "analytics.view" },
          {
            label: "Satisfaction",
            href: "/satisfaction",
            perm: "analytics.view",
          },
          { label: "Leenah AI", href: "/leenah", perm: "analytics.view" },
        ],
      },
    ],
  },
  {
    group: "OPERATIONS",
    items: [
      {
        label: "Patients",
        icon: <Users size={18} />,
        children: [
          { label: "Customers", href: "/users", perm: "users.view" },
          {
            label: "Medical Records",
            href: "/medical-records",
            perm: "emr.view",
          },
          {
            label: "Care Programs",
            href: "/care-programs",
            perm: "analytics.view",
          },
          {
            label: "Organizations",
            href: "/organizations",
            perm: "enterprise.view",
          },
        ],
      },
      {
        label: "Doctors",
        icon: <UserCheck size={18} />,
        children: [
          { label: "All Doctors", href: "/doctors", perm: "doctors.view" },
          {
            label: "Specialist Referrals",
            href: "/referrals",
            perm: "appointments.view",
          },
          { label: "Attendance", href: "/attendance", perm: "finance.view" },
          {
            label: "Doctor Holiday",
            href: "/doctor-holiday",
            perm: "doctors.manage",
          },
        ],
      },
      {
        label: "Bookings",
        icon: <Calendar size={18} />,
        children: [
          {
            label: "All Appointments",
            href: "/appointments",
            perm: "appointments.view",
          },
          {
            label: "Daily",
            href: "/appointments/daily",
            perm: "appointments.view",
          },
          {
            label: "Monthly Report",
            href: "/appointments/monthly",
            perm: "appointments.view",
          },
          {
            label: "Recordings",
            href: "/recordings",
            perm: "appointments.view",
          },
          {
            label: "Prescriptions",
            href: "/prescriptions",
            perm: "content.view",
          },
        ],
      },
    ],
  },
  {
    group: "REVENUE",
    items: [
      {
        label: "Finance",
        icon: <Wallet size={18} />,
        children: [
          {
            label: "Transactions",
            href: "/transactions",
            perm: "finance.view",
          },
          { label: "Withdrawals", href: "/withdrawals", perm: "finance.view" },
          { label: "Recharge", href: "/recharge", perm: "finance.view" },
          { label: "Add Funds", href: "/add-funds", perm: "finance.manage" },
          { label: "Coupons", href: "/coupons", perm: "coupons.manage" },
        ],
      },
      {
        label: "DoctiumPlus",
        icon: <Crown size={18} />,
        children: [
          {
            label: "Plans",
            href: "/subscription-plans",
            perm: "subscriptions.view",
          },
          {
            label: "Subscriptions",
            href: "/subscriptions",
            perm: "subscriptions.view",
          },
          {
            label: "Revenue",
            href: "/subscriptions/revenue",
            perm: "subscriptions.view",
          },
        ],
      },
    ],
  },
  {
    group: "PLATFORM",
    items: [
      {
        label: "Content & Catalog",
        icon: <LayoutGrid size={18} />,
        children: [
          { label: "Services", href: "/services", perm: "catalog.manage" },
          {
            label: "Suggested Services",
            href: "/suggested-services",
            perm: "catalog.manage",
          },
          { label: "Banners", href: "/banners", perm: "catalog.manage" },
          { label: "MediGram", href: "/videos", perm: "content.moderate" },
          { label: "Reviews", href: "/reviews", perm: "content.view" },
          { label: "Complaints", href: "/complaints", perm: "content.view" },
          { label: "Suggestions", href: "/suggestions", perm: "content.view" },
        ],
      },
      {
        label: "Communication",
        icon: <Send size={18} />,
        children: [
          {
            label: "Support Chat",
            href: "/support-chat",
            perm: "comms.support_view",
          },
          {
            label: "Push Notifications",
            href: "/push-notifications",
            perm: "comms.notifications",
          },
          { label: "Send Email", href: "/send-email", perm: "comms.email" },
          { label: "Send SMS", href: "/send-sms", perm: "comms.sms" },
        ],
      },
      {
        label: "Human Resources",
        icon: <Briefcase size={18} />,
        children: [
          { label: "Employees", href: "/employees", perm: "hr.view" },
          { label: "Departments", href: "/departments", perm: "hr.view" },
          { label: "Leave", href: "/leave", perm: "hr.view" },
          { label: "Payroll", href: "/payroll", perm: "hr.payroll" },
          { label: "Roles & Permissions", href: "/roles", perm: "hr.roles" },
          { label: "Audit Log", href: "/audit", perm: "audit.view" },
        ],
      },
    ],
  },
];

function NavLink({
  item,
  collapsed,
  onExpandRequest,
}: {
  item: NavItem;
  collapsed: boolean;
  onExpandRequest: () => void;
}) {
  const pathname = usePathname();
  const childActive =
    item.children?.some((c) => pathname.startsWith(c.href)) ?? false;
  const [open, setOpen] = useState(childActive);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => {
            // Tapping a module while collapsed expands the rail and opens it.
            if (collapsed) {
              onExpandRequest();
              setOpen(true);
            } else {
              setOpen(!open);
            }
          }}
          title={collapsed ? item.label : undefined}
          className={clsx(
            "group w-full flex items-center gap-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
            collapsed ? "justify-center px-0" : "px-3",
            childActive
              ? "text-white bg-white/[0.07]"
              : "text-skyblue-100/70 hover:text-white hover:bg-white/[0.06]",
          )}
        >
          <span
            className={clsx(
              "transition-colors",
              childActive
                ? "text-teal-bright"
                : "text-skyblue-100/50 group-hover:text-skyblue-200",
            )}
          >
            {item.icon}
          </span>
          {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
          {!collapsed && (
            <ChevronDown
              size={14}
              className={clsx(
                "transition-transform duration-200 text-white/40",
                open || childActive ? "rotate-0" : "-rotate-90",
              )}
            />
          )}
        </button>
        <div
          className={clsx(
            "grid transition-all duration-300 ease-out",
            !collapsed && (open || childActive)
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <div className="ml-4 mt-1 mb-1 flex flex-col gap-0.5 border-l border-white/10 pl-3">
              {item.children.map((c) => {
                // Longest-prefix match so detail pages (/doctors/123) light up
                // "All Doctors" while /appointments/daily still picks "Daily".
                const best = item
                  .children!.filter(
                    (x) =>
                      pathname === x.href || pathname.startsWith(x.href + "/"),
                  )
                  .sort((a, b) => b.href.length - a.href.length)[0]?.href;
                const active = c.href === best;
                return (
                  <Link
                    key={c.href}
                    href={c.href}
                    className={clsx(
                      "relative px-3 py-2 rounded-lg text-[13px] transition-all duration-200",
                      active
                        ? "text-white font-semibold bg-white/[0.08]"
                        : "text-skyblue-100/55 hover:text-white hover:bg-white/[0.05]",
                    )}
                  >
                    {active && (
                      <span className="absolute -left-[15px] top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-teal-bright" />
                    )}
                    {c.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const active = item.href ? pathname === item.href : false;
  return (
    <Link
      href={item.href!}
      title={collapsed ? item.label : undefined}
      className={clsx(
        "group relative flex items-center gap-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
        collapsed ? "justify-center px-0" : "px-3",
        active
          ? "text-white bg-gradient-to-r from-teal-500/22 to-teal-500/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "text-skyblue-100/70 hover:text-white hover:bg-white/[0.06]",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-teal-bright shadow-[0_0_12px_rgba(94,151,209,0.7)]" />
      )}
      <span
        className={clsx(
          "transition-colors",
          active
            ? "text-teal-bright"
            : "text-skyblue-100/50 group-hover:text-skyblue-200",
        )}
      >
        {item.icon}
      </span>
      {!collapsed && item.label}
    </Link>
  );
}

/** True at md+ (Tailwind's md breakpoint). The collapse-to-rail affordance is
 *  desktop-only; on mobile the drawer is always full-width with labels. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const { me, can } = useAdminAuth();

  // Collapsible rail: icon-only ↔ icon + text, remembered across sessions.
  // Initialized in an effect (not useState init) to avoid SSR hydration mismatch.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  // On mobile, ignore the persisted collapsed preference so the drawer always
  // shows full labels (a narrow icon-rail in a wide drawer looks broken).
  const isDesktop = useIsDesktop();
  const showCollapsed = isDesktop && collapsed;
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  const expand = () => {
    localStorage.setItem("sidebar-collapsed", "0");
    setCollapsed(false);
  };

  const handleLogout = async () => {
    await adminLogout();
    router.push("/login");
  };

  // Show only the nav the current admin is permitted to see.
  const visibleNav = useMemo(
    () =>
      nav
        .map((section) => {
          const items = section.items
            .map((item) => {
              if (item.children) {
                const children = item.children.filter((c) => can(c.perm));
                return children.length ? { ...item, children } : null;
              }
              return can(item.perm) ? item : null;
            })
            .filter(Boolean) as NavItem[];
          return { group: section.group, items };
        })
        .filter((section) => section.items.length),
    [can],
  );

  return (
    <>
      {/* Mobile drawer backdrop — tap to dismiss */}
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-navy-deep/50 backdrop-blur-sm transition-opacity duration-300 md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex h-screen flex-col overflow-hidden bg-gradient-navy text-white",
          "transition-[transform,width] duration-300 ease-out",
          "md:relative md:z-auto md:flex-shrink-0",
          // Width: full drawer on mobile; collapse to a rail only on desktop.
          collapsed ? "w-64 md:w-[76px]" : "w-64",
          // Slide off-canvas on mobile; always in view from md up.
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 -left-20 h-56 w-56 rounded-full bg-skyblue/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 hero-sheen" />

        {/* Logo + collapse toggle */}
        <div
          className={clsx(
            "relative border-b border-white/10",
            showCollapsed ? "px-0 py-4" : "px-5 py-5",
          )}
        >
          <div
            className={clsx(
              "flex items-center",
              showCollapsed ? "flex-col gap-2" : "gap-3",
            )}
          >
            <Link
              href="/dashboard"
              className={clsx(
                "flex items-center min-w-0",
                showCollapsed ? "flex-col gap-2" : "gap-3 flex-1",
              )}
              title="Go to dashboard"
            >
              <div className="grid place-items-center w-10 h-10 rounded-2xl bg-white shadow-cta-navy overflow-hidden p-1.5 flex-shrink-0">
                <img
                  src="/brand/doctium-logo-lightbg.png"
                  alt="Doctium"
                  className="w-full h-full object-contain"
                />
              </div>
              {!showCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold tracking-tight text-[15px] leading-none">
                    Doctium
                  </p>
                  <p className="text-[11px] text-skyblue-200/70 mt-1 tracking-wide">
                    Admin Panel
                  </p>
                </div>
              )}
            </Link>
            {/* Desktop: collapse to an icon rail */}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden md:grid place-items-center w-7 h-7 rounded-lg text-skyblue-100/60 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              {collapsed ? (
                <PanelLeftOpen size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </button>
            {/* Mobile: close the drawer */}
            <button
              onClick={onClose}
              title="Close menu"
              className="md:hidden grid place-items-center w-8 h-8 rounded-lg text-skyblue-100/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav
          className={clsx(
            "relative flex-1 overflow-y-auto py-5",
            showCollapsed ? "px-2 space-y-4" : "px-3 space-y-6",
          )}
        >
          {visibleNav.map((section) => (
            <div key={section.group}>
              {showCollapsed ? (
                <div className="mx-3 mb-2 border-t border-white/10" />
              ) : (
                <p className="px-3 mb-2 text-[10px] font-bold text-skyblue-200/45 tracking-[0.16em] uppercase">
                  {section.group}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.label}
                    item={item}
                    collapsed={showCollapsed}
                    onExpandRequest={expand}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Current user + logout */}
        <div
          className={clsx(
            "relative py-4 border-t border-white/10",
            showCollapsed ? "px-2" : "px-3",
          )}
        >
          {me && (
            <div
              className={clsx(
                "flex items-center pb-3",
                showCollapsed ? "justify-center" : "gap-3 px-3",
              )}
              title={
                showCollapsed
                  ? `${me.name} · ${me.roleName ?? "Admin"}`
                  : undefined
              }
            >
              <div className="grid place-items-center w-9 h-9 rounded-full bg-white/10 text-teal-bright font-bold text-sm flex-shrink-0">
                {me.name?.[0]?.toUpperCase() ?? "A"}
              </div>
              {!showCollapsed && (
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate">
                    {me.name}
                  </p>
                  <p className="text-[11px] text-skyblue-200/60 truncate">
                    {me.roleName ?? "Admin"}
                  </p>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            title={showCollapsed ? "Sign Out" : undefined}
            className={clsx(
              "w-full flex items-center py-2.5 rounded-xl text-[13px] font-medium text-skyblue-100/70 hover:text-white hover:bg-alert-500/15 transition-colors",
              showCollapsed ? "justify-center px-0" : "gap-3 px-3",
            )}
          >
            <LogOut size={18} className="text-skyblue-100/50" />
            {!showCollapsed && "Sign Out"}
          </button>
        </div>
      </aside>
    </>
  );
}
