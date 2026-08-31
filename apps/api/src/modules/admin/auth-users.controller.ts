import { createHash, createHmac, randomInt } from "node:crypto"

import { config } from "@/config"
import { zValidator } from "@hono/zod-validator"
import type { User } from "@workspace/db/schema"
import {
  adminLoginCodes,
  notedCourses,
  passedCourses,
  universityProfiles,
  users,
} from "@workspace/db/schema"
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { expireLegacySessionCookies } from "@/lib/auth/cookies"
import { signSessionToken } from "@/lib/auth/jwt"
import { db } from "@/lib/db"
import { readIndexes } from "@/lib/registry"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  parsePagination,
  unauthorized,
} from "@/lib/http/common"
import { requireRole } from "@/lib/rbac"
import {
  notifyPermissionChanged,
  sendMessage,
  sendMessageRaw,
  sendRichMessage,
} from "@/lib/telegram/bot"
import { sendAdminMessage } from "@/lib/telegram/admin"
import type { AppEnv } from "@/middleware/auth"
import { requireAdmin, withAdmin } from "@/middleware/auth"

/**
 * Admin surface (part 1): OTP auth via bot + full user management.
 *
 * Role-based: every route runs `withAdmin -> requireAdmin -> requireRole`.
 * The role is re-read from the DB per request (see withAdmin), so a demoted
 * admin loses access immediately even though the session JWT lives a year.
 */

/** Safe projection - never leak internals to clients. */
export function publicUser(user: User) {
  return {
    id: user.id,
    telegramUsername: user.telegramUsername,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    role: user.role,
    isContributor: user.isContributor,
    banned: user.banned,
    bannedReason: user.bannedReason,
    lastOnlineAt: user.lastOnlineAt,
    createdAt: user.createdAt,
  }
}

/* ─── Auth: chat id + OTP delivered by the bot ─── */

const requestOtpSchema = z.object({ chatId: z.number().int().positive() })
const verifyOtpSchema = requestOtpSchema.extend({ code: z.string().length(6) })

export const otpRequestTimestamps = new Map<number, number[]>() // chatId -> epoch ms (per-isolate best-effort)
export async function isRateLimited(chatId: number): Promise<boolean> {
  const now = Date.now()
  const arr = otpRequestTimestamps.get(chatId) ?? []
  const recent = arr.filter((t) => now - t < 60_000) // 60s window
  if (recent.length >= 3) return true // max 3 per minute (in-memory)
  // Enterprise: DB-backed check survives Vercel isolate restarts (distributed)
  try {
    const oneMinAgo = new Date(now - 60_000)
    const [row] = await db
      .select({ cnt: count() })
      .from(adminLoginCodes)
      .where(
        and(
          eq(adminLoginCodes.chatId, chatId),
          sql`${adminLoginCodes.createdAt} > ${oneMinAgo}`
        )
      )
    if (Number(row?.cnt ?? 0) >= 3) return true
  } catch {
    // fall back to in-memory only
  }
  recent.push(now)
  otpRequestTimestamps.set(chatId, recent)
  return false
}

// Exported for tests to reset state between cases
export function __resetOtpRateLimiter(): void {
  otpRequestTimestamps.clear()
}

function escapeLike(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&")
}

function hashCode(chatId: number, code: string): string {
  // Enterprise: HMAC-SHA256 with SECRET_KEY — salts + prevents rainbow table if DB leaks.
  return createHmac("sha256", config.SECRET_KEY)
    .update(`${chatId}:${code}`)
    .digest("hex")
}

