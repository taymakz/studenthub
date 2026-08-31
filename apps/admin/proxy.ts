import { NextResponse, type NextRequest } from "next/server"

/**
 * Route-level auth gate (Next.js 16 proxy convention).
 *
 * Cookie PRESENCE only - the session JWT is identity, never authorization;
 * every API request re-validates role/permissions server-side. The proxy's
 * job is purely UX: no session candidate -> straight to /auth with zero
 * bootstrap flash; a valid-but-revoked cookie still passes here and gets
 * bounced by the client gate once /admin/me answers 401.
 *
 * Exemptions:
 *   - /auth itself (otherwise it would redirect to itself forever)
 *   - /api/* (the internal session broker - its cookie-setting POST arrives
 *     before any cookie exists)
 */

const SESSION_COOKIE = "session"
const AUTH_PATH = "/auth"

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE))
  const { pathname } = request.nextUrl

  // Already signed in - skip the login flow entirely.
  if (pathname === AUTH_PATH && hasSession) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // No session candidate - pages outside /auth require one.
  if (!hasSession && pathname !== AUTH_PATH && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL(AUTH_PATH, request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)",
  ],
}
