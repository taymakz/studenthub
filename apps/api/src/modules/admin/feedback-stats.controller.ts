import { zValidator } from "@hono/zod-validator"
import {
  feedback,
  notedCourses,
  notificationBatches,
  notificationMessages,
  professorVotes,
  universityProfiles,
  uploads,
  users,
} from "@workspace/db/schema"
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import * as jalali from "date-fns-jalali"

import { db } from "@/lib/db"
import { notFound, ok, parsePagination } from "@/lib/http/common"
import { readIndexes } from "@/lib/registry"
import { requireRole } from "@/lib/rbac"
import { sendAdminMessage, buildFeedbackMessage } from "@/lib/telegram/admin"
import type { AppEnv } from "@/middleware/auth"
import {
  requireAdmin,
  requireUser,
  withAdmin,
  withUser,
} from "@/middleware/auth"

/* ─── User feedback (mini app) ───
   Taxonomy (no attachments in v1):
     BUG        -> گزارش اشکال
     SUGGESTION -> پیشنهادات
     THANKS     -> تشکر و قدردانی
     SOURCE     -> معرفی منبع: users propose study sources here; engineers
                   add accepted ones to the registry via PR - there is no
                   upload endpoint for sources by design. */

const FEEDBACK_KINDS = ["BUG", "SUGGESTION", "THANKS", "SOURCE"] as const

const createFeedbackSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().min(3).max(5000),
})

export const meFeedbackRoutes = new Hono<AppEnv>()
  .use("*", withUser, requireUser)
  .post("/me/feedback", zValidator("json", createFeedbackSchema), async (c) => {
    const user = c.get("user")!
    const body = c.req.valid("json")
    const [row] = await db
      .insert(feedback)
      .values({
        userId: user.id,
        kind: body.kind,
        message: body.message,
      })
      .returning() // Fire-and-forget: notify the admin DEFAULT topic with a link to review.
    void (async () => {
      try {
        const text = buildFeedbackMessage(
          {
            id: user.id as number,
            firstName: user.firstName,
            lastName: user.lastName,
            telegramUsername: user.telegramUsername,
          },
          { kind: body.kind, message: body.message }
        )
        await sendAdminMessage("DEFAULT", text, {
          parseMode: "HTML",
          buttons: [
            [
              {
                text: "📬 مشاهده بازخوردها",
                url: "https://admin.student-hub.ir/feedback",
              },
            ],
          ],
        })
      } catch {}
    })()
    return ok(c, { feedback: row }, "بازخورد شما ثبت شد؛ ممنون!")
  })
  .get("/me/feedback", async (c) => {
    const user = c.get("user")!
    const rows = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, user.id))
      .orderBy(desc(feedback.createdAt))
      .limit(50)
    return ok(c, { feedback: rows })
  })

/* ─── Admin feedback moderation + dashboard stats ─── */

let cachedStats: { data: unknown; at: number } | null = null

