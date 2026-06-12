"use client";
import { apiClient } from "./api";

/**
 * Admin auth is carried by an httpOnly session cookie set at login (see the API's
 * /auth/admin/login). The browser can't read it, so there's no token getter —
 * "am I logged in?" is answered by the /admin/me call in auth-context.
 */

/** Clear the server session cookie. Best-effort: always proceed to redirect. */
export async function logout(): Promise<void> {
  try {
    await apiClient.post("/auth/admin/logout");
  } catch {
    // ignore — we redirect regardless
  }
}
