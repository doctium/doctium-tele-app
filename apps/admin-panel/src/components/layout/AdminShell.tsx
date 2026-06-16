"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

/**
 * The admin chrome (sidebar + navbar + scroll area). Owns the mobile-drawer
 * open state so the navbar's hamburger and the sidebar drawer stay in sync.
 * On md+ the sidebar is an in-flow column (desktop layout unchanged); below md
 * it's an off-canvas drawer toggled here.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Navigating (tapping a nav link) closes the drawer on mobile.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Navbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div key="page" className="mx-auto max-w-[1400px] animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
