/**
 * Normalize a Nigerian phone number to E.164 digits WITHOUT the leading "+"
 * (e.g. "0801 234 5678" -> "2348012345678").
 *
 * SMS gateways like Termii reject the local "0801..." format — they require the
 * country code. We only normalize at the SMS-send boundary (not for stored
 * identity/login lookups), so a user who signs up as "0801..." keeps that as
 * their identifier while the SMS still reaches them.
 *
 * Idempotent for numbers already in 234.../+234... form. Non-Nigerian
 * international numbers are returned digits-only and otherwise untouched.
 */
export function toE164Nigeria(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw)
    .trim()
    .replace(/[^\d+]/g, ""); // strip spaces, dashes, parentheses
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("234")) return s; // already has the NG country code
  if (s.startsWith("0")) return "234" + s.slice(1); // local 0801... -> 234801...
  if (s.length === 10) return "234" + s; // 8012345678 -> 2348012345678
  return s; // unknown / already international — leave as-is
}
