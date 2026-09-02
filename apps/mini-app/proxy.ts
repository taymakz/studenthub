import { NextResponse, type NextRequest } from "next/server"

/**
 * Top-layout hard redirect — every full page load lands on "/".
 * Runs before any render (replaces the old TopRedirect client component),
 * so a hard load of /profile, /maintenance, … is bounced to "/" at the HTTP
 * level and AppBootstrap re-gates from a clean slate. Client-side router
 * navigations (RSC/prefetch fetches) and asset requests pass through.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (pathname === "/") return NextResponse.next()

  const isDocumentRequest =
    request.headers.get("sec-fetch-mode") === "navigate" ||
    (request.headers.get("accept") ?? "").includes("text/html")
  const isClientNavigation =
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  if (!isDocumentRequest || isClientNavigation) return NextResponse.next()

  return NextResponse.redirect(new URL(`/${search}`, request.url))
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
}
