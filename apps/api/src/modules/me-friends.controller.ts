import { zValidator } from "@hono/zod-validator"
import {
  FRIEND_REQUEST_COOLDOWN_DAYS,
  MAX_FRIENDS_PER_USER,
  failedCourses,
  friendBlocks,
  friendRequests,
  friendships,
  friendshipPair,
  notedCourses,
  passedCourses,
  universityProfiles,
  users,
} from "@workspace/db/schema"
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import {
  findChartYearDirForYear,
  getChart,
} from "@/lib/registry"
import { parseTermCode } from "@/lib/terms"
import {
  formatYearDirectory,
  getMajor,
  getUniversity,
} from "@workspace/registry"

import { db } from "@/lib/db"
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  parsePagination,
} from "@/lib/http/common"
import { sendMessage } from "@/lib/telegram/bot"
import { sendAdminMessage } from "@/lib/telegram/admin"
import type { AppEnv } from "@/middleware/auth"
import { requireUser, withUser } from "@/middleware/auth"

/**
 * Friend system (mini app). Identity = Telegram chat id, which doubles as
 * the public "friend id" users share to add each other.
 *
 * Rules (see packages/db/src/schema/friends.ts):
 * - Send by friend id. Rejected when: self, unknown user, already friends,
 *   pending exists either way, a block exists either way, or the sender was
 *   declined by this receiver within FRIEND_REQUEST_COOLDOWN_DAYS.
 * - Target-side rejections (friend cap reached, auto-decline on, block
 *   either way) all return the same generic 403 so senders cannot probe
 *   which one applies. Auto-declined sends store nothing and start no
 *   cooldown.
 * - Reverse PENDING on send -> instant auto-befriend (no duplicate rows).
 * - Manual decline starts a 1-month cooldown for the sender.
 * - Block is full: drops the friendship + cancels pendings both ways, and
 *   forbids sending until unblocked. Unblock restores nothing.
 */

const friendIdParamSchema = z.object({
  friendId: z
    .string()
    .regex(/^\d+$/, "شناسه دوست معتبر نیست")
    .transform((s) => Number.parseInt(s, 10)),
})

const requestIdParamSchema = z.object({
  id: z.string().uuid("شناسه درخواست معتبر نیست"),
})

const sendSchema = z.object({
  friendId: z.number().int().positive("شناسه دوست معتبر نیست"),
})

const settingsSchema = z.object({
  autoDecline: z.boolean(),
})

function cooldownCutoff(): Date {
  return new Date(
    Date.now() - FRIEND_REQUEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  )
}

/** Current mutual-friend count for the cap check. */
async function friendCountOf(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      or(
        eq(friendships.userLowId, userId),
        eq(friendships.userHighId, userId)
      )
    )
  return row?.count ?? 0
}

/** Minimal public card - same privacy level as the classmates list. */
function toFriendCard(row: {
  id: number
  firstName: string
  lastName: string | null
  photoUrl: string | null
  telegramUsername: string | null
}) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    photoUrl: row.photoUrl,
    username: row.telegramUsername,
  }
}

interface PersonInfo {
  firstName: string
  lastName: string | null
  telegramUsername: string | null
}

/** "First Last (@username)" — only these three fields, nothing else. */
function personLine(u: PersonInfo): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ")
  return u.telegramUsername ? `${name} (@${u.telegramUsername})` : name
}

/**
 * Telegram DM notifications for the friend flow. Best-effort: sendMessage
 * never throws (blocked bot / deleted chat just resolve ok:false), so a
 * failed DM never breaks the friend action itself.
 */
async function notifyFriendRequest(
  receiverId: number,
  sender: PersonInfo
): Promise<void> {
  await sendMessage(
    receiverId,
    `درخواست دوستی جدید\nاز: ${personLine(sender)}\nبخش پروفایل ← دوستای من`
  )
}

async function notifyFriendAccepted(
  requesterId: number,
  accepter: PersonInfo
): Promise<void> {
  await sendMessage(
    requesterId,
    `درخواست دوستی شما پذیرفته شد\nاز: ${personLine(accepter)}`
  )
}

