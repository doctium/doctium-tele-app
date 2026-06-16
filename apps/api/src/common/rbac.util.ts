/**
 * A "Super Admin" principal gets ALL permissions — including any added later —
 * whether via the Employee.isSuperAdmin boolean OR by being assigned the
 * "Super Admin" role. Treating the role name as god-mode (case-insensitive)
 * means assigning that role in the admin panel grants full access without also
 * having to flip the boolean. The seeded "Super Admin" role intentionally keeps
 * an empty permissions[] because this check overrides it.
 */
export function isSuperAdminRole(roleName?: string | null): boolean {
  return (roleName ?? "").trim().toLowerCase() === "super admin";
}
