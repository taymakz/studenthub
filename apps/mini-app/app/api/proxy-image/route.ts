import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { isTelegramUrl } from "@/lib/image-proxy"

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECT_HOPS = 3

/** Fetch the image with redirects disabled, re-validating every hop's
    Location against the Telegram host allowlist. Never auto-follows: a
    302 to an internal/cloud-metadata address would otherwise be fetched
    server-side (SSRF) even though the original URL was allowlisted. */
async function fetchAllowedImage(url: string): Promise<Response | null> {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (!isTelegramUrl(current)) return null
    const response = await fetch(current, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Referer: "https://web.telegram.org/",
      },
      cache: "no-store",
      redirect: "manual",
    })
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location")
      if (!location) return null
      current = new URL(location, current).toString()
      continue
    }
    return response
  }
  return null
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { error: "URL parameter is required" },
      { status: 400 }
    )
  }
  if (!isTelegramUrl(url)) {
    return NextResponse.json(
      { error: "Only Telegram image URLs are allowed" },
      { status: 403 }
    )
  }

  try {
    const response = await fetchAllowedImage(url)
    if (!response) {
      return NextResponse.json(
        { error: "Only Telegram image URLs are allowed" },
        { status: 403 }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.statusText}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get("content-type") || "image/jpeg"
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "URL does not point to an image" },
        { status: 400 }
      )
    }

    const imageBuffer = await response.arrayBuffer()
    const etag = createHash("md5")
      .update(Buffer.from(imageBuffer))
      .digest("base64")
      .slice(0, 16)

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        ETag: etag,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    })
  } catch (error) {
    console.error("Proxy image error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: `Failed to proxy image: ${message}` },
      { status: 500 }
    )
  }
}
