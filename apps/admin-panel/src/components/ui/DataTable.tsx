'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

export function DataTable<T>({
  columns, data, keyExtractor, loading, emptyMessage = 'No data found',
  page = 1, pageSize = 10, total, onPageChange,
}: Props<T>) {
  const totalPages = total ? Math.ceil(total / pageSize) : Math.ceil(data.length / pageSize);
  const paginated = total ? data : data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-body-md">
          <thead>
            <tr className="bg-surfaceAlt/70 border-b border-hairline">
              {columns.map(col => (
                <th key={col.key} className="text-left px-5 py-3.5 text-micro font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap" style={{ width: col.width }}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col.key} className="px-5 py-4">
                      <div className="h-3.5 rounded-full bg-surfaceAlt animate-pulse" style={{ width: `${55 + ((i * 7 + col.key.length * 11) % 40)}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center">
                  <p className="text-body-md text-gray-400">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr key={keyExtractor(row)} className="text-gray-700 transition-colors hover:bg-skyblue-50/40">
                  {columns.map(col => (
                    <td key={col.key} className="px-5 py-3.5 whitespace-nowrap">
                      {col.render
                        ? col.render(row, (page - 1) * pageSize + i)
                        : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-hairline bg-surface">
          <span className="text-caption text-gray-500">
            Page <span className="font-semibold text-ink">{page}</span> of {totalPages}
            {total ? ` · ${total} total` : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="grid place-items-center w-9 h-9 rounded-xl border border-border text-gray-500 hover:border-navy/20 hover:text-ink hover:bg-navy-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="grid place-items-center w-9 h-9 rounded-xl border border-border text-gray-500 hover:border-navy/20 hover:text-ink hover:bg-navy-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
