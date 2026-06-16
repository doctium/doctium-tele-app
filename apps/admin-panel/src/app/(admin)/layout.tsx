import { AdminShell } from "@/components/layout/AdminShell";
import { AdminAuthProvider } from "@/lib/auth-context";
import { SupportProvider } from "@/lib/support-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <SupportProvider>
        <AdminShell>{children}</AdminShell>
      </SupportProvider>
    </AdminAuthProvider>
  );
}
