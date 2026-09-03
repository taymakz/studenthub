import type { FriendCard } from "@/lib/api"

/** "@username" subtitle, falling back to the numeric id. */
export function userSubtitle(user: FriendCard): string {
  return user.username ? `@${user.username}` : `شناسه: ${user.id}`
}
