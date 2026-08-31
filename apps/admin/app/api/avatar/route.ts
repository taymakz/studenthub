import { NextResponse, type NextRequest } from "next/server"

/**
 * Image proxy: streams any remote URL (Telegram photos, etc.) through the
 * admin origin so the browser never hits CORS restrictions or mixed-content
 * blocks.  Used by the users page for avatar thumbnails and full-size opens.
 *
 * GET /api/avatar?url=<encoded>&w=<optional width>
 *
 * Cache: 1 hour browser + CDN (Telegram photos are stable per-file_id).
 */

const MAX_AGE = 3600

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  if (!url) {
    return NextResponse.json({ error: "missing url param" }, { status: 400 })
  }

  // Only allow known-safe origins to prevent open-proxy abuse.
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 })
  }
  const allowed = ["t.me", "telegram.org", "core.telegram.org"]
  if (!allowed.some((h) => parsed.hostname.endsWith(h))) {
    return NextResponse.json({ error: "origin not allowed" }, { status: 403 })
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: { "User-Agent": "StudentHub-Admin/1.0" },
      next: { revalidate: MAX_AGE },
    })
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}` },
        { status: upstream.status }
      )
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg"
    const body = upstream.body
    if (!body) {
      return NextResponse.json({ error: "empty body" }, { status: 502 })
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${MAX_AGE}, stale-while-revalidate=${MAX_AGE * 6}`,
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 })
  }
}
