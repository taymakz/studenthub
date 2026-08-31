import { appSettings, users } from "@workspace/db/schema"
import { createMiddleware } from "hono/factory"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import type { AppEnv } from "@/middleware/auth"

/**
 * Maintenance mode gate — blocks all mini-app endpoints when maintenance is on.
 * Admin routes are NOT affected (admins need access during maintenance).
 *
 * Caches the setting for 30 seconds to avoid a DB query on every request.
 */
let cachedMode: string | null = null
let cachedReason: string | null = null
let cachedAt = 0
const CACHE_TTL_MS = 30_000

async function getMaintenanceState(): Promise<{
  mode: string
  reason: string | null
}> {
  const now = Date.now()
  if (cachedMode !== null && now - cachedAt < CACHE_TTL_MS) {
    return { mode: cachedMode, reason: cachedReason }
  }
  try {
    const [row] = await db
      .select({
        maintenanceMode: appSettings.maintenanceMode,
        maintenanceReason: appSettings.maintenanceReason,
      })
      .from(appSettings)
      .where(eq(appSettings.id, "app"))
      .limit(1)
    cachedMode = row?.maintenanceMode ?? "off"
    cachedReason = row?.maintenanceReason ?? null
  } catch (err) {
    // Table may not exist in local/dev databases — treat as maintenance off.
    console.warn(
      "maintenanceGate: failed to read app_settings, defaulting to off:",
      err instanceof Error ? err.message : err
    )
    cachedMode = "off"
    cachedReason = null
  }
  cachedAt = now
  return { mode: cachedMode, reason: cachedReason }
}

async function getMaintenanceMode(): Promise<string> {
  const s = await getMaintenanceState()
  return s.mode
}

export function invalidateMaintenanceCache(): void {
  cachedMode = null
  cachedAt = 0
}

export const maintenanceGate = createMiddleware<AppEnv>(async (c, next) => {
  const { mode, reason } = await getMaintenanceState()
  if (mode === "on") {
    // Only trust validated auth — withUser/withAdmin already verified HMAC/JWT.
    // Never infer SUPERADMIN from raw unverified tma header (prevents bypass).
    const user = c.get("user") as { role?: string } | null
    const adminRole = c.get("adminRole") as string | null
    const role = user?.role ?? adminRole ?? null
    const isSuperadmin = role === "SUPERADMIN"
    const bypassHeader =
      c.req.header("x-bypass-maintenance") ??
      c.req.header("X-Bypass-Maintenance")
    const wantsBypass = bypassHeader === "1" || c.req.query("bypass") === "1"

    // Superadmin explicitly requested bypass → let the request through
    if (isSuperadmin && wantsBypass) {
      await next()
      return
    }

    // Echo the resolved role back so the client can show the superadmin bypass
    // button even on a fresh load (hard-nav to /maintenance wipes the in-memory
    // store — the persisted role is the source of truth there).
    return c.json(
      {
        success: false,
        message: "برنامه در حال تعمیر و نگهداری است",
        data: {
          maintenance: true,
          maintenanceReason: reason,
          role,
          canBypass: isSuperadmin,
        },
      },
      503
    )
  }
  await next()
})
