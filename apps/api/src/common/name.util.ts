/**
 * Resolve canonical name fields from whatever a client provides.
 *
 * New app/admin builds send `firstName` + `lastName`; older installed builds (and
 * some legacy callers) still send a single `name`. We keep a denormalized `name`
 * column in sync — it remains the display source for 17+ consumers (prescriptions,
 * notifications, admin tables, EMR…) — while firstName/lastName become the
 * structured source of truth captured at signup.
 *
 * - firstName/lastName given  -> use them; name = "First Last".
 * - only name given (legacy)  -> split on the first space into first/last.
 */
export function resolveName(input: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): { name: string; firstName: string; lastName: string } {
  const first = (input.firstName ?? "").trim();
  const last = (input.lastName ?? "").trim();
  if (first || last) {
    return {
      firstName: first,
      lastName: last,
      name: `${first} ${last}`.trim(),
    };
  }
  const full = (input.name ?? "").trim();
  if (!full) return { firstName: "", lastName: "", name: "" };
  const sp = full.indexOf(" ");
  if (sp === -1) return { firstName: full, lastName: "", name: full };
  return {
    firstName: full.slice(0, sp).trim(),
    lastName: full.slice(sp + 1).trim(),
    name: full,
  };
}