async function personOf(
  id: number
): Promise<(PersonInfo & { id: number }) | null> {
  const [row] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      telegramUsername: users.telegramUsername,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)
  return row ?? null
}

/**
 * Audit trail to the DEFAULT service topic (who did what to whom).
 * Fire-and-forget: sendAdminMessage never throws, audit never delays the
 * user-facing response.
 */
function audit(text: string): void {
  void sendAdminMessage("DEFAULT", text)
}

/** First year of an entry-cohort directory: "[1403-1404]" -> 1403, "1405" -> 1405. */
function entryYearStart(range: string | null | undefined): number | null {
  if (!range) return null
  const single = /^(\d{4})$/.exec(range)
  if (single) return Number(single[1])
  const pair = /^\[(\d{4})-(\d{4})\]$/.exec(range)
  if (pair) return Number(pair[1])
  return null
}

const FA_ENTRY_SEMESTER: Record<string, string> = {
  MEHR: "مهر",
  BAHMAN: "بهمن",
  SUMMER: "تابستان",
}

// Registry reads are sync file IO - cache fa names per process.
const uniNameCache = new Map<string, string | null>()
const majorNameCache = new Map<string, string | null>()

function cachedUniName(slug: string): string | null {
  const hit = uniNameCache.get(slug)
  if (hit !== undefined) return hit
  let name: string | null = null
  try {
    name = getUniversity(slug)?.name.fa ?? null
  } catch {
    name = null
  }
  uniNameCache.set(slug, name)
  return name
}

function cachedMajorName(uniSlug: string, majorSlug: string): string | null {
  const key = `${uniSlug}/${majorSlug}`
  const hit = majorNameCache.get(key)
  if (hit !== undefined) return hit
  let name: string | null = null
  try {
    name = getMajor(uniSlug, majorSlug)?.name.fa ?? null
  } catch {
    name = null
  }
  majorNameCache.set(key, name)
  return name
}

/**
 * Friend subtitle: «دانشگاه آزاد ملارد - مهندسی کامپیوتر - ورودی 1403-1405 مهر».
 * Null when the friend has no usable university profile.
 */
function profileLine(profile: {
  universitySlug: string | null
  majorSlug: string | null
  entryYearRange: string | null
  entrySemester: string | null
} | null | undefined): string | null {
  if (!profile?.universitySlug || !profile?.majorSlug) return null
  const uni = cachedUniName(profile.universitySlug)
  const major = cachedMajorName(profile.universitySlug, profile.majorSlug)
  if (!uni || !major) return null
  const range = (profile.entryYearRange ?? "").replace(/[\[\]]/g, "")
  const sem = profile.entrySemester
    ? (FA_ENTRY_SEMESTER[profile.entrySemester] ?? null)
    : null
  const entry = [range || null, sem].filter(Boolean).join(" ")
  return entry ? `${uni} - ${major} - ورودی ${entry}` : `${uni} - ${major}`
}

const coursesQuerySchema = z.object({
  uni: z.string().min(1).max(128),
  major: z.string().min(1).max(128),
  termCode: z.string().regex(/^\d{4}$/, "کد نیم‌سال معتبر نیست"),
})

/** My friend ids (both sides of the undirected friendships). */
async function friendIdsOf(userId: number): Promise<number[]> {
  const lows = await db
    .select({ id: friendships.userHighId })
    .from(friendships)
    .where(eq(friendships.userLowId, userId))
  const highs = await db
    .select({ id: friendships.userLowId })
    .from(friendships)
    .where(eq(friendships.userHighId, userId))
  return [...new Set([...lows, ...highs].map((r) => r.id))]
}

