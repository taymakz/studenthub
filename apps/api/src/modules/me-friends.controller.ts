import { zValidator } from "@hono/zod-validator"
import {
  FRIEND_REQUEST_COOLDOWN_DAYS,
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
 * - Reverse PENDING on send -> instant auto-befriend (no duplicate rows).
 * - Receiver with autoDeclineFriendRequests -> request stored as DECLINED
 *   (cooldown applies like a manual decline).
 * - Decline (manual or auto) starts a 1-month cooldown for the sender.
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
  receiver: PersonInfo & { id: number },
  sender: PersonInfo
): Promise<void> {
  await sendMessage(
    receiver.id,
    `درخواست دوستی جدید\nاز: ${personLine(sender)}\nبه: ${personLine(receiver)}\nبخش پروفایل ← دوستای من`
  )
}

async function notifyFriendAccepted(
  requester: PersonInfo & { id: number },
  accepter: PersonInfo
): Promise<void> {
  await sendMessage(
    requester.id,
    `درخواست دوستی شما پذیرفته شد\nاز: ${personLine(accepter)}\nبه: ${personLine(requester)}`
  )
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

export const meFriendRoutes = new Hono<AppEnv>()
  .use("*", withUser, requireUser)
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
      await notifyFriendAccepted(target, user)
      return ok(c, { befriended: true }, "شما با هم دوست شدید")
    }

    const now = new Date()
    const [request] = await db
      .insert(friendRequests)
      .values({
        senderId: user.id,
        receiverId: targetId,
        status: target.autoDecline ? "DECLINED" : "PENDING",
        respondedAt: target.autoDecline ? now : null,
      })
      .returning()
    if (!request) return notFound(c, "ثبت درخواست ممکن نشد")

    if (request.status === "PENDING") {
      await notifyFriendRequest(target, user)
    }

    return ok(
      c,
      { request: { id: request.id, status: request.status } },
      target.autoDecline
        ? "این کاربر درخواست‌ها را خودکار رد می‌کند"
        : "درخواست دوستی ارسال شد"
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
      if (sender) await notifyFriendAccepted(sender, user)

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
      .select({ id: users.id })
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
