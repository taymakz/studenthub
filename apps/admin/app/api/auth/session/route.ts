import { NextResponse } from "next/server"

/**
 * Session broker on the ADMIN origin. The API returns the session JWT in the
 * verify response body; the browser posts it here so the dashboard domain
 * owns its own httpOnly cookie (the API-side cookie lives on the API host,
 * invisible to these SSR routes).
 *
 *   POST   { token }  -> set cookie
 *   DELETE           -> clear cookie
 */

const COOKIE_NAME = "session"
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function POST(request: Request) {
  let token: unknown
  try {
    const body = (await request.json()) as { token?: string }
    token = body.token
  } catch {
    // fallthrough
  }
  if (typeof token !== "string" || token.length < 20) {
    return NextResponse.json(
      { success: false, message: "توکن نامعتبر است" },
      { status: 400 }
    )
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
