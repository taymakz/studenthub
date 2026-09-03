import type { User } from "@workspace/db/schema"
import { universityProfiles, users } from "@workspace/db/schema"
import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

import { getCookie } from "hono/cookie"

import {
  extractTmaHeader,
  validateTelegramInitData,
} from "@/lib/auth/init-data"
import { verifySessionToken } from "@/lib/auth/jwt"
import { db } from "@/lib/db"
import { unauthorized } from "@/lib/http/common"
import { eq } from "drizzle-orm"

export interface AppEnv {
  Variables: {
    /** Verified mini-app user (null otherwise). */
    user: User | null
    /** Chat id of the verified admin (null otherwise). */
    adminChatId: number | null
    /** Fresh-from-DB role of the admin. */
    adminRole: "ADMIN" | "SUPERADMIN" | "NOTIFICATIONER" | null
  }
}

function bearerToken(c: Context): string | null {
  const header = c.req.header("authorization") ?? c.req.header("Authorization")
  if (!header) return null
  const [scheme, value] = header.split(" ")
  if (scheme?.toLowerCase() !== "bearer" || !value) return null
  return value.trim()
}

function adminTokenFromRequest(c: Context): string | null {
  const bearer = bearerToken(c)
  if (bearer) return bearer
  // Fallback: session cookie (dashboard origin sets `session` via /api/auth/session)
  try {
    const cookie =
      getCookie(c, "session") ?? getCookie(c, "sh_admin_session") ?? null
    if (cookie) return cookie.trim() || null
  } catch {
    // ignore cookie parse errors
  }
  return null
}

function tmaFromRequest(c: Context): string | null {
  // Enterprise: header-only — no cookie fallback to prevent CSRF/session fixation
  return extractTmaHeader(c.req.header("authorization"))
}

// Removed appTokenFromRequest cookie fallback — web auth is Bearer only (enterprise header-only)

/**
 * Resolves the current mini-app user. STATELESS: every request carries fresh
 * `Authorization: tma <initData>` - there is no app session/cookie. Valid
 * initData auto-upserts the user (first request IS login); banned users are
 * rejected.
 *
 * On every mount the mini-app calls GET /me first — that request hits this
 * middleware and refreshes Telegram-sourced fields (name, username, avatar,
 * premium, etc.) so the DB never goes stale. New signups additionally emit a
 * JOINS notification (see `lib/telegram/admin.ts`); profile completion is
 * handled in the `/me/profile` route where the full academic context is known.
 */
