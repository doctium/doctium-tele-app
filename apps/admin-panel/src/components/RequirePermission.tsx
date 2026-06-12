"use client";
import { ShieldAlert } from "lucide-react";
import { useAdminAuth } from "@/lib/auth-context";

/** Wrap a page's content; renders an Access-denied card if the current admin lacks `perm`. */
export function RequirePermission({
  perm,
  children,
}: {
  perm: string;
  children: React.ReactNode;
}) {
  const { loading, can } = useAdminAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    );
  }
  if (!can(perm)) {
    return (
      <div className="card flex flex-col items-center justify-center text-center py-16 gap-3">
        <div className="grid place-items-center w-14 h-14 rounded-2xl bg-alert-50 text-alert-600">
          <ShieldAlert size={26} />
        </div>
        <h2 className="section-title">Access denied</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          You don’t have permission to view this page. Contact an administrator
          if you believe this is a mistake.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
