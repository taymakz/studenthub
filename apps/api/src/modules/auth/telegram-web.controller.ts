import { zValidator } from "@hono/zod-validator"
import { deleteCookie, setCookie } from "hono/cookie"
import { universityProfiles, users } from "@workspace/db/schema"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { config } from "@/config"

import { db } from "@/lib/db"
import { badRequest, ok, unauthorized } from "@/lib/http/common"
import { signSessionToken } from "@/lib/auth/jwt"
import {
  getTelegramLoginConfig,
  validateTelegramIdToken,
  validateTelegramWidgetData,
} from "@/lib/auth/telegram-widget"
import type { AppEnv } from "@/middleware/auth"

async function upsertUserFromWidget(data: {
  id: number
  firstName: string
  lastName?: string
  username?: string
  photoUrl?: string
}) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, data.id))
    .limit(1)
  const isNewUser = existing.length === 0

  const [row] = await db
    .insert(users)
    .values({
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName ?? null,
      telegramUsername: data.username ?? null,
      photoUrl: data.photoUrl ?? null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        firstName: data.firstName,
        lastName: data.lastName ?? null,
        telegramUsername: data.username ?? null,
        ...(data.photoUrl ? { photoUrl: data.photoUrl } : {}),
        updatedAt: new Date(),
      },
    })
    .returning()

  if (!row || row.banned) return null

  await db
    .insert(universityProfiles)
    .values({ userId: data.id })
    .onConflictDoNothing()

  if (isNewUser) {
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

  void db
    .update(users)
    .set({ lastOnlineAt: new Date() })
    .where(eq(users.id, data.id))
    .catch(() => {})

  return row
}

export const telegramWebAuthRoutes = new Hono<AppEnv>()
  .get("/auth/telegram/config", (c) => {
    const cfg = getTelegramLoginConfig()
    return ok(c, {
      botUsername: cfg.username,
      clientId: cfg.clientId,
      botId: cfg.botId,
    })
  })
  .post(
    "/auth/telegram/widget",
    zValidator(
      "json",
      z
        .object({
          // Legacy widget fields
          id: z.number().or(z.string()).optional(),
          first_name: z.string().optional(),
          firstName: z.string().optional(),
          last_name: z.string().optional(),
          lastName: z.string().optional(),
          username: z.string().optional(),
          photo_url: z.string().optional(),
          photoUrl: z.string().optional(),
          auth_date: z.number().or(z.string()).optional(),
          authDate: z.number().or(z.string()).optional(),
          hash: z.string().optional(),
          // New OIDC
          id_token: z.string().optional(),
          idToken: z.string().optional(),
        })
        .passthrough()
    ),
    async (c) => {
      const body = c.req.valid("json") as Record<string, unknown>

      // Prefer id_token (new OIDC flow) if present
      const idToken = (body.id_token ?? body.idToken) as string | undefined
      let widgetUser: {
        id: number
        firstName: string
        lastName?: string
        username?: string
        photoUrl?: string
      } | null = null

      if (idToken) {
        const v = await validateTelegramIdToken(idToken)
        if (!v) return unauthorized(c, "توکن تلگرام نامعتبر است")
        widgetUser = v
      } else {
        const v = validateTelegramWidgetData(
          body as Record<string, string | number | undefined>
        )
        if (!v) return unauthorized(c, "احراز هویت تلگرام ناموفق بود")
        widgetUser = v
      }

      const row = await upsertUserFromWidget(widgetUser)
      if (!row) return unauthorized(c, "حساب شما مسدود شده است")

      const token = await signSessionToken({
        sub: String(row.id),
        role: row.role as "USER" | "ADMIN" | "SUPERADMIN" | "NOTIFICATIONER",
        aud: "app",
      })

      // Enterprise: HttpOnly Secure cookie — XSS cannot steal
      // For cross-origin (api.student-hub.ir → student-hub.ir) use SameSite=None + Domain in prod
      const isProd = config.APP_ENV === "production"
      setCookie(c, "sh_web_token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "None" : "Lax",
        domain: isProd ? ".student-hub.ir" : undefined,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      })
      // Keep token in body for JS fallback during migration; frontend will prefer cookie via credentials:include
      return ok(
        c,
        { token, user: { id: row.id, firstName: row.firstName } },
        "ورود موفق"
      )
    }
  )
  .post("/auth/telegram/logout", (c) => {
    const isProd = config.APP_ENV === "production"
    deleteCookie(c, "sh_web_token", {
      path: "/",
      domain: isProd ? ".student-hub.ir" : undefined,
      secure: isProd,
      sameSite: isProd ? "None" : "Lax",
    })
    return ok(c, null, "خارج شدید")
  })
  .post(
    "/auth/telegram/verify",
    zValidator("json", z.object({ id_token: z.string().min(1) })),
    async (c) => {
      const { id_token } = c.req.valid("json")
      const v = await validateTelegramIdToken(id_token)
      if (!v) return badRequest(c, "توکن نامعتبر")
      return ok(c, { valid: true, user: v })
    }
  )