export const adminFeedbackRoutes = new Hono<AppEnv>()
  .use("*", withAdmin, requireAdmin)
  .get("/feedback", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const q = c.req.query("q")?.trim()
    const kind = c.req.query("kind")?.toUpperCase()
    const status = c.req.query("status")?.toUpperCase()
    const sort = c.req.query("sort") ?? "newest"
    const { page, limit, offset } = parsePagination(c)
    const validKinds = ["BUG", "SUGGESTION", "THANKS", "SOURCE"] as const
    const filters = [
      q
        ? or(
            ilike(feedback.message, `%${q}%`),
            ilike(users.firstName, `%${q}%`),
            ilike(users.lastName, `%${q}%`),
            ilike(users.telegramUsername, `%${q}%`),
            sql`CAST(${feedback.userId} AS TEXT) ILIKE ${`%${q}%`}`,
            ilike(
              sql`concat(${users.firstName}, ' ', ${users.lastName})`,
              `%${q}%`
            )
          )
        : undefined,
      kind && (validKinds as readonly string[]).includes(kind)
        ? eq(feedback.kind, kind as never)
        : undefined,
      status === "OPEN" || status === "RESOLVED"
        ? eq(feedback.status, status as never)
        : undefined,
    ]
    const where = filters.filter(Boolean).length
      ? and(...(filters.filter(Boolean) as any))
      : undefined
    const orderBy =
      sort === "oldest" ? feedback.createdAt : desc(feedback.createdAt)
    const [countRow] = await db
      .select({ total: count() })
      .from(feedback)
      .where(where)
    const total = countRow?.total ?? 0
    const rows = await db
      .select({
        feedback: feedback,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          telegramUsername: users.telegramUsername,
          photoUrl: users.photoUrl,
        },
        profile: {
          universitySlug: universityProfiles.universitySlug,
          majorSlug: universityProfiles.majorSlug,
          universityName: sql<string>`''`,
          majorName: sql<string>`''`,
          degree: universityProfiles.degree,
          entryYearRange: universityProfiles.entryYearRange,
          entrySemester: universityProfiles.entrySemester,
          gender: universityProfiles.gender,
          termNumber: universityProfiles.termNumber,
        },
      })
      .from(feedback)
      .leftJoin(users, eq(users.id, feedback.userId))
      .leftJoin(
        universityProfiles,
        eq(universityProfiles.userId, feedback.userId)
      )
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    // Resolve registry names for profiles (if any)
    const idx = readIndexes()
    const uniName = new Map(idx.universities.map((u) => [u.slug, u.name.fa]))
    const majorName = new Map(
      idx.majors.map((m) => [`${m.uniSlug}:${m.slug}`, m.name.fa])
    )
    const enriched = rows.map((r) => ({
      ...r.feedback,
      user: r.user?.id
        ? {
            id: r.user.id,
            firstName: r.user.firstName,
            lastName: r.user.lastName,
            telegramUsername: r.user.telegramUsername,
            photoUrl: r.user.photoUrl,
            profile:
              r.profile?.universitySlug || r.profile?.majorSlug
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
                    entryYearRange: r.profile.entryYearRange,
                    entrySemester: r.profile.entrySemester,
                    gender: r.profile.gender,
                    termNumber: r.profile.termNumber,
                  }
                : null,
          }
        : null,
    }))

    return ok(c, {
      feedback: enriched as any,
      pagination: { page, limit, total },
    })
  })
  .post(
    "/feedback/:id/resolve",
    requireRole("ADMIN", "SUPERADMIN"),
    async (c) => {
      const adminChatId = c.get("adminChatId")!
      const [row] = await db
        .update(feedback)
        .set({
          status: "RESOLVED",
          resolvedById: adminChatId,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(feedback.id, c.req.param("id")))
        .returning()
      if (!row) return notFound(c, "بازخورد پیدا نشد")
      return ok(c, { feedback: row }, "حل شد")
    }
  )
  .post(
    "/feedback/:id/reopen",
    requireRole("ADMIN", "SUPERADMIN"),
    async (c) => {
      const [row] = await db
        .update(feedback)
        .set({
          status: "OPEN",
          resolvedById: null,
          resolvedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(feedback.id, c.req.param("id")))
        .returning()
      if (!row) return notFound(c, "بازخورد پیدا نشد")
      return ok(c, { feedback: row }, "بازگشایی شد")
    }
  )
  .delete("/feedback/:id", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const id = c.req.param("id")
    const [row] = await db
      .delete(feedback)
      .where(eq(feedback.id, id))
      .returning()
    if (!row) return notFound(c, "بازخورد پیدا نشد")
    return ok(c, null, "حذف شد")
  })
  .get("/stats", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    if (cachedStats && Date.now() - cachedStats.at < 60_000) {
      c.header("Cache-Control", "public, max-age=30")
      return ok(c, cachedStats.data)
    }
    // ONE round trip: all counters as aggregate expressions over a single
    // scan of `users` + scalar subselects for the other tables. postgres-js
    // returns count() (bigint) as string, hence Number().
    const [row] = await db
      .select({
        users: count(),
        bannedUsers: sql<number>`count(*) filter (where ${users.banned})`,
        admins: sql<number>`count(*) filter (where ${users.role} <> 'USER')`,
        contributors: sql<number>`count(*) filter (where ${users.isContributor})`,
        pendingUploads: sql<number>`(select count(*) from ${uploads} where ${uploads.status} = 'PENDING')`,
        activeBatches: sql<number>`(select count(*) from ${notificationBatches} where ${notificationBatches.status} in ('READY','SENDING'))`,
        pendingMessages: sql<number>`(select count(*) from ${notificationMessages} where ${notificationMessages.status} in ('PENDING','SENDING'))`,
        openFeedback: sql<number>`(select count(*) from ${feedback} where ${feedback.status} = 'OPEN')`,
        professorVotes: sql<number>`(select count(*) from ${professorVotes})`,
        activeNotedCourses: sql<number>`(select count(*) from ${notedCourses} where ${notedCourses.isDeleted} = false)`,
      })
      .from(users)
    const stats: Record<string, number> = {
      users: Number(row?.users ?? 0),
      bannedUsers: Number(row?.bannedUsers ?? 0),
      admins: Number(row?.admins ?? 0),
      contributors: Number(row?.contributors ?? 0),
      pendingUploads: Number(row?.pendingUploads ?? 0),
      activeBatches: Number(row?.activeBatches ?? 0),
      pendingMessages: Number(row?.pendingMessages ?? 0),
      openFeedback: Number(row?.openFeedback ?? 0),
      professorVotes: Number(row?.professorVotes ?? 0),
      activeNotedCourses: Number(row?.activeNotedCourses ?? 0),
    }

    // ── Dashboard extras ──

    // Users per university (non-banned), Persian names from the registry
    // index; null-profile users bucket under «بدون دانشگاه».
    const uniRows = await db
      .select({
        slug: universityProfiles.universitySlug,
        total: count(),
      })
      .from(universityProfiles)
      .innerJoin(users, eq(users.id, universityProfiles.userId))
      .where(eq(users.banned, false))
      .groupBy(universityProfiles.universitySlug)

    const uniNames = new Map(
      readIndexes().universities.map((u) => [u.slug, u.name.fa])
    )
    // Only universities that actually exist in the registry - legacy/mock
    // slugs with no registry entry would render raw ids.
    const usersByUniversity = uniRows
      .filter((r) => r.slug && uniNames.has(r.slug))
      .map((r) => ({
        slug: r.slug!,
        name: uniNames.get(r.slug!)!,
        count: Number(r.total ?? 0),
      }))
      .sort((a, b) => b.count - a.count)

    // TODO(ops): CREATE INDEX CONCURRENTLY users_created_at_idx ON users(created_at) WHERE created_at >= '2025-01-01' — for /admin/stats series
    // Signups per Jalali month from 2025-01-01 (1403-10) till current Jalali month (dynamic), zero-filled.
    const since = new Date("2025-01-01T00:00:00.000Z")
    const rows = await db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(sql`${users.createdAt} >= ${since.toISOString()}`)
    const byJalaliMonth = new Map<string, number>()
    for (const r of rows) {
      const d = new Date(r.createdAt)
      const y = jalali.getYear(d)
      const m = jalali.getMonth(d) + 1
      const key = `${y}-${String(m).padStart(2, "0")}`
      byJalaliMonth.set(key, (byJalaliMonth.get(key) ?? 0) + 1)
    }
    // Jalali range: 1403-10 (Dey 1403 contains 2025-01-01) through current Jalali month
    const startJalali = jalali.startOfMonth(
      new Date("2025-01-01T00:00:00.000Z")
    )
    const endJalali = jalali.startOfMonth(new Date())
    const series: Array<{ date: string; value: number }> = []
    for (
      let cur = startJalali;
      jalali.isBefore(cur, endJalali) || jalali.isEqual(cur, endJalali);
      cur = jalali.addMonths(cur, 1)
    ) {
      const y = jalali.getYear(cur)
      const m = jalali.getMonth(cur) + 1
      const key = `${y}-${String(m).padStart(2, "0")}`
      // Use Gregorian first day of that Jalali month as the chart date
      const gregDate = cur.toISOString().slice(0, 10)
      series.push({ date: gregDate, value: byJalaliMonth.get(key) ?? 0 })
    }
    const values = series.map((p) => p.value)
    const average =
      Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
    const prev = values[values.length - 2] ?? 0
    const last = values[values.length - 1] ?? 0
    const trend =
      prev === 0 ? 0 : Number((((last - prev) / prev) * 100).toFixed(1))

    const result = {
      ...stats,
      signupSeries: { series, average, trend },
      usersByUniversity,
    }
    cachedStats = { data: result, at: Date.now() }
    c.header("Cache-Control", "public, max-age=30")
    return ok(c, result)
  })
