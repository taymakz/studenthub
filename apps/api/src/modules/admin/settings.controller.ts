import { appSettings } from "@workspace/db/schema"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { zValidator } from "@hono/zod-validator"
import { db } from "@/lib/db"
import { badRequest, ok } from "@/lib/http/common"
import { sendAdminMessage } from "@/lib/telegram/admin"
import type { AppEnv } from "@/middleware/auth"
import { requireAdmin, withAdmin } from "@/middleware/auth"
import { invalidateMaintenanceCache } from "@/middleware/maintenance"

/**
 * Singleton app settings — exactly one row (id = 'app').
 * Read: any authenticated admin. Write: SUPERADMIN only.
 */

const settingsUpdateSchema = z.object({
  maintenanceMode: z.enum(["on", "off"]).optional(),
  maintenanceReason: z.string().max(500).nullable().optional(),
})

export const adminSettingsRoutes = new Hono<AppEnv>()
  .use("*", withAdmin, requireAdmin)
  .get("/settings", async (c) => {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, "app"))
      .limit(1)

    if (!row) {
      // Auto-create default row on first read
      const [created] = await db
        .insert(appSettings)
        .values({ id: "app" })
        .returning()
      return ok(c, {
        maintenanceMode: created?.maintenanceMode ?? "off",
        maintenanceReason: created?.maintenanceReason ?? null,
      })
    }

    return ok(c, {
      maintenanceMode: row.maintenanceMode,
      maintenanceReason: row.maintenanceReason,
    })
  })
  .put(
    "/settings",
    requireAdmin,
    zValidator("json", settingsUpdateSchema),
    async (c) => {
      const body = c.req.valid("json")
      if (
        body.maintenanceMode === undefined &&
        body.maintenanceReason === undefined
      ) {
        return badRequest(c, "هیچ فیلدی برای به‌روزرسانی ارسال نشده")
      }

      // Upsert the singleton row
      const [existing] = await db
        .select({ id: appSettings.id })
        .from(appSettings)
        .where(eq(appSettings.id, "app"))
        .limit(1)

      if (!existing) {
        await db.insert(appSettings).values({
          id: "app",
          maintenanceMode: body.maintenanceMode ?? "off",
          maintenanceReason: body.maintenanceReason ?? null,
        })
      } else {
        const updates: Record<string, unknown> = { updatedAt: new Date() }
        if (body.maintenanceMode !== undefined)
          updates.maintenanceMode = body.maintenanceMode
        if (body.maintenanceReason !== undefined)
          updates.maintenanceReason = body.maintenanceReason
        await db
          .update(appSettings)
          .set(updates)
          .where(eq(appSettings.id, "app"))
      }

      invalidateMaintenanceCache()
      if (body.maintenanceMode !== undefined) {
        const modeText = body.maintenanceMode === "on" ? "🔧 تعمیرات فعال شد" : "✅ تعمیرات غیرفعال شد"
        const reason = body.maintenanceReason ? `\nدلیل: ${body.maintenanceReason}` : ""
        const actor = c.get("adminChatId")
        void sendAdminMessage(
          "DEFAULT",
          `${modeText}${reason}\nتوسط: <code>${actor ?? "—"}</code>`,
          { parseMode: "HTML" }
        ).catch(() => {})
      }
      return ok(c, null, "تنظیمات ذخیره شد")
    }
  )
