"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { Toggle } from "@/components/ui/Toggle";
import { SearchInput } from "@/components/ui/SearchInput";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import type { User } from "@/types";

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 15;

  const load = async () => {
    setLoading(true);
    try {
      const res = (await apiClient.get("/admin/users", {
        params: { page, limit: PAGE_SIZE },
      })) as { data: User[]; total?: number };
      setUsers(res.data ?? []);
      setTotal(res.total ?? res.data?.length ?? 0);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const setBlocked = async (id: string, blocked: boolean) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, isBlock: blocked } : u)),
    );
    try {
      await apiClient.patch(`/admin/users/${id}/block`, { isBlock: blocked });
      toast.success(
        blocked
          ? "Customer blocked — they have been notified"
          : "Customer unblocked",
      );
    } catch {
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, isBlock: !blocked } : u)),
      );
    }
  };

  const filtered = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          u.mobile.includes(search),
      )
    : users;

  const cols: Column<User>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => (
        <span className="text-gray-400 text-sm">
          {(page - 1) * PAGE_SIZE + i + 1}
        </span>
      ),
    },
    {
      key: "name",
      header: "Customer",
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.image} name={r.name} size={36} />
          <div>
            <p className="font-semibold text-gray-900">{r.name}</p>
            <p className="text-xs text-gray-400">{r.email || r.mobile}</p>
          </div>
        </div>
      ),
    },
    {
      key: "mobile",
      header: "Mobile",
      render: (r) => <span className="text-gray-600">{r.mobile}</span>,
    },
    {
      key: "status",
      header: "Account",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Toggle
            checked={!r.isBlock}
            onChange={(active) => setBlocked(r.id, !active)}
          />
          <span
            className={`text-xs font-semibold ${r.isBlock ? "text-alert" : "text-success-600"}`}
          >
            {r.isBlock ? "Blocked" : "Active"}
          </span>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Joined",
      render: (r) => (
        <span className="text-gray-500 text-sm">
          {format(new Date(r.createdAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <button
          onClick={() => router.push(`/users/${r.id}`)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-500/10 transition-colors"
          title="View customer details"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total users</p>
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email, phone..."
        />
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={filtered}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No customers found"
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
