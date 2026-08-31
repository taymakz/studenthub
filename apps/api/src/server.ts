import type { AppEnv } from "@/middleware/auth"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { requestId } from "hono/request-id"
import { secureHeaders } from "hono/secure-headers"

import { config } from "@/config"
import { internalServerError, notFound } from "@/lib/http/common"
import { withAdmin, withUser } from "@/middleware/auth"
import {
  authRateLimit,
  exportRateLimit,
  globalRateLimit,
  profileRateLimit,
  uploadRateLimit,
} from "@/middleware/rate-limit"
import routes from "@/routes"

/**
 * The Hono app. Auth middlewares run globally but only RESOLVE identities -
 * every protected controller applies requireUser/requireAdmin itself.
 *
 * Rate limiting is in-memory (no Redis per AGENTS.md) — see
 * `middleware/rate-limit.ts` for the window/cleanup strategy. Global limit
 * runs first; sensitive routes add stricter scoped limits below.
 */
const app = new Hono<AppEnv>()
  .use(requestId())
  .use(logger())
  .use(secureHeaders())
  // Global safety net — throttles runaway clients without hurting normal use.
  .use(globalRateLimit)
  .use(
    cors({
      origin: config.CORS_ALLOWED_ORIGIN.split(",")
        .map((o) => o.trim())
        .filter(Boolean),
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "authorization",
        "x-bypass-maintenance",
        "X-Bypass-Maintenance",
      ],
      exposeHeaders: ["X-Request-Id"],
    })
  )
  .use(withUser)
  .use(withAdmin)
  // Scoped limits for abuse-prone surfaces (applied by path prefix, after auth
  // so per-user scoping can be used when a user is known).
  .use("/api/me/uploads*", uploadRateLimit)
  .use("/api/me/export-image/*", exportRateLimit)
  .use("/api/me/profile", profileRateLimit)
  .use("/api/admin/auth/*", authRateLimit)
  .route("/api", routes)
  .notFound((c) => notFound(c, `مسیر پیدا نشد: ${c.req.path}`))
  .onError((error, c) => {
    console.error("Unhandled error:", error?.message ?? error)
    console.error(error instanceof Error ? error.stack : "")
    // Ensure CORS headers are present even on unhandled errors — without
    // them the browser reports a misleading CORS error instead of the
    // actual server error.
    const origins = config.CORS_ALLOWED_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
    const requestOrigin = c.req.header("origin") ?? ""
    if (origins.includes(requestOrigin)) {
      c.header("Access-Control-Allow-Origin", requestOrigin)
      c.header("Access-Control-Allow-Credentials", "true")
    }
    // Return the actual error message so it's visible in the browser
    // (remove in production once debugging is complete)
    const msg = error instanceof Error ? error.message : String(error)
    return c.json({ success: false, message: msg }, { status: 500 })
  })

export default app
