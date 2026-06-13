import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import {
  ADMIN_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  parseCookies,
} from "./cookie.util";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF protection for cookie-authenticated (admin browser) requests only.
 *
 * Double-submit: the admin holds a JS-readable CSRF cookie and must echo it in
 * the X-CSRF-Token header on state-changing requests. A cross-site attacker can
 * neither read the cookie (same-origin policy) nor set the header (cross-site
 * fetch), so the check fails for forged requests.
 *
 * Requests WITHOUT the admin session cookie (mobile Bearer, server-to-server
 * webhooks, the first login) carry no ambient credentials and are exempt.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method.toUpperCase())) return true;

    const cookies = parseCookies(req.headers.cookie);
    // No session cookie → no CSRF risk (Bearer/webhook/first-login). Allow.
    if (!cookies[ADMIN_COOKIE]) return true;

    const expected = cookies[CSRF_COOKIE];
    const sent = req.headers[CSRF_HEADER];
    if (!expected || !sent || sent !== expected) {
      throw new ForbiddenException("Invalid or missing CSRF token");
    }
    return true;
  }
}