export const adminAuthRoutes = new Hono<AppEnv>()
  .post(
    "/auth/request-otp",
    zValidator("json", requestOtpSchema),
    async (c) => {
      const { chatId } = c.req.valid("json")

      if (await isRateLimited(chatId)) {
        c.header("Retry-After", "60")
        return c.json(
          {
            success: false,
            message: "تعداد درخواست زیاد است؛ یک دقیقه صبر کنید",
          },
          429
        )
      }

      const [admin] = await db
        .select({ id: users.id, role: users.role, banned: users.banned })
        .from(users)
        .where(eq(users.id, chatId))
        .limit(1)

      if (!admin || admin.banned) {
        return unauthorized(c, "مدیری با این شناسه پیدا نشد")
      }
      if (admin.role === "USER") return forbidden(c, "این حساب مدیر نیست")

      // Opportunistic pruning - without Redis this table IS the ephemeral store.
      await db
        .delete(adminLoginCodes)
        .where(sql`${adminLoginCodes.expiresAt} < now()`)

      // Daily cap: max 10 codes per 24h per chatId (DB-backed, survives serverless scale)
      const [dailyRow] = await db
        .select({ total: count() })
        .from(adminLoginCodes)
        .where(
          and(
            eq(adminLoginCodes.chatId, chatId),
            sql`${adminLoginCodes.createdAt} > now() - interval '24 hours'`
          )
        )
      if ((dailyRow?.total ?? 0) >= 10) {
        c.header("Retry-After", "86400")
        return c.json(
          {
            success: false,
            message: "سقف روزانه درخواست کد پر شده؛ فردا تلاش کنید",
          },
          429
        )
      }

      const code = String(randomInt(100000, 1000000))
      await db.insert(adminLoginCodes).values({
        chatId,
        codeHash: hashCode(chatId, code),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      })

      // Copyable code (<code> + HTML), matching the old bot's style.
      const result = await sendMessage(
        chatId,
        `🔑 کد ورود: <code>${code}</code>\n` +
          `فقط برای ورود به پنل مدیریت دانشجویار قابل استفاده است؛ اگر شما درخواست نداده‌اید، این پیام را نادیده بگیرید.`,
        { parseMode: "HTML" }
      )
      if (!result.ok) {
        console.error("[admin/otp] sendMessage failed:", result.error)
        // Don't 500 — the code is already stored in the DB.  Return it
        // in dev/dry mode so the admin can still log in, otherwise tell
        // them to retry.
        if (config.TELEGRAM_DRY || config.IS_DEV) {
          return ok(
            c,
            { sent: false, devCode: code },
            "پیام تلگرام ارسال نشد (dev mode)"
          )
        }
        return internalServerError(
          c,
          `ارسال کد ناموفق بود. لطفاً دوباره تلاش کنید.`
        )
      }
      // Dry dev mode only: lets E2E tests complete the OTP round-trip.
      const devCode =
        config.TELEGRAM_DRY && config.IS_DEV ? { devCode: code } : {}
      return ok(c, { sent: true, ...devCode }, "کد ورود به تلگرام شما ارسال شد")
    }
  )
  .post("/auth/verify-otp", zValidator("json", verifyOtpSchema), async (c) => {
    const { chatId, code } = c.req.valid("json")

    const [row] = await db
      .select()
      .from(adminLoginCodes)
      .where(
        and(
          eq(adminLoginCodes.chatId, chatId),
          isNull(adminLoginCodes.consumedAt)
        )
      )
      .orderBy(desc(adminLoginCodes.createdAt))
      .limit(1)

    if (!row || row.expiresAt < new Date()) {
      return unauthorized(c, "کد منقضی یا نامعتبر است")
    }
    // Lockout: 5 failures within 15 minutes -> 423 for 15m window
    if (
      row.attempts >= 5 &&
      Date.now() - row.createdAt.getTime() < 15 * 60 * 1000
    ) {
      c.header("Retry-After", "900")
      void sendAdminMessage(
        "DEFAULT",
        `🚫 قفل موقت ورود ادمین: <code>${chatId}</code> — ۵ تلاش ناموفق در ۱۵ دقیقه`,
        { parseMode: "HTML" }
      ).catch(() => {})
      return c.json(
        {
          success: false,
          message: "حساب موقتاً قفل شد؛ ۱۵ دقیقه بعد تلاش کنید",
        },
        423
      )
    }
    if (row.attempts >= row.maxAttempts) {
      await db
        .update(adminLoginCodes)
        .set({ consumedAt: new Date() })
        .where(eq(adminLoginCodes.id, row.id))
      void sendAdminMessage(
        "DEFAULT",
        `⚠️ تلاش ورود ادمین: <code>${chatId}</code> — سقف تلاش پر شد`,
        { parseMode: "HTML" }
      ).catch(() => {})
      return unauthorized(c, "تلاش‌های بیش از حد؛ کد جدید بگیرید")
    }

    if (row.codeHash !== hashCode(chatId, code)) {
      const newAttempts = row.attempts + 1
      await db
        .update(adminLoginCodes)
        .set({ attempts: newAttempts })
        .where(eq(adminLoginCodes.id, row.id))
      void sendAdminMessage(
        "DEFAULT",
        `⚠️ تلاش ناموفق ورود ادمین: <code>${chatId}</code> — کد اشتباه (تلاش ${newAttempts})`,
        { parseMode: "HTML" }
      ).catch(() => {})
      // On 5th failure the next verify will hit the 423 lock above for 15m
      return unauthorized(c, "کد اشتباه است")
    }

    await db
      .update(adminLoginCodes)
      .set({ consumedAt: new Date() })
      .where(eq(adminLoginCodes.id, row.id))

    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.id, chatId))
      .limit(1)
    if (!admin || admin.banned || admin.role === "USER") return forbidden(c)

    // ONE-YEAR session - authorization is re-checked against the DB on every
    // request (withAdmin), so revocation is instant despite the long TTL.
    // No cookie here: the dashboard origin owns its own session cookie and
    // sends this token as a Bearer header.
    const token = await signSessionToken({
      sub: String(admin.id),
      role: admin.role,
      aud: "admin",
    })
    expireLegacySessionCookies(c)

    await db
      .update(users)
      .set({ lastOnlineAt: new Date() })
      .where(eq(users.id, admin.id))

    void sendAdminMessage(
      "DEFAULT",
      `✅ ورود ادمین: ${admin.firstName} ${admin.lastName ?? ""} ${admin.telegramUsername ? `@${admin.telegramUsername}` : ""} — <code>${admin.id}</code> نقش: ${admin.role}`,
      { parseMode: "HTML" }
    ).catch(() => {})

    return ok(c, { token, user: publicUser(admin) }, "خوش آمدید")
  })
  .post("/auth/logout", withAdmin, requireAdmin, async (c) => {
    const chatId = c.get("adminChatId")
    const role = c.get("adminRole")
    if (chatId) {
      void sendAdminMessage(
        "DEFAULT",
        `🚪 خروج ادمین: <code>${chatId}</code> نقش: ${role ?? "—"}`,
        { parseMode: "HTML" }
      ).catch(() => {})
    }
    expireLegacySessionCookies(c)
    return ok(c, null, "خارج شدید")
  })
  .get("/me", withAdmin, requireAdmin, async (c) => {
    const chatId = c.get("adminChatId")
    if (!chatId) return unauthorized(c)
    const [admin] = await db
      .select()
      .from(users)
      .where(eq(users.id, chatId))
      .limit(1)
    if (!admin) return unauthorized(c)
    return ok(c, {
      user: publicUser(admin),
      role: c.get("adminRole"),
    })
  })

