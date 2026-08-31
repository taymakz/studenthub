import { randomUUID } from "node:crypto"

import { SignJWT, jwtVerify } from "jose"

import { config } from "@/config"

const secret = new TextEncoder().encode(config.SECRET_KEY)

/**
 * Audiences. Only "admin" mints sessions now - mini-app requests are
 * stateless (tma initData on every call); the value stays for token-shape
 * stability.
 */
export type SessionAudience = "admin" | "app"

export interface SessionPayload {
  sub: string // telegram chat id
  role: "USER" | "ADMIN" | "SUPERADMIN" | "NOTIFICATIONER"
  aud: SessionAudience
}

export async function signSessionToken(
  payload: SessionPayload
): Promise<string> {
  const ttlDays = payload.aud === "admin" ? config.ADMIN_SESSION_TTL_DAYS : 30

  // jti enables token rotation / revocation tracking without shortening TTL.
  // Each session gets a unique id; future rotation can blacklist by jti.
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setAudience(payload.aud)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${ttlDays}d`)
    .sign(secret)
}

export async function verifySessionToken(
  token: string,
  audience: SessionAudience
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { audience })
    const chatId = Number(payload.sub)
    const role = payload.role
    if (
      !Number.isSafeInteger(chatId) ||
      (role !== "USER" &&
        role !== "ADMIN" &&
        role !== "SUPERADMIN" &&
        role !== "NOTIFICATIONER")
    ) {
      return null
    }
    return { sub: String(chatId), role, aud: audience }
  } catch {
    return null
  }
}
