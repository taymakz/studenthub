import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

import { forbidden } from "@/lib/http/common"
import type { AppEnv } from "@/middleware/auth"

/**
 * Role-based access — replaces the previous DB-backed RBAC.
 *
 * Roles:
 *   USER           — regular mini-app user, no admin access
 *   ADMIN          — full admin (users, uploads, feedback, stats, notifications)
 *   SUPERADMIN     — all plus role management
 *   NOTIFICATIONER — only notification pipeline (detect + send)
 */

export type UserRole = "USER" | "ADMIN" | "SUPERADMIN" | "NOTIFICATIONER"

export const ROLES = {
  USER: "USER",
  ADMIN: "ADMIN",
  SUPERADMIN: "SUPERADMIN",
  NOTIFICATIONER: "NOTIFICATIONER",
} as const

export function hasRole(
  role: string | null,
  allowed: readonly UserRole[]
): boolean {
  if (!role) return false
  if (role === "SUPERADMIN") return true
  return (allowed as readonly string[]).includes(role)
}

export const requireRole = (...allowed: UserRole[]) =>
  createMiddleware<AppEnv>(async (c: Context<AppEnv>, next) => {
    const role = c.get("adminRole")
    if (!role || !hasRole(role, allowed)) {
      return forbidden(c, "این عملیات مجاز نیست")
    }
    await next()
  })

// Convenience guards
export const requireAdmin = requireRole("ADMIN", "SUPERADMIN")
export const requireSuperAdmin = requireRole("SUPERADMIN")
export const requireNotificationAccess = requireRole(
  "NOTIFICATIONER",
  "ADMIN",
  "SUPERADMIN"
)
