import { createHash, createHmac } from "node:crypto"

import { createRemoteJWKSet, jwtVerify } from "jose"

import { config } from "@/config"

export interface WidgetUser {
  id: number
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
  authDate: number
}

function getBotId(): number | null {
  const raw = config.TELEGRAM_BOT_TOKEN.split(":")[0]
  const n = Number(raw ?? "")
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * Validates legacy Telegram Login Widget data (https://core.telegram.org/widgets/login#checking-authorization)
 *   secret = SHA256(bot_token)
 *   hash = hex(HMAC-SHA256(data_check_string, secret))
 *   data_check_string = sorted "key=value" lines (excluding hash)
 */
export function validateTelegramWidgetData(
  data: Record<string, string | number | undefined>
): WidgetUser | null {
  if (!config.TELEGRAM_BOT_TOKEN) return null
  const hash = String(data.hash ?? "")
  if (!hash) return null

  const entries = Object.entries(data)
    .filter(([k, v]) => k !== "hash" && v !== undefined && v !== "")
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => a.localeCompare(b))

  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join("\n")

  const secret = createHash("sha256").update(config.TELEGRAM_BOT_TOKEN).digest()
  const computed = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex")

  // constant-time compare
  if (computed.length !== hash.length) return null
  let diff = 0
  for (let i = 0; i < computed.length; i++)
    diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i)
  if (diff !== 0) return null

  const authDate = Number(data.auth_date ?? data.authDate ?? 0)
  const age = Math.floor(Date.now() / 1000) - authDate
  if (!Number.isFinite(authDate) || authDate <= 0 || age > 86_400) return null

  const id = Number(data.id)
  if (!Number.isSafeInteger(id) || id <= 0) return null

  return {
    id,
    firstName: String(data.first_name ?? data.firstName ?? ""),
    lastName: data.last_name
      ? String(data.last_name)
      : data.lastName
        ? String(data.lastName)
        : undefined,
    username: data.username ? String(data.username) : undefined,
    photoUrl: data.photo_url
      ? String(data.photo_url)
      : data.photoUrl
        ? String(data.photoUrl as string)
        : undefined,
    authDate,
  }
}

// ─── OIDC id_token (RS256/ES256 via https://oauth.telegram.org/.well-known/jwks.json) ───

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL("https://oauth.telegram.org/.well-known/jwks.json")
    )
  }
  return jwks
}

export async function validateTelegramIdToken(
  idToken: string
): Promise<WidgetUser | null> {
  const botId = getBotId()
  if (!botId || !idToken) return null
  try {
    const { payload } = await jwtVerify(idToken, getJwks(), {
      issuer: "https://oauth.telegram.org",
      audience: String(botId),
    })
    const id = Number((payload as Record<string, unknown>).id ?? payload.sub)
    if (!Number.isSafeInteger(id) || id <= 0) return null
    const authDate = Number(payload.iat ?? 0)
    // jose already checks exp; add 24h replay guard on iat like widget
    const age = Math.floor(Date.now() / 1000) - authDate
    if (Number.isFinite(authDate) && authDate > 0 && age > 86_400) return null

    const raw = payload as Record<string, unknown>
    return {
      id,
      firstName: String(
        raw.given_name ?? raw.name?.toString().split(" ")[0] ?? ""
      ),
      lastName: raw.family_name ? String(raw.family_name) : undefined,
      username: raw.preferred_username
        ? String(raw.preferred_username)
        : undefined,
      photoUrl: raw.picture ? String(raw.picture) : undefined,
      authDate: Number.isFinite(authDate)
        ? authDate
        : Math.floor(Date.now() / 1000),
    }
  } catch {
    return null
  }
}

export function getTelegramLoginConfig() {
  const botId = getBotId()
  const username = config.TELEGRAM_BOT_USERNAME || ""
  return { botId, username, clientId: botId ? String(botId) : "" }
}