/* ─── Role introspection ─── */

export const adminRbacRoutes = new Hono<AppEnv>()
  .use("*", withAdmin, requireAdmin)
  .get("/rbac/permissions", (c) => {
    return ok(c, {
      myRole: c.get("adminRole"),
    })
  })

/* ─── Registry meta for admin filters ─── */

export const adminRegistryMetaRoutes = new Hono<AppEnv>()
  .use("*", withAdmin, requireAdmin)
  .get("/meta/universities", (c) => {
    const { universities } = readIndexes()
    return ok(c, { universities })
  })
  .get("/meta/majors", (c) => {
    const uniParam =
      c.req.query("uni")?.trim() ?? c.req.queries("uni")?.join(",") ?? ""
    let { majors } = readIndexes()
    if (uniParam) {
      const unis = uniParam
        .split(/[،,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (unis.length) majors = majors.filter((m) => unis.includes(m.uniSlug))
    }
    return ok(c, { majors })
  })

/* ─── Users: view / search / detail / moderate / roles ─── */

const ROLES = ["USER", "ADMIN", "SUPERADMIN", "NOTIFICATIONER"] as const

export const adminUsersRoutes = new Hono<AppEnv>()
  .use("*", withAdmin, requireAdmin)
  .get("/users", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const q = c.req.query("q")?.trim()
    const banned = c.req.query("banned")
    const gender = c.req.query("gender")?.toUpperCase()
    // Multi-select: comma-separated or repeated ?university=a&university=b
    const parseMulti = (key: string): string[] => {
      const raw = c.req.query(key)
      if (!raw) {
        const all = c.req.queries(key)
        if (all && all.length > 0)
          return all
            .flatMap((v) => v.split(","))
            .map((s) => s.trim())
            .filter(Boolean)
        return []
      }
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    }
    const universities = parseMulti("university")
    const majors = parseMulti("major")
    const sort = c.req.query("sort") ?? "lastActivity"
    const { page, limit, offset } = parsePagination(c)

    const filters = [
      q
        ? or(
            ilike(users.firstName, `%${escapeLike(q)}%`),
            ilike(users.telegramUsername, `%${escapeLike(q)}%`)
          )
        : undefined,
      banned === "true" || banned === "false"
        ? eq(users.banned, banned === "true")
        : undefined,
      gender === "MALE" || gender === "FEMALE"
        ? eq(universityProfiles.gender, gender)
        : undefined,
      universities.length > 0
        ? inArray(universityProfiles.universitySlug, universities)
        : undefined,
      majors.length > 0
        ? inArray(universityProfiles.majorSlug, majors)
        : undefined,
    ]
    const where = filters.length > 0 ? and(...filters) : undefined

    // Always LEFT JOIN to expose profile data (uni, major, degree, etc.)
    // in the response without a second query.
    const joinClause = eq(universityProfiles.userId, users.id)

    const [countRow] = await db
      .select({ total: count() })
      .from(users)
      .leftJoin(universityProfiles, joinClause)
      .where(where)

    const total = countRow?.total ?? 0

    const orderBy =
      sort === "lastActivity"
        ? [desc(users.lastOnlineAt), desc(users.createdAt)]
        : [desc(users.createdAt)]

    const rows = await db
      .select({ user: users, profile: universityProfiles })
      .from(users)
      .leftJoin(universityProfiles, joinClause)
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset)

    // Resolve human-readable names for the profile (registry is git-based)
    const idx = readIndexes()
    const uniName = new Map(idx.universities.map((u) => [u.slug, u.name.fa]))
    const majorName = new Map(
      idx.majors.map((m) => [`${m.uniSlug}:${m.slug}`, m.name.fa])
    )
    const degreeName = new Map<string, string>()
    for (const m of idx.majors) {
      for (const d of m.degrees) {
        if (!degreeName.has(d.slug)) degreeName.set(d.slug, d.name.fa)
      }
    }

    return ok(c, {
      users: rows.map((r) => ({
        ...publicUser(r.user),
        profile: r.profile
          ? {
              universitySlug: r.profile.universitySlug,
              majorSlug: r.profile.majorSlug,
              universityName: r.profile.universitySlug
                ? (uniName.get(r.profile.universitySlug) ?? null)
                : null,
              majorName:
                r.profile.universitySlug && r.profile.majorSlug
                  ? (majorName.get(
                      `${r.profile.universitySlug}:${r.profile.majorSlug}`
                    ) ?? null)
                  : null,
              degree: r.profile.degree,
              degreeName: r.profile.degree
                ? (degreeName.get(r.profile.degree) ?? r.profile.degree)
                : null,
              entryYearRange: r.profile.entryYearRange,
              entrySemester: r.profile.entrySemester,
              gender: r.profile.gender,
              termNumber: r.profile.termNumber,
            }
          : null,
      })),
      pagination: { page, limit, total },
    })
  })
  .get("/users/:id", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const id = Number(c.req.param("id"))
    if (!Number.isSafeInteger(id)) return badRequest(c, "شناسه نامعتبر")

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    if (!user) return notFound(c, "کاربر پیدا نشد")

    const [profile] = await db
      .select()
      .from(universityProfiles)
      .where(eq(universityProfiles.userId, id))
      .limit(1)

    // Full lists for the detail page tabs (noted keeps soft-deleted rows so
    // the «حذف‌شده» tab can render them).
    const noted = await db
      .select()
      .from(notedCourses)
      .where(eq(notedCourses.userId, id))
      .orderBy(desc(notedCourses.updatedAt))

    const passed = await db
      .select()
      .from(passedCourses)
      .where(eq(passedCourses.userId, id))
      .orderBy(desc(passedCourses.createdAt))

    // Map slugs to Persian names like the list endpoint
    const idx = readIndexes()
    const uniName = new Map(idx.universities.map((u) => [u.slug, u.name.fa]))
    const majorName = new Map(
      idx.majors.map((m) => [`${m.uniSlug}:${m.slug}`, m.name.fa])
    )
    const degreeName = new Map<string, string>()
    for (const m of idx.majors)
      for (const d of m.degrees)
        if (!degreeName.has(d.slug)) degreeName.set(d.slug, d.name.fa)

    const enrichedProfile = profile
      ? {
          ...profile,
          universityName: profile.universitySlug
            ? (uniName.get(profile.universitySlug) ?? profile.universitySlug)
            : null,
          majorName:
            profile.universitySlug && profile.majorSlug
              ? (majorName.get(
                  `${profile.universitySlug}:${profile.majorSlug}`
                ) ?? profile.majorSlug)
              : null,
          degreeName: profile.degree
            ? (degreeName.get(profile.degree) ?? profile.degree)
            : null,
          entrySemesterLabel:
            profile.entrySemester === "MEHR"
              ? "مهر"
              : profile.entrySemester === "BAHMAN"
                ? "بهمن"
                : profile.entrySemester === "SUMMER"
                  ? "تابستانه"
                  : profile.entrySemester,
        }
      : null

    return ok(c, {
      user: publicUser(user),
      profile: enrichedProfile ?? profile ?? null,
      noted,
      passed,
      stats: {
        notedActive: noted.filter((n) => !n.isDeleted).length,
        notedDeleted: noted.filter((n) => n.isDeleted).length,
        passedCount: passed.length,
      },
    })
  })
  .get("/users/:id/chart", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const id = Number(c.req.param("id"))
    if (!Number.isSafeInteger(id)) return badRequest(c, "شناسه نامعتبر")
    const [profile] = await db
      .select()
      .from(universityProfiles)
      .where(eq(universityProfiles.userId, id))
      .limit(1)
    if (
      !profile?.universitySlug ||
      !profile?.majorSlug ||
      !profile?.degree ||
      !profile?.entryYearRange ||
      !profile?.entrySemester
    ) {
      return ok(c, { chart: null, courses: [] })
    }
    const { getChart } = await import("@workspace/registry")
    const chart = getChart(
      profile.universitySlug,
      profile.majorSlug,
      profile.degree,
      profile.entryYearRange,
      profile.entrySemester as never
    )
    if (!chart) return ok(c, { chart: null, courses: [] })
    const courses: Array<{
      course_name: string
      course_unit: number | string
      course_code?: string
    }> = []
    for (const cs of Object.values(chart.terms))
      for (const co of cs as unknown as Array<{
        name: string
        unit: number
        code?: string
      }>)
        courses.push({
          course_name: co.name,
          course_unit: co.unit,
          course_code: co.code,
        })
    for (const co of chart.moaref as unknown as Array<{
      name: string
      unit: number
      code?: string
    }>)
      courses.push({
        course_name: co.name,
        course_unit: co.unit,
        course_code: co.code,
      })
    return ok(c, { chart, courses })
  })
  .post("/users/:id/ban", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const id = Number(c.req.param("id"))
    const reason = c.req.query("reason") ?? "نقض قوانین"
    if (!Number.isSafeInteger(id)) return badRequest(c, "شناسه نامعتبر")

    const [target] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
    if (!target) return notFound(c, "کاربر پیدا نشد")

    // Escalation guards: SUPERADMINs are untouchable; banning an ADMIN
    // requires a SUPERADMIN actor. Admins can only ban regular users.
    const actorRole = c.get("adminRole")!
    if (target.role === "SUPERADMIN" || target.id === c.get("adminChatId")) {
      return forbidden(c, "اجازه مسدود کردن این حساب وجود ندارد")
    }
    if (target.role === "ADMIN" && actorRole !== "SUPERADMIN") {
      return forbidden(c, "مسدود کردن مدیر فقط توسط ابرمدیر ممکن است")
    }
    if (target.role === "NOTIFICATIONER" && actorRole !== "SUPERADMIN") {
      return forbidden(c, "مسدود کردن NOTIFICATIONER فقط توسط ابرمدیر ممکن است")
    }

    await db
      .update(users)
      .set({ banned: true, bannedReason: reason, updatedAt: new Date() })
      .where(eq(users.id, id))

    // Send ban notification with reason
    const banMessage = reason
      ? `🚫 حساب شما مسدود شد.\n\nدلیل: ${reason}\n\nاگر فکر می‌کنید اشتباه است، با پشتیبانی تماس بگیرید.`
      : "🚫 حساب شما مسدود شد.\n\nاگر فکر می‌کنید اشتباه است، با پشتیبانی تماس بگیرید."
    const appUrl = config.TELEGRAM_APP_URL?.replace(/\/$/, "")
    void sendRichMessage(id, {
      text: banMessage,
      ...(appUrl
        ? { buttons: [[{ text: "🚀 باز کردن برنامه", url: appUrl }]] }
        : {}),
    }).catch(() => {})
    void sendAdminMessage(
      "JOINS",
      `🚫 بن کاربر: <code>${id}</code> توسط <code>${c.get("adminChatId")}</code> دلیل: ${reason}`,
      { parseMode: "HTML" }
    ).catch(() => {})

    return ok(c, null, "کاربر مسدود شد")
  })
  .post("/users/:id/unban", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const id = Number(c.req.param("id"))
    if (!Number.isSafeInteger(id)) return badRequest(c, "شناسه نامعتبر")
    await db
      .update(users)
      .set({ banned: false, bannedReason: null, updatedAt: new Date() })
      .where(eq(users.id, id))

    // Send unban notification
    const appUrl = config.TELEGRAM_APP_URL?.replace(/\/$/, "")
    void sendRichMessage(id, {
      text: "✅ حساب شما از حالت مسدود خارج شد!\n\nخوش آمدید 🎉",
      ...(appUrl
        ? { buttons: [[{ text: "🚀 باز کردن برنامه", url: appUrl }]] }
        : {}),
    }).catch(() => {})
    void sendAdminMessage(
      "JOINS",
      `✅ آنبن کاربر: <code>${id}</code> توسط <code>${c.get("adminChatId")}</code>`,
      { parseMode: "HTML" }
    ).catch(() => {})

    return ok(c, null, "مسدودی برداشته شد")
  })
  .put(
    "/users/:id/role",
    requireRole("SUPERADMIN"),
    zValidator(
      "json",
      z.object({
        role: z.enum(["USER", "ADMIN", "SUPERADMIN", "NOTIFICATIONER"]),
      })
    ),
    async (c) => {
      const id = Number(c.req.param("id"))
      const { role } = c.req.valid("json")
      if (!Number.isSafeInteger(id)) return badRequest(c, "شناسه نامعتبر")

      // Never allow changing your own role - prevents accidental self-lockout.
      if (id === c.get("adminChatId")) {
        return forbidden(c, "نمی‌توانید نقش خودتان را تغییر دهید")
      }

      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
      if (!target) return notFound(c, "کاربر پیدا نشد")

      // Protect the last SUPERADMIN from demotion.
      if (target.role === "SUPERADMIN" && role !== "SUPERADMIN") {
        const [countRow] = await db
          .select({ total: count() })
          .from(users)
          .where(and(eq(users.role, "SUPERADMIN"), eq(users.banned, false)))
        if ((countRow?.total ?? 0) <= 1) {
          return conflict(c, "آخرین ابرمدیر را نمی‌توان تنزل داد")
        }
      }

      await db
        .update(users)
        .set({ role, updatedAt: new Date() })
        .where(eq(users.id, id))

      // Notify the user their access changed + give them their chat id & login page.
      void notifyPermissionChanged(id).catch(() => {})
      void sendAdminMessage(
        "JOINS",
        `🔧 تغییر نقش: <code>${id}</code> → ${role} توسط <code>${c.get("adminChatId")}</code>`,
        { parseMode: "HTML" }
      ).catch(() => {})

      return ok(c, { id, role }, "نقش کاربر به‌روزرسانی شد")
    }
  )
  .patch(
    "/users/:id/contributor",
    requireRole("ADMIN", "SUPERADMIN"),
    async (c) => {
      const id = Number(c.req.param("id"))
      if (!Number.isSafeInteger(id)) return badRequest(c, "شناسه نامعتبر")

      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
      if (!target) return notFound(c, "کاربر پیدا نشد")

      const newValue = !target.isContributor
      await db
        .update(users)
        .set({ isContributor: newValue, updatedAt: new Date() })
        .where(eq(users.id, id))

      // Send congratulations message when enabling contributor status (old behavior)
      if (newValue && config.TELEGRAM_APP_URL) {
        const appUrl = config.TELEGRAM_APP_URL.replace(/\/$/, "")
        void sendRichMessage(id, {
          text: `تبریک شما نماد مشارکت کننده دریافت کردید.`,
          buttons: [[{ text: "🚀 باز کردن برنامه", url: appUrl }]],
        }).catch(() => {})
      }
      void sendAdminMessage(
        "JOINS",
        `${newValue ? "⭐" : "➖"} مشارکت‌کننده: <code>${id}</code> → ${newValue ? "فعال" : "غیرفعال"} توسط <code>${c.get("adminChatId")}</code>`,
        { parseMode: "HTML" }
      ).catch(() => {})

      return ok(
        c,
        { id, isContributor: newValue },
        newValue ? "مشارکت‌کننده فعال شد" : "مشارکت‌کننده غیرفعال شد"
      )
    }
  )

  /* ─── Online heartbeat (admin) ─── */
  .post("/online", withAdmin, requireAdmin, async (c) => {
    const chatId = c.get("adminChatId")!
    await db
      .update(users)
      .set({ lastOnlineAt: new Date() })
      .where(eq(users.id, chatId))
    return ok(c, null)
  })
