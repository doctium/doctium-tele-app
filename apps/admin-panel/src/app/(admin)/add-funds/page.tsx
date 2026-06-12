"use client";
import { useEffect, useRef, useState } from "react";
import { Banknote, Check, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { apiClient } from "@/lib/api";
import { formatMoney, toStoredAmount } from "@/lib/money";
import { toast } from "@/lib/toast";

interface FoundUser {
  id: string;
  name: string;
  mobile: string;
  email: string;
  image: string;
  wallet: { balance: number } | null;
}

export default function AddFundsPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FoundUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoundUser | null>(null);
  const [amount, setAmount] = useState("");
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<{
    name: string;
    credited: number;
    balance: number;
  } | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced patient lookup by name / phone / email
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const needle = q.trim();
    if (needle.length < 2 || selected) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(() => {
      setSearching(true);
      (
        apiClient.get("/admin/users-search", {
          params: { q: needle },
        }) as Promise<{ data: FoundUser[] }>
      )
        .then((r) => setResults(r.data ?? []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
  }, [q, selected]);

  const nairaAmount = parseFloat(amount) || 0;
  const canSubmit = !!selected && nairaAmount > 0 && !adding;

  const addFunds = async () => {
    if (!selected || nairaAmount <= 0) return;
    setAdding(true);
    try {
      const r = (await apiClient.post(
        `/admin/users/${selected.id}/wallet-credit`,
        { amount: toStoredAmount(nairaAmount) },
      )) as { data: { name: string; credited: number; balance: number } };
      setDone(r.data);
      toast.success(
        `${formatMoney(r.data.credited)} added to ${r.data.name}'s wallet`,
      );
      setSelected(null);
      setAmount("");
      setQ("");
    } catch {
      /* error toast comes from the api client */
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="eyebrow">Finance</p>
        <h1 className="page-title mt-1">Add Funds</h1>
        <p className="mt-1 text-body-md text-gray-500">
          Credit a patient&apos;s wallet manually. The patient is notified and
          the credit appears in their wallet history as &quot;Wallet Top-up from
          Doctium Admin&quot;.
        </p>
      </div>

      {done ? (
        <div className="card flex items-center gap-3 border border-teal-500/20 bg-teal-50/50">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-teal text-white">
            <Check size={18} />
          </div>
          <p className="text-body-md text-gray-700">
            <span className="font-bold text-ink">
              {formatMoney(done.credited)}
            </span>{" "}
            added to <span className="font-bold text-ink">{done.name}</span>
            &apos;s wallet — new balance{" "}
            <span className="font-bold text-teal-600">
              {formatMoney(done.balance)}
            </span>
            .
          </p>
        </div>
      ) : null}

      {/* ── Step 1: find the patient ── */}
      <div className="card">
        <label className="label">Patient</label>
        {selected ? (
          <div className="flex items-center gap-3 rounded-2xl border border-teal-500/30 bg-teal-50/40 p-3">
            <Avatar src={selected.image} name={selected.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink">
                {selected.name}
              </p>
              <p className="truncate text-caption text-gray-500">
                {selected.mobile || selected.email} · balance{" "}
                {formatMoney(selected.wallet?.balance ?? 0)}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-full p-1.5 text-gray-400 transition hover:bg-surface hover:text-gray-600"
              aria-label="Change patient"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="input pl-10"
                placeholder="Search by name or phone number…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            {searching ? (
              <p className="mt-3 text-caption text-gray-400">Searching…</p>
            ) : results.length > 0 ? (
              <div className="mt-3 divide-y divide-gray-50 overflow-hidden rounded-2xl border border-gray-100">
                {results.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-skyblue-50/50"
                  >
                    <Avatar src={u.image} name={u.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">
                        {u.name || "—"}
                      </p>
                      <p className="truncate text-caption text-gray-500">
                        {u.mobile || u.email}
                      </p>
                    </div>
                    <span className="text-caption tabular-nums text-gray-500">
                      {formatMoney(u.wallet?.balance ?? 0)}
                    </span>
                  </button>
                ))}
              </div>
            ) : q.trim().length >= 2 ? (
              <p className="mt-3 text-caption text-gray-400">
                No patient matches &quot;{q.trim()}&quot;
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* ── Step 2: amount ── */}
      <div className="card">
        <label className="label">Amount (₦)</label>
        <input
          className="input"
          type="number"
          min={1}
          placeholder="e.g. 5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {nairaAmount > 0 && selected ? (
          <p className="mt-2 text-caption text-gray-500">
            {selected.name} will be credited{" "}
            <span className="font-bold text-ink">
              {formatMoney(toStoredAmount(nairaAmount))}
            </span>{" "}
            → new balance{" "}
            <span className="font-bold text-teal-600">
              {formatMoney(
                (selected.wallet?.balance ?? 0) + toStoredAmount(nairaAmount),
              )}
            </span>
          </p>
        ) : null}
        <button
          onClick={addFunds}
          disabled={!canSubmit}
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2 disabled:opacity-50"
        >
          <Banknote size={16} />
          {adding ? "Adding…" : "Add funds"}
        </button>
      </div>
    </div>
  );
}
