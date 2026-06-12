"use client";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";

export interface Person {
  id: string;
  name: string;
  email?: string;
  mobile?: string;
  image?: string;
}

interface Props {
  recipientType: "USER" | "DOCTOR";
  onRecipientTypeChange: (t: "USER" | "DOCTOR") => void;
  selected: Person[];
  onSelectedChange: (s: Person[]) => void;
  /** "email" hides phone-only people, "sms" hides email-only — optional hint for the subtitle. */
  channel?: "email" | "sms";
}

export function RecipientPicker({
  recipientType,
  onRecipientTypeChange,
  selected,
  onSelectedChange,
  channel,
}: Props) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      (
        apiClient.get("/admin/comms/recipients", {
          params: { type: recipientType, search: search || undefined },
        }) as Promise<{ data: Person[] }>
      )
        .then((r) => setResults(r.data ?? []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [search, recipientType]);

  const add = (p: Person) => {
    if (!selected.some((s) => s.id === p.id))
      onSelectedChange([...selected, p]);
    setSearch("");
    setOpen(false);
  };
  const remove = (id: string) =>
    onSelectedChange(selected.filter((s) => s.id !== id));

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["USER", "DOCTOR"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              onRecipientTypeChange(t);
              onSelectedChange([]);
            }}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${recipientType === t ? "bg-surface text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            {t === "USER" ? "Patients" : "Doctors"}
          </button>
        ))}
      </div>

      <div className="relative">
        <div className="flex items-center gap-2 h-10 rounded-xl border border-border px-3 focus-within:border-teal-400">
          <Search size={15} className="text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={`Search ${recipientType === "USER" ? "patients" : "doctors"} by name, ${channel === "sms" ? "phone" : "email"}…`}
            className="flex-1 text-sm outline-none bg-transparent"
          />
        </div>
        {open && results.length > 0 ? (
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl bg-surface border border-border shadow-floating">
            {results.map((p) => (
              <button
                key={p.id}
                onClick={() => add(p)}
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2"
              >
                <Avatar src={p.image} name={p.name} size={30} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {p.email || p.mobile}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 bg-skyblue-50 text-ink text-xs font-medium rounded-full pl-3 pr-1.5 py-1"
            >
              {s.name}
              <button
                onClick={() => remove(s.id)}
                className="grid place-items-center w-4 h-4 rounded-full bg-navy/10 hover:bg-navy/20"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400">No recipients selected yet.</p>
      )}
    </div>
  );
}
