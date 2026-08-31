/**
 * Admin sessions are bearer-token based: the dashboard stores its own
 * httpOnly cookie on ITS origin (apps/admin /api/auth/session route) and
 * sends Authorization headers to this API. The API itself sets no session
 * cookie - that previously produced duplicate cookies across subdomains.
 *
 * Legacy cleanup helper: expires the old sh_admin_session cookie that older
 * builds planted on the API origin.
 */
import type { Context } from "hono"
import { deleteCookie } from "hono/cookie"

export function expireLegacySessionCookies(c: Context): void {
  // Called before sending responses on login/logout paths.
  deleteCookie(c, "sh_admin_session", { path: "/" })
}
