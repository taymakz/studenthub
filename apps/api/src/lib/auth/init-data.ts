import { createHmac, timingSafeEqual } from "node:crypto"

import { config } from "@/config"

/**
 * Validates Telegram Mini App `initData` exactly per the official algorithm:
 *
 *   secret_key = HMAC_SHA256(bot_token, key="WebAppData")
 *   hash       = hex(HMAC_SHA256(data_check_string, key=secret_key))
 *
 * data_check_string = every field except `hash`, sorted by key, joined with
 * "\n". Note: `signature` is NOT excluded for HMAC validation (only for
 * third-party Ed25519 validation). A signature older than 24h is rejected
 * (replay protection).
 */
export interface InitDataUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  languageCode?: string
  photoUrl?: string
  isPremium?: boolean
  allowsWriteToPm?: boolean
}

interface ValidatedInitData {
  user: InitDataUser
  authDate: number
}

export function validateTelegramInitData(
  initData: string
): ValidatedInitData | null {
  if (!initData || !config.TELEGRAM_BOT_TOKEN) return null

  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  params.delete("hash")
  // Do NOT delete `signature` — Telegram's HMAC validation includes it
  // in the data-check-string. Only third-party Ed25519 validation excludes it.
  if (!hash) return null

  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData")
    .update(config.TELEGRAM_BOT_TOKEN)
    .digest()

  const computed = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex")

  // Enterprise: constant-time comparison prevents timing oracle
  try {
    const a = Buffer.from(computed, "hex")
    const b = Buffer.from(hash, "hex")
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  // Replay guard: initData carries auth_date (unix seconds). Reject stale
  // (>24h old) signatures and ones from the future (>5min clock skew) —
  // a far-future auth_date would otherwise pass the age check forever.
  const authDate = Number.parseInt(params.get("auth_date") ?? "0", 10)
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate
  if (!Number.isFinite(authDate) || authDate <= 0 || ageSeconds > 86_400) {
    return null
  }
  if (ageSeconds < -300) return null

  let rawUser: Record<string, unknown>
  try {
    rawUser = JSON.parse(params.get("user") ?? "{}") as Record<string, unknown>
  } catch {
    return null
  }
  const id = Number(rawUser.id)
  if (!Number.isSafeInteger(id) || id <= 0) return null

  return {
    user: {
      id,
      firstName: String(rawUser.first_name ?? ""),
      lastName: rawUser.last_name ? String(rawUser.last_name) : undefined,
      username: rawUser.username ? String(rawUser.username) : undefined,
      languageCode: rawUser.language_code
        ? String(rawUser.language_code)
        : undefined,
      photoUrl: rawUser.photo_url ? String(rawUser.photo_url) : undefined,
      isPremium: Boolean(rawUser.is_premium),
      allowsWriteToPm: Boolean(rawUser.allows_write_to_pm),
    },
    authDate,
  }
}

/** Bearer-style scheme used by the mini app: `Authorization: tma <initData>`. */
export function extractTmaHeader(header: string | undefined): string | null {
  if (!header) return null
  const [scheme, ...rest] = header.split(" ")
  if (scheme?.toLowerCase() !== "tma") return null
  const value = rest.join(" ").trim()
  return value || null
}
