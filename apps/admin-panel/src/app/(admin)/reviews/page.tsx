"use client";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { DataTable, Column } from "@/components/ui/DataTable";
import { Avatar } from "@/components/ui/Avatar";
import { StarRating } from "@/components/ui/StarRating";
import { PatientLink } from "@/components/ui/PatientLink";
import { SearchInput } from "@/components/ui/SearchInput";
import { apiClient } from "@/lib/api";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import type { Review } from "@/types";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const load = () => {
    apiClient
      .get("/admin/reviews", { params: { page, limit: PAGE_SIZE } })
      .then((r: unknown) => setReviews((r as { data: Review[] }).data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [page]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    await apiClient.delete(`/admin/reviews/${id}`);
    toast.success("Review deleted");
    load();
  };

  const filtered = search
    ? reviews.filter(
        (r) =>
          r.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.doctor?.name?.toLowerCase().includes(search.toLowerCase()),
      )
    : reviews;

  const cols: Column<Review>[] = [
    {
      key: "no",
      header: "#",
      width: "48px",
      render: (_, i) => <span className="text-gray-400 text-sm">{i + 1}</span>,
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.doctor?.image} name={r.doctor?.name} size={32} />
          <span className="font-medium">{r.doctor?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "user",
      header: "Patient",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Avatar src={r.user?.image} name={r.user?.name} size={32} />
          <PatientLink id={r.userId} name={r.user?.name} className="text-sm" />
        </div>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      render: (r) => <StarRating rating={r.rating} />,
    },
    {
      key: "review",
      header: "Review",
      render: (r) => (
        <p className="text-sm text-gray-600 max-w-xs truncate" title={r.review}>
          {r.review}
        </p>
      ),
    },
    {
      key: "createdAt",
      header: "Date",
      render: (r) => (
        <span className="text-gray-400 text-sm">
          {format(new Date(r.createdAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button
          onClick={() => handleDelete(r.id)}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="page-title">Reviews</h1>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by doctor or patient..."
        />
      </div>
      <div className="card p-0 overflow-hidden">
        <DataTable
          columns={cols}
          data={filtered}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyMessage="No reviews yet"
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
