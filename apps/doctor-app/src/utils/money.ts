/**
 * Central money formatter — the SINGLE display point for every ₦ amount in this app.
 *
 * ⚠️ KOBO MIGRATION: money is currently stored as major-unit naira (Float). When the
 * backend flips to integer minor units (kobo), set MONEY_IN_MINOR_UNITS = true below —
 * that is the ONLY change this file needs, because every money render routes through
 * formatMoney(). Never re-introduce ad-hoc `₦${x.toLocaleString()}` anywhere.
 */
const MONEY_IN_MINOR_UNITS = true;

const SYMBOL: Record<string, string> = {
  NGN: "₦",
  USD: "$",
  GBP: "£",
  EUR: "€",
  GHS: "₵",
  KES: "KSh",
  ZAR: "R",
};

/** Format a stored money value for display, with thousands grouping and the currency symbol. */
export function formatMoney(
  amount: number | null | undefined,
  currency = "NGN",
): string {
  const sym = SYMBOL[(currency || "NGN").toUpperCase()] ?? "₦";
  const major = MONEY_IN_MINOR_UNITS ? (amount ?? 0) / 100 : (amount ?? 0);
  return `${sym}${major.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

/** Convert a user-entered major-unit amount to the stored representation (forms → API). */
export function toStoredAmount(majorUnits: number): number {
  return MONEY_IN_MINOR_UNITS ? Math.round(majorUnits * 100) : majorUnits;
}

/** Convert a stored money value back to major units (e.g. to prefill a form input). */
export function toMajorUnits(stored: number): number {
  return MONEY_IN_MINOR_UNITS ? stored / 100 : stored;
}
