import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { isTelegramUrl } from "@/lib/image-proxy"

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
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Referer: "https://web.telegram.org/",
      },
      cache: "no-store",
    })

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
