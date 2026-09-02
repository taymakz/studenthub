import { buildApiUrl } from "@/lib/request"

// Enterprise: HttpOnly cookie only (XSS-safe) — sh_web_token is never readable via JS
export function getWebToken(): string | null {
  return null
}

export function setWebToken(_token: string) {
  // No-op: cookie is set via Set-Cookie header by the server (HttpOnly)
}

export function clearWebToken() {
  try {
    void fetch(buildApiUrl("/auth/telegram/logout"), { method: "POST", credentials: "include", cache: "no-store" })
  } catch {}
}

/** True if we are running outside Telegram and need web auth. */
export function isWebMode(): boolean {
  if (typeof window === "undefined") return false
  return !window.Telegram?.WebApp?.initData
}

export async function loginWithWidget(
  payload: Record<string, unknown>
): Promise<string> {
  const res = await fetch(buildApiUrl("/auth/telegram/widget"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "include",
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(err?.message ?? "احراز هویت ناموفق بود")
  }
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    data?: { token?: string }
  } | null
  if (!json?.success || !json?.data?.token) {
    throw new Error("احراز هویت ناموفق بود")
  }
  const token = json.data.token
  setWebToken(token)
  return token
}

export async function fetchTelegramConfig(): Promise<{
  botUsername: string
  clientId: string
}> {
  const res = await fetch(buildApiUrl("/auth/telegram/config"), {
    cache: "no-store",
    credentials: "include",
  })
  if (!res.ok) return { botUsername: "", clientId: "" }
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    data?: { botUsername?: string; clientId?: string }
  } | null
  return {
    botUsername: json?.data?.botUsername ?? "",
    clientId: json?.data?.clientId ?? "",
  }
}
