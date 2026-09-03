import {
  bigint,
  boolean,
  check,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import type { InferInsertModel, InferSelectModel } from "drizzle-orm"

import { users } from "./users"

/**
 * Friend system (user-to-user social graph).
 *
 * - `friendRequests` are directed (sender -> receiver). History rows are kept
 *   even after ACCEPT/DECLINE/CANCEL: the latest DECLINED row per
 *   (sender, receiver) pair enforces the 1-month re-request cooldown.
 * - `friendships` are undirected with canonical ordering
 *   (`userLowId < userHighId`) so each pair has exactly one row.
 * - `friendBlocks` are directed (blocker -> blocked). While a block exists in
 *   either direction, no request may be sent between the pair.
 *
 * All user ids are Telegram chat ids (`users.id`), cascaded on user delete.
 */
export const friendRequestStatusEnum = pgEnum("friend_request_status", [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "CANCELED",
])

export const friendRequests = pgTable(
  "friend_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    senderId: bigint("sender_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    receiverId: bigint("receiver_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    status: friendRequestStatusEnum("status").notNull().default("PENDING"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When the receiver (or auto-decline) resolved a PENDING request. */
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "friend_requests_no_self_request",
      sql`${table.senderId} <> ${table.receiverId}`
    ),
    index("friend_requests_sender_idx").on(table.senderId, table.status),
    index("friend_requests_receiver_idx").on(table.receiverId, table.status),
  ]
)

export const friendships = pgTable(
  "friendships",
  {
    userLowId: bigint("user_low_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHighId: bigint("user_high_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userLowId, table.userHighId],
      name: "friendships_pkey",
    }),
    check(
      "friendships_canonical_order",
      sql`${table.userLowId} < ${table.userHighId}`
    ),
    index("friendships_high_idx").on(table.userHighId),
  ]
)

export const friendBlocks = pgTable(
  "friend_blocks",
  {
    blockerId: bigint("blocker_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: bigint("blocked_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.blockerId, table.blockedId],
      name: "friend_blocks_pkey",
    }),
    check(
      "friend_blocks_no_self_block",
      sql`${table.blockerId} <> ${table.blockedId}`
    ),
    index("friend_blocks_blocked_idx").on(table.blockedId),
  ]
)

export type FriendRequest = InferSelectModel<typeof friendRequests>
export type NewFriendRequest = InferInsertModel<typeof friendRequests>
export type Friendship = InferSelectModel<typeof friendships>
export type NewFriendship = InferInsertModel<typeof friendships>
export type FriendBlock = InferSelectModel<typeof friendBlocks>
export type NewFriendBlock = InferInsertModel<typeof friendBlocks>

/** Canonical (low, high) ordering for an undirected friendship pair. */
export function friendshipPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a]
}

/** Months-equivalent cooldown after a DECLINED request before re-requesting. */
export const FRIEND_REQUEST_COOLDOWN_DAYS = 30
