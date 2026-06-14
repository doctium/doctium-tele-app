/**
 * Admin session cookie. The admin panel authenticates via this httpOnly cookie
 * (not localStorage) so an XSS payload can't read or exfiltrate the JWT. Mobile
 * apps continue to use the Authorization: Bearer header — both are accepted.
 */
export const ADMIN_COOKIE = "doctium_admin_token";

/**
 * CSRF double-submit token. Set as a JS-READABLE cookie at admin login; the admin
 * client echoes it in the X-CSRF-Token header on mutating requests, and the server
 * checks header === cookie. Defense-in-depth on top of the SameSite session cookie.
 */
export const CSRF_COOKIE = "doctium_csrf";
export const CSRF_HEADER = "x-csrf-token";

/** Minimal cookie-header parser (avoids pulling in cookie-parser middleware). */
export function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

// In production the admin (dashboard.doctiumhealth.com) and API (api.doctiumhealth.com)
// are different sub-domains, so the cookies must be scoped to the parent domain to be
// shared. Set COOKIE_DOMAIN=".doctiumhealth.com" in prod. Unset in local dev → host-only
// cookies (which on localhost are already shared across ports).
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;

/** Cookie attributes for the admin session. SameSite=Lax + CORS block CSRF; Secure in prod. */
export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d — matches the access-token lifetime
  };
}

/** CSRF cookie — deliberately NOT httpOnly so the admin client can read + echo it. */
export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    domain: COOKIE_DOMAIN,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

/** Options for clearing the cookies — must match domain + path used when setting. */
export function cookieClearOptions() {
  return { path: "/", domain: COOKIE_DOMAIN };
}