export const meFriendRoutes = new Hono<AppEnv>()
  .use("*", withUser, requireUser)
  .get(
    "/me/friends/courses",
    zValidator("query", coursesQuerySchema),
    async (c) => {
      const user = c.get("user")!
      const { uni, major, termCode } = c.req.valid("query")
      const parsed = parseTermCode(termCode)
      if (!parsed) return badRequest(c, "کد نیم‌سال معتبر نیست")

      const ids = await friendIdsOf(user.id)
      if (ids.length === 0) return ok(c, { courses: [] })

      // One query: per-course totals + up to 5 most-recent noters each.
      const rows = await db
        .select({
          courseIndex: notedCourses.courseIndex,
          userId: notedCourses.userId,
          total: sql<number>`count(*) over (partition by ${notedCourses.courseIndex})::int`,
          rn: sql<number>`row_number() over (partition by ${notedCourses.courseIndex} order by ${notedCourses.createdAt} desc)::int`,
        })
        .from(notedCourses)
        .innerJoin(users, eq(users.id, notedCourses.userId))
        .where(
          and(
            inArray(notedCourses.userId, ids),
            eq(notedCourses.universitySlug, uni),
            eq(notedCourses.majorSlug, major),
            eq(notedCourses.year, String(parsed.year)),
            eq(notedCourses.semester, parsed.semester),
            eq(notedCourses.isDeleted, false),
            eq(users.banned, false)
          )
        )

      const byCourse = new Map<
        string,
        { total: number; userIds: number[] }
      >()
      for (const r of rows) {
        let entry = byCourse.get(r.courseIndex)
        if (!entry) {
          entry = { total: r.total, userIds: [] }
          byCourse.set(r.courseIndex, entry)
        }
        if (r.rn <= 5) entry.userIds.push(r.userId)
      }
      if (byCourse.size === 0) return ok(c, { courses: [] })

      const sampleIds = [
        ...new Set([...byCourse.values()].flatMap((e) => e.userIds)),
      ]
      const cards = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          photoUrl: users.photoUrl,
          telegramUsername: users.telegramUsername,
        })
        .from(users)
        .where(inArray(users.id, sampleIds))
      const cardById = new Map(cards.map((u) => [u.id, toFriendCard(u)]))

      const courses = [...byCourse.entries()].map(([courseIndex, e]) => ({
        courseIndex,
        count: e.total,
        sample: e.userIds.flatMap((id) => {
          const card = cardById.get(id)
          return card ? [card] : []
        }),
      }))

      return ok(c, { courses })
    }
  )
  .get(
    "/me/friends/courses/:courseIndex",
    zValidator("query", coursesQuerySchema),
    async (c) => {
      const user = c.get("user")!
      const courseIndex = c.req.param("courseIndex")
      if (!courseIndex || courseIndex.length > 64) {
        return badRequest(c, "شناسه درس معتبر نیست")
      }
      const { uni, major, termCode } = c.req.valid("query")
      const parsed = parseTermCode(termCode)
      if (!parsed) return badRequest(c, "کد نیم‌سال معتبر نیست")

      const ids = await friendIdsOf(user.id)
      if (ids.length === 0) return ok(c, { mates: [], page: 1, limit: 25, hasMore: false })

      const { page, limit, offset } = parsePagination(c)
      const rows = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          photoUrl: users.photoUrl,
          telegramUsername: users.telegramUsername,
        })
        .from(notedCourses)
        .innerJoin(users, eq(users.id, notedCourses.userId))
        .where(
          and(
            inArray(notedCourses.userId, ids),
            eq(notedCourses.courseIndex, courseIndex),
            eq(notedCourses.universitySlug, uni),
            eq(notedCourses.majorSlug, major),
            eq(notedCourses.year, String(parsed.year)),
            eq(notedCourses.semester, parsed.semester),
            eq(notedCourses.isDeleted, false),
            eq(users.banned, false)
          )
        )
        .orderBy(desc(notedCourses.createdAt))
        .limit(limit + 1)
        .offset(offset)

      const hasMore = rows.length > limit
      const mates = (hasMore ? rows.slice(0, limit) : rows).map(toFriendCard)

      return ok(c, { mates, page, limit, hasMore })
    }
  )
  .get("/me/friends/summary", async (c) => {
    const user = c.get("user")!
    const [me] = await db
      .select({ autoDecline: users.autoDeclineFriendRequests })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    const [friendsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(friendships)
      .where(
        or(
          eq(friendships.userLowId, user.id),
          eq(friendships.userHighId, user.id)
        )
      )
    const [incomingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.receiverId, user.id),
          eq(friendRequests.status, "PENDING")
        )
      )
    const [outgoingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.senderId, user.id),
          eq(friendRequests.status, "PENDING")
        )
      )

    return ok(c, {
      friendsCount: friendsRow?.count ?? 0,
      incomingPendingCount: incomingRow?.count ?? 0,
      outgoingPendingCount: outgoingRow?.count ?? 0,
      autoDecline: me?.autoDecline ?? false,
      maxFriends: MAX_FRIENDS_PER_USER,
    })
  })
  .get("/me/friends", async (c) => {
    const user = c.get("user")!
    const { page, limit, offset } = parsePagination(c)

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        telegramUsername: users.telegramUsername,
        friendsSince: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(
        users,
        sql`${users.id} = CASE WHEN ${friendships.userLowId} = ${user.id} THEN ${friendships.userHighId} ELSE ${friendships.userLowId} END`
      )
      .where(
        and(
          or(
            eq(friendships.userLowId, user.id),
            eq(friendships.userHighId, user.id)
          ),
          eq(users.banned, false)
        )
      )
      .orderBy(desc(friendships.createdAt))
      .limit(limit + 1)
      .offset(offset)

    const hasMore = rows.length > limit
    const pageRows = hasMore ? rows.slice(0, limit) : rows

    const profiles = pageRows.length > 0
      ? await db
          .select({
            userId: universityProfiles.userId,
            universitySlug: universityProfiles.universitySlug,
            majorSlug: universityProfiles.majorSlug,
            entryYearRange: universityProfiles.entryYearRange,
            entrySemester: universityProfiles.entrySemester,
          })
          .from(universityProfiles)
          .where(
            inArray(
              universityProfiles.userId,
              pageRows.map((r) => r.id)
            )
          )
      : []
    const profileByUser = new Map(profiles.map((p) => [p.userId, p]))

    const friends = pageRows.map((r) => ({
      ...toFriendCard(r),
      friendsSince: r.friendsSince,
      profile: profileLine(profileByUser.get(r.id) ?? null),
    }))

    return ok(c, { friends, page, limit, hasMore })
  })
  .delete(
    "/me/friends/:friendId",
    zValidator("param", friendIdParamSchema),
    async (c) => {
      const user = c.get("user")!
      const { friendId } = c.req.valid("param")
      const [low, high] = friendshipPair(user.id, friendId)
      await db
        .delete(friendships)
        .where(
          and(
            eq(friendships.userLowId, low),
            eq(friendships.userHighId, high)
          )
        )
      const exFriend = await personOf(friendId)
      if (exFriend) {
        audit(`حذف دوست: ${personLine(user)} کاربر ${personLine(exFriend)} را از دوستان حذف کرد`)
      }
      return ok(c, null, "از لیست دوستان حذف شد")
    }
  )
  .get(
    "/me/friends/:friendId/detail",
    zValidator("param", friendIdParamSchema),
    async (c) => {
      const user = c.get("user")!
      const { friendId } = c.req.valid("param")

      // Friends only - no friendship, no detail.
      const [low, high] = friendshipPair(user.id, friendId)
      const [friendship] = await db
        .select()
        .from(friendships)
        .where(
          and(
            eq(friendships.userLowId, low),
            eq(friendships.userHighId, high)
          )
        )
        .limit(1)
      if (!friendship) return notFound(c, "دوست یافت نشد")

      const [friend] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          photoUrl: users.photoUrl,
          telegramUsername: users.telegramUsername,
        })
        .from(users)
        .where(eq(users.id, friendId))
        .limit(1)
      if (!friend) return notFound(c, "دوست یافت نشد")

      const [profile] = await db
        .select({
          universitySlug: universityProfiles.universitySlug,
          majorSlug: universityProfiles.majorSlug,
          degree: universityProfiles.degree,
          entryYearRange: universityProfiles.entryYearRange,
          entrySemester: universityProfiles.entrySemester,
          currentSemesterCode: universityProfiles.currentSemesterCode,
        })
        .from(universityProfiles)
        .where(eq(universityProfiles.userId, friendId))
        .limit(1)

      const noted = await db
        .select({
          courseIndex: notedCourses.courseIndex,
          year: notedCourses.year,
          semester: notedCourses.semester,
        })
        .from(notedCourses)
        .where(
          and(
            eq(notedCourses.userId, friendId),
            eq(notedCourses.isDeleted, false)
          )
        )
        .orderBy(desc(notedCourses.createdAt))
        .limit(200)

      const passed = await db
        .select({ courseName: passedCourses.courseName })
        .from(passedCourses)
        .where(eq(passedCourses.userId, friendId))
        .limit(500)

      const failed = await db
        .select({ courseName: failedCourses.courseName })
        .from(failedCourses)
        .where(eq(failedCourses.userId, friendId))
        .limit(500)

      // Friend's graduation chart (same resolution as GET /me) so the client
      // can group passed/failed courses by term exactly like /profile.
      let chart: unknown = null
      if (
        profile?.universitySlug &&
        profile?.majorSlug &&
        profile?.degree &&
        profile?.entryYearRange &&
        profile?.entrySemester
      ) {
        try {
          const year = entryYearStart(profile.entryYearRange)
          if (year != null) {
            const ydir = findChartYearDirForYear(
              profile.universitySlug,
              profile.majorSlug,
              profile.degree,
              year
            )
            if (ydir) {
              chart = getChart(
                profile.universitySlug,
                profile.majorSlug,
                profile.degree,
                formatYearDirectory(ydir),
                profile.entrySemester
              )
            }
          }
        } catch {
          chart = null
        }
      }

      return ok(c, {
        user: toFriendCard(friend),
        profile: profile ?? null,
        noted,
        passed: passed.map((p) => p.courseName),
        failed: failed.map((f) => f.courseName),
        chart,
      })
    }
  )
  .get("/me/friends/requests", async (c) => {
    const user = c.get("user")!
    const direction = c.req.query("direction") ?? "incoming"
    if (direction !== "incoming" && direction !== "outgoing") {
      return badRequest(c, "جهت درخواست معتبر نیست")
    }
    const { page, limit, offset } = parsePagination(c)
    const isIncoming = direction === "incoming"

    const rows = await db
      .select({
        id: friendRequests.id,
        status: friendRequests.status,
        createdAt: friendRequests.createdAt,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        telegramUsername: users.telegramUsername,
      })
      .from(friendRequests)
      .innerJoin(
        users,
        eq(users.id, isIncoming ? friendRequests.senderId : friendRequests.receiverId)
      )
      .where(
        and(
          eq(
            isIncoming ? friendRequests.receiverId : friendRequests.senderId,
            user.id
          ),
          eq(friendRequests.status, "PENDING")
        )
      )
      .orderBy(desc(friendRequests.createdAt))
      .limit(limit + 1)
      .offset(offset)

    const hasMore = rows.length > limit
    const requests = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      direction,
      user: toFriendCard({
        id: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        photoUrl: r.photoUrl,
        telegramUsername: r.telegramUsername,
      }),
    }))

    return ok(c, { requests, page, limit, hasMore })
  })
  .post("/me/friends/requests", zValidator("json", sendSchema), async (c) => {
    const user = c.get("user")!
    const { friendId: targetId } = c.req.valid("json")

    if (targetId === user.id) {
      return badRequest(c, "نمی‌توانید به خودتان درخواست دوستی بدهید")
    }

    const [target] = await db
      .select({
        id: users.id,
        banned: users.banned,
        autoDecline: users.autoDeclineFriendRequests,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        telegramUsername: users.telegramUsername,
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1)
    if (!target) return notFound(c, "کاربری با این شناسه یافت نشد")

    const [low, high] = friendshipPair(user.id, targetId)
    const [existing] = await db
      .select()
      .from(friendships)
      .where(
        and(eq(friendships.userLowId, low), eq(friendships.userHighId, high))
      )
      .limit(1)
    if (existing) return conflict(c, "شما قبلاً با هم دوست هستید")

    const [block] = await db
      .select()
      .from(friendBlocks)
      .where(
        or(
          and(
            eq(friendBlocks.blockerId, user.id),
            eq(friendBlocks.blockedId, targetId)
          ),
          and(
            eq(friendBlocks.blockerId, targetId),
            eq(friendBlocks.blockedId, user.id)
          )
        )
      )
      .limit(1)
    if (block) {
      return forbidden(c, "امکان ارسال درخواست دوستی وجود ندارد")
    }

    const [outgoing] = await db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.senderId, user.id),
          eq(friendRequests.receiverId, targetId),
          eq(friendRequests.status, "PENDING")
        )
      )
      .limit(1)
    if (outgoing) return conflict(c, "درخواست قبلی شما هنوز در انتظار پاسخ است")

    // Cooldown: declined by this receiver within the last 30 days.
    const [cooldown] = await db
      .select({ respondedAt: friendRequests.respondedAt })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.senderId, user.id),
          eq(friendRequests.receiverId, targetId),
          eq(friendRequests.status, "DECLINED"),
          gt(friendRequests.respondedAt, cooldownCutoff())
        )
      )
      .limit(1)
    if (cooldown?.respondedAt) {
      return forbidden(c, "این کاربر اخیراً درخواست شما را رد کرده است؛ بعداً تلاش کنید")
    }

    // Friend cap (60 each side) — checked before any friendship is created.
    const [myCount, targetCount] = await Promise.all([
      friendCountOf(user.id),
      friendCountOf(targetId),
    ])
    if (myCount >= MAX_FRIENDS_PER_USER) {
      return forbidden(c, `به سقف دوستان رسیده‌اید (${MAX_FRIENDS_PER_USER} نفر)`)
    }
    if (targetCount >= MAX_FRIENDS_PER_USER || target.autoDecline) {
      return forbidden(c, "امکان ارسال درخواست دوستی وجود ندارد")
    }

    // Mutual pending -> instant friendship, no duplicate rows.
    const [reverse] = await db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.senderId, targetId),
          eq(friendRequests.receiverId, user.id),
          eq(friendRequests.status, "PENDING")
        )
      )
      .limit(1)
    if (reverse) {
      const now = new Date()
      await db.transaction(async (tx) => {
        await tx
          .update(friendRequests)
          .set({ status: "ACCEPTED", respondedAt: now, updatedAt: now })
          .where(eq(friendRequests.id, reverse.id))
        await tx.insert(friendships).values({ userLowId: low, userHighId: high })
      })
      await notifyFriendAccepted(target.id, user)
      audit(`دوستی متقابل: ${personLine(user)} و ${personLine(target)} دوست شدند`)
      return ok(c, { befriended: true }, "شما با هم دوست شدید")
    }

    const [request] = await db
      .insert(friendRequests)
      .values({
        senderId: user.id,
        receiverId: targetId,
        status: "PENDING",
      })
      .returning()
    if (!request) return notFound(c, "ثبت درخواست ممکن نشد")

    await notifyFriendRequest(target.id, user)
    audit(`درخواست دوستی جدید: ${personLine(user)} به ${personLine(target)}`)

    return ok(
      c,
      {
        // Full card so clients can insert it into the pending list instantly.
        request: {
          id: request.id,
          status: request.status,
          createdAt: request.createdAt,
          direction: "outgoing" as const,
          user: toFriendCard(target),
        },
      },
      "درخواست دوستی ارسال شد"
    )
  })
  .post(
    "/me/friends/requests/:id/accept",
    zValidator("param", requestIdParamSchema),
    async (c) => {
      const user = c.get("user")!
      const { id } = c.req.valid("param")

      const [request] = await db
        .select()
        .from(friendRequests)
        .where(eq(friendRequests.id, id))
        .limit(1)
      if (!request || request.receiverId !== user.id) {
        return notFound(c, "درخواستی یافت نشد")
      }
      if (request.status !== "PENDING") {
        return conflict(c, "این درخواست قبلاً پاسخ داده شده است")
      }

      // Re-check the cap: counts may have grown since the request was sent.
      const [myCount, senderCount] = await Promise.all([
        friendCountOf(user.id),
        friendCountOf(request.senderId),
      ])
      if (myCount >= MAX_FRIENDS_PER_USER) {
        return forbidden(c, `به سقف دوستان رسیده‌اید (${MAX_FRIENDS_PER_USER} نفر)`)
      }
      if (senderCount >= MAX_FRIENDS_PER_USER) {
        return forbidden(c, "این کاربر به سقف دوستان رسیده است")
      }

      const [low, high] = friendshipPair(request.senderId, request.receiverId)
      const now = new Date()
      await db.transaction(async (tx) => {
        await tx
          .update(friendRequests)
          .set({ status: "ACCEPTED", respondedAt: now, updatedAt: now })
          .where(eq(friendRequests.id, id))
        // Race cleanup: a reverse pending (both sent at once) resolves too.
        await tx
          .update(friendRequests)
          .set({ status: "ACCEPTED", respondedAt: now, updatedAt: now })
          .where(
            and(
              eq(friendRequests.senderId, request.receiverId),
              eq(friendRequests.receiverId, request.senderId),
              eq(friendRequests.status, "PENDING")
            )
          )
        await tx
          .insert(friendships)
          .values({ userLowId: low, userHighId: high })
          .onConflictDoNothing()
      })

      const [sender] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          telegramUsername: users.telegramUsername,
        })
        .from(users)
        .where(eq(users.id, request.senderId))
        .limit(1)
      if (sender) {
        await notifyFriendAccepted(sender.id, user)
        audit(`پذیرش دوستی: ${personLine(user)} درخواست ${personLine(sender)} را پذیرفت`)
      }

      return ok(c, { befriended: true }, "درخواست دوستی پذیرفته شد")
    }
  )
  .post(
    "/me/friends/requests/:id/decline",
    zValidator("param", requestIdParamSchema),
    async (c) => {
      const user = c.get("user")!
      const { id } = c.req.valid("param")

      const [request] = await db
        .select()
        .from(friendRequests)
        .where(eq(friendRequests.id, id))
        .limit(1)
      if (!request || request.receiverId !== user.id) {
        return notFound(c, "درخواستی یافت نشد")
      }
      if (request.status !== "PENDING") {
        return conflict(c, "این درخواست قبلاً پاسخ داده شده است")
      }

      const now = new Date()
      await db
        .update(friendRequests)
        .set({ status: "DECLINED", respondedAt: now, updatedAt: now })
        .where(eq(friendRequests.id, id))

      const declined = await personOf(request.senderId)
      if (declined) {
        audit(`رد دوستی: ${personLine(user)} درخواست ${personLine(declined)} را رد کرد`)
      }

      return ok(c, null, "درخواست دوستی رد شد")
    }
  )
  .post(
    "/me/friends/requests/:id/cancel",
    zValidator("param", requestIdParamSchema),
    async (c) => {
      const user = c.get("user")!
      const { id } = c.req.valid("param")

      const [request] = await db
        .select()
        .from(friendRequests)
        .where(eq(friendRequests.id, id))
        .limit(1)
      if (!request || request.senderId !== user.id) {
        return notFound(c, "درخواستی یافت نشد")
      }
      if (request.status !== "PENDING") {
        return conflict(c, "این درخواست قبلاً پاسخ داده شده است")
      }

      const now = new Date()
      await db
        .update(friendRequests)
        .set({ status: "CANCELED", respondedAt: now, updatedAt: now })
        .where(eq(friendRequests.id, id))

      const receiver = await personOf(request.receiverId)
      if (receiver) {
        audit(`لغو درخواست دوستی: ${personLine(user)} درخواست به ${personLine(receiver)} را لغو کرد`)
      }

      return ok(c, null, "درخواست دوستی لغو شد")
    }
  )
  .post("/me/friends/blocks", zValidator("json", sendSchema), async (c) => {
    const user = c.get("user")!
    const { friendId: targetId } = c.req.valid("json")

    if (targetId === user.id) {
      return badRequest(c, "نمی‌توانید خودتان را مسدود کنید")
    }
    const [target] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        telegramUsername: users.telegramUsername,
      })
      .from(users)
      .where(eq(users.id, targetId))
      .limit(1)
    if (!target) return notFound(c, "کاربری با این شناسه یافت نشد")

    const [low, high] = friendshipPair(user.id, targetId)
    const now = new Date()
    await db.transaction(async (tx) => {
      // Full block: drop friendship + cancel pendings both ways.
      await tx
        .delete(friendships)
        .where(
          and(eq(friendships.userLowId, low), eq(friendships.userHighId, high))
        )
      await tx
        .update(friendRequests)
        .set({ status: "CANCELED", respondedAt: now, updatedAt: now })
        .where(
          and(
            or(
              and(
                eq(friendRequests.senderId, user.id),
                eq(friendRequests.receiverId, targetId)
              ),
              and(
                eq(friendRequests.senderId, targetId),
                eq(friendRequests.receiverId, user.id)
              )
            ),
            eq(friendRequests.status, "PENDING")
          )
        )
      await tx
        .insert(friendBlocks)
        .values({ blockerId: user.id, blockedId: targetId })
        .onConflictDoNothing()
    })

    audit(`مسدودسازی: ${personLine(user)} کاربر ${personLine(target)} را مسدود کرد`)
    return ok(c, null, "کاربر مسدود شد")
  })
  .get("/me/friends/blocks", async (c) => {
    const user = c.get("user")!
    const { page, limit, offset } = parsePagination(c)

    const rows = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        telegramUsername: users.telegramUsername,
        blockedAt: friendBlocks.createdAt,
      })
      .from(friendBlocks)
      .innerJoin(users, eq(users.id, friendBlocks.blockedId))
      .where(eq(friendBlocks.blockerId, user.id))
      .orderBy(desc(friendBlocks.createdAt))
      .limit(limit + 1)
      .offset(offset)

    const hasMore = rows.length > limit
    const blocked = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      user: toFriendCard(r),
      blockedAt: r.blockedAt,
    }))

    return ok(c, { blocked, page, limit, hasMore })
  })
  .delete(
    "/me/friends/blocks/:friendId",
    zValidator("param", friendIdParamSchema),
    async (c) => {
      const user = c.get("user")!
      const { friendId } = c.req.valid("param")
      const deleted = await db
        .delete(friendBlocks)
        .where(
          and(
            eq(friendBlocks.blockerId, user.id),
            eq(friendBlocks.blockedId, friendId)
          )
        )
        .returning()
      if (deleted.length === 0) return notFound(c, "این کاربر در لیست مسدود نیست")
      const unblocked = await personOf(friendId)
      if (unblocked) {
        audit(`رفع مسدودیت: ${personLine(user)} کاربر ${personLine(unblocked)} را از مسدودیت خارج کرد`)
      }
      return ok(c, null, "کاربر از مسدودی خارج شد")
    }
  )
  .get("/me/friends/settings", async (c) => {
    const user = c.get("user")!
    const [me] = await db
      .select({ autoDecline: users.autoDeclineFriendRequests })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    return ok(c, { autoDecline: me?.autoDecline ?? false })
  })
  .patch("/me/friends/settings", zValidator("json", settingsSchema), async (c) => {
    const user = c.get("user")!
    const { autoDecline } = c.req.valid("json")
    const [updated] = await db
      .update(users)
      .set({ autoDeclineFriendRequests: autoDecline, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning({ autoDecline: users.autoDeclineFriendRequests })
    if (!updated) return notFound(c, "کاربر یافت نشد")
    return ok(
      c,
      { autoDecline: updated.autoDecline },
      autoDecline ? "رد خودکار درخواست‌ها فعال شد" : "رد خودکار درخواست‌ها غیرفعال شد"
    )
  })
