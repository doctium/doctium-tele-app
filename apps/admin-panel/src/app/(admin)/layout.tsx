import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
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
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Navbar />
            <main className="flex-1 overflow-y-auto px-6 py-7 lg:px-8">
              <div
                key="page"
                className="mx-auto max-w-[1400px] animate-fade-up"
              >
                {children}
              </div>
            </main>
          </div>
        </div>
      </SupportProvider>
    </AdminAuthProvider>
  );
}
