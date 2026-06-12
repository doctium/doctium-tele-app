"use client";
import { useEffect, useState } from "react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { apiClient } from "@/lib/api";
import { RequirePermission } from "@/components/RequirePermission";
import type { AuditEntry } from "@/types";
import { format } from "date-fns";

export default function AuditPage() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const PAGE_SIZE = 50;

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/admin/hr/audit", {
        params: { page, limit: PAGE_SIZE, action: action || undefined },
      })
      .then((r: unknown) => {
        const d = (r as { data: { items: AuditEntry[]; total: number } }).data;
        setRows(d?.items ?? []);
        setTotal(d?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, action]);

  const cols: Column<AuditEntry>[] = [
    {
      key: "date",
      header: "When",
      render: (r) => (
        <span className="text-gray-500 tabular-nums">
          {format(new Date(r.createdAt), "dd MMM, HH:mm")}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (r) => (
        <span className="text-ink font-medium">{r.actorName || "System"}</span>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (r) => <Badge label={r.action} variant="info" />,
    },
    {
      key: "entity",
      header: "Entity",
      render: (r) => (
        <span className="text-gray-500 text-sm">
          {r.entityType}
          {r.entityId ? ` · ${r.entityId.slice(0, 8)}…` : ""}
        </span>
      ),
    },
  ];

  return (
    <RequirePermission perm="audit.view">
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="eyebrow">Accountability</p>
            <h1 className="page-title mt-0.5">Audit Log</h1>
          </div>
          <SearchInput
            value={action}
            onChange={(v) => {
              setAction(v);
              setPage(1);
            }}
            placeholder="Filter by action…"
          />
        </div>
        <div className="card p-0 overflow-hidden">
          <DataTable
            columns={cols}
            data={rows}
            keyExtractor={(r) => r.id}
            loading={loading}
            emptyMessage="No activity recorded yet"
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </div>
    </RequirePermission>
  );
}