export const withUser = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", null)

  // 1) Mini-app: stateless tma <initData> (preferred, works inside Telegram)
  const initData = tmaFromRequest(c)
  if (initData) {
    const validated = validateTelegramInitData(initData)
    if (validated) {
      const tg = validated.user

      // Atomic "is new" detection: only the request that actually inserts
      // the row counts as a signup, so the JOINS notification below fires
      // exactly once per user. The old check-then-insert raced under
      // concurrent first-hits (double message, single user row).
      const [inserted] = await db
        .insert(users)
        .values({
          id: tg.id,
          firstName: tg.firstName,
          lastName: tg.lastName ?? null,
          telegramUsername: tg.username ?? null,
          languageCode: tg.languageCode ?? null,
          photoUrl: tg.photoUrl ?? null,
          isPremium: tg.isPremium ?? false,
          allowsWriteToPm: tg.allowsWriteToPm ?? false,
        })
        .onConflictDoNothing()
        .returning()
      const isNewUser = !!inserted

      const [row] = inserted
        ? [inserted]
        : await db
            .update(users)
            .set({
              firstName: tg.firstName,
              lastName: tg.lastName ?? null,
              telegramUsername: tg.username ?? null,
              languageCode: tg.languageCode ?? null,
              ...(tg.photoUrl ? { photoUrl: tg.photoUrl } : {}),
              isPremium: tg.isPremium ?? false,
              allowsWriteToPm: tg.allowsWriteToPm ?? false,
              updatedAt: new Date(),
            })
            .where(eq(users.id, tg.id))
            .returning()

      await db
        .insert(universityProfiles)
        .values({ userId: tg.id })
        .onConflictDoNothing()

      if (row) c.set("user", row)

      if (isNewUser && row && !row.banned) {
        void (async () => {
          try {
            const { sendAdminMessage, buildJoinMessage } =
              await import("@/lib/telegram/admin.ts")
            const text = buildJoinMessage({
              id: row.id as number,
              firstName: row.firstName,
              lastName: row.lastName,
              telegramUsername: row.telegramUsername,
            })
            await sendAdminMessage("JOINS", text, {
              parseMode: "HTML",
              buttons: [
                [
                  {
                    text: "👤 مشاهده پروفایل",
                    url: `https://admin.student-hub.ir/users/${row.id}`,
                  },
                ],
              ],
            })
          } catch {}
        })()
      }

      if (row && !row.banned) {
        void db
          .update(users)
          .set({ lastOnlineAt: new Date() })
          .where(eq(users.id, tg.id))
          .catch(() => {})
      }

      await next()
      return
    }
  }

  // 2) Web: HttpOnly cookie (primary, XSS-safe) + Bearer fallback for migration
  try {
    const cookie = getCookie(c, "sh_web_token")
    if (cookie) {
      const payload = await verifySessionToken(cookie.trim(), "app")
      if (payload) {
        const chatId = Number(payload.sub)
        const [row] = await db.select().from(users).where(eq(users.id, chatId)).limit(1)
        if (row) {
          c.set("user", row)
          if (!row.banned) void db.update(users).set({ lastOnlineAt: new Date() }).where(eq(users.id, chatId)).catch(() => {})
          await next()
          return
        }
      }
    }
  } catch {}
  const rawHeader = c.req.header("authorization") ?? c.req.header("Authorization")
  if (rawHeader?.toLowerCase().startsWith("bearer ")) {
    const bearer = bearerToken(c)
    if (bearer) {
      const payload = await verifySessionToken(bearer, "app")
      if (payload) {
        const chatId = Number(payload.sub)
        const [row] = await db.select().from(users).where(eq(users.id, chatId)).limit(1)
        if (row) {
          c.set("user", row)
          if (!row.banned) void db.update(users).set({ lastOnlineAt: new Date() }).where(eq(users.id, chatId)).catch(() => {})
        }
      }
    }
  }

  await next()
})

/** Requires a valid mini-app user. Banned users get 403 with banned payload for /banned page. */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user")
  if (!user) return unauthorized(c)
  if (user.banned) {
    return c.json(
      {
        success: false,
        message: "حساب شما مسدود شده است",
        data: { banned: true, bannedReason: user.bannedReason ?? null },
      },
      403
    )
  }
  await next()
})

/**
 * Resolves the admin session JWT and RE-CHECKS role in the database - the JWT
 * is trusted for identity only, never for authorization.
 */
export const withAdmin = createMiddleware<AppEnv>(async (c, next) => {
  c.set("adminChatId", null)
  c.set("adminRole", null)

  const token = adminTokenFromRequest(c)
  if (token) {
    const payload = await verifySessionToken(token, "admin")
    if (payload) {
      const chatId = Number(payload.sub)
      const [admin] = await db
        .select({ id: users.id, role: users.role, banned: users.banned })
        .from(users)
        .where(eq(users.id, chatId))
        .limit(1)

      if (
        admin &&
        !admin.banned &&
        (admin.role === "ADMIN" ||
          admin.role === "SUPERADMIN" ||
          admin.role === "NOTIFICATIONER")
      ) {
        c.set("adminChatId", chatId)
        c.set("adminRole", admin.role)
      }
    }
  }

  await next()
})

/** Requires an authenticated + still-valid admin. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("adminChatId")) return unauthorized(c)
  await next()
})
