import type { AppEnv } from "@/middleware/auth"
import { maintenanceGate } from "@/middleware/maintenance"
import { Hono } from "hono"

import { ok } from "@/lib/http/common"
import {
  adminAuthRoutes,
  adminRbacRoutes,
  adminRegistryMetaRoutes,
  adminUsersRoutes,
} from "@/modules/admin/auth-users.controller"
import {
  adminFeedbackRoutes,
  meFeedbackRoutes,
} from "@/modules/admin/feedback-stats.controller"
import {
  adminNotificationsRoutes,
  adminUploadsRoutes,
} from "@/modules/admin/notifications-uploads.controller"
import { adminSettingsRoutes } from "@/modules/admin/settings.controller"
import { appRegistryRoutes } from "@/modules/app/registry.controller"
import { meRoutes } from "@/modules/me.controller"
import { meFriendRoutes } from "@/modules/me-friends.controller"
import { meVoteRoutes } from "@/modules/me-votes.controller"
import { telegramWebAuthRoutes } from "@/modules/auth/telegram-web.controller"

/**
 * Two surfaces only - there is no public API:
 *   /app/*   mini app, stateless `tma <initData>` on every request
 *   /admin/* dashboard, OTP session (1 year) + DB-backed RBAC
 * plus the stateless /me/* user-data routes.
 */
const routes = new Hono<AppEnv>()
  .get("/health", (c) =>
    ok(c, {
      status: "healthy",
      time: new Date().toISOString(),
      env: process.env.APP_ENV ?? "development",
    })
  )
  .use("/app/*", maintenanceGate)
  .use("/me", maintenanceGate)
  .use("/me/*", maintenanceGate)
  .route("/app", appRegistryRoutes)
  .route("/admin", adminAuthRoutes)
  .route("/admin", adminUsersRoutes)
  .route("/admin", adminRbacRoutes)
  .route("/admin", adminRegistryMetaRoutes)
  .route("/admin", adminNotificationsRoutes)
  .route("/admin", adminUploadsRoutes)
  .route("/admin", adminFeedbackRoutes)
  .route("/admin", adminSettingsRoutes)
  // Web Telegram Login (stateless widget / OIDC) — mints app JWT for browser users
  .route("/", telegramWebAuthRoutes)
  // Root-level mini-app routers last (their guards must not shadow /app|/admin).
  .route("/", meRoutes)
  .route("/", meFriendRoutes)
  .route("/", meVoteRoutes)
  .route("/", meFeedbackRoutes)

export default routes
