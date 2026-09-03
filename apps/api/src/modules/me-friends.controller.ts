import { zValidator } from "@hono/zod-validator"
import {
  FRIEND_REQUEST_COOLDOWN_DAYS,
  friendBlocks,
  friendRequests,
  friendships,
  friendshipPair,
  users,
} from "@workspace/db/schema"
import { and, desc, eq, gt, or, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { db } from "@/lib/db"
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  parsePagination,
} from "@/lib/http/common"
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
}) {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    photoUrl: row.photoUrl,
  }
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
    const friends = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      ...toFriendCard(r),
      friendsSince: r.friendsSince,
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
