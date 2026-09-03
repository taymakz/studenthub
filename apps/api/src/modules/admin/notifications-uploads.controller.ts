import { zValidator } from "@hono/zod-validator"
import { notificationBatches, uploads, users } from "@workspace/db/schema"
import type { Semester } from "@workspace/registry"
import { and, desc, eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { randomUUID } from "node:crypto"

import { db } from "@/lib/db"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
} from "@/lib/http/common"
import {
  completeBatchDiff,
  completeOfferingDiff,
  createAnnouncementBatch,
  detectAndCreateBatch,
  listBatchMessages,
  listBatches,
  sendNextMessage,
} from "@/lib/notifications/service"
import { validateFileSize, MAX_UPLOAD_BYTES } from "@workspace/ui/lib/file"
import {
  deleteExportObject,
  getExportBytes,
  isExportStorageConfigured,
  presignExportPut,
} from "@/lib/storage/s3"
import { fetchUrlBytesLimited } from "@/lib/net"
import {
  ingestFile,
  ingestMedia,
  sendMessage,
  sendRichMessage,
  sendStoredFile,
  sendWithFile,
} from "@/lib/telegram/bot"
import { parseTermCode } from "@/lib/terms"
import { requireRole } from "@/lib/rbac"
import type { AppEnv } from "@/middleware/auth"
import { requireAdmin, withAdmin } from "@/middleware/auth"

/**
 * Admin surface (part 2): Notification Center + upload moderation.
 *
 * The send flow is intentionally ONE-message-per-request: the dashboard's
 * «شروع ارسال» button drives a loop of POST /send-next while the admin keeps
 * the tab open - serverless functions can't hold the long fan-out, and each
 * committed row makes the whole campaign crash-resumable.
 */

const MESSAGE_STATUSES = ["PENDING", "SENDING", "SENT", "FAILED"] as const
type MessageStatus = (typeof MESSAGE_STATUSES)[number]

/** Term selector: «1405 مهر» as year+semester, or the website code 4051. */
const termSelector = z.object({
  universitySlug: z.string().min(1),
  majorSlug: z.string().min(1),
  year: z.number().int().min(1300).max(1500).optional(),
  semester: z.enum(["MEHR", "BAHMAN", "SUMMER"]).optional(),
  termCode: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
})

const detectSchema = termSelector.refine(
  (v) =>
    (v.year !== undefined && v.semester !== undefined) ||
    v.termCode !== undefined,
  { message: "year+semester یا termCode الزامی است" }
)

const announcementSchema = z.object({
  body: z.string().min(3).max(3500),
  /** Advanced audience filter - all optional, combine freely:
       دانشگاه / رشته / سال‌های ورود / ترم ورود / جنسیت. Omit everything for a
       platform-wide broadcast. Supports single or multi (persian "همه" = all). */
  universitySlug: z.string().min(1).optional(),
  universitySlugs: z.array(z.string().min(1)).max(10).optional(),
  majorSlug: z.string().min(1).optional(),
  majorSlugs: z.array(z.string().min(1)).max(10).optional(),
  entryYears: z.array(z.number().int().min(1300).max(1500)).max(10).optional(),
  entrySemester: z.enum(["MEHR", "BAHMAN", "SUMMER"]).optional(),
  entrySemesters: z
    .array(z.enum(["MEHR", "BAHMAN", "SUMMER"]))
    .max(3)
    .optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  genders: z
    .array(z.enum(["MALE", "FEMALE"]))
    .max(2)
    .optional(),
  parseMode: z.enum(["HTML", "Markdown", "MarkdownV2"]).optional(),
  photoUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  documentUrl: z.string().url().optional(),
  photoFileId: z.string().min(10).max(255).optional(),
  videoFileId: z.string().min(10).max(255).optional(),
  documentFileId: z.string().min(10).max(255).optional(),
  buttons: z
    .array(
      z.array(
        z.object({ text: z.string().min(1).max(64), url: z.string().url() })
      )
    )
    .max(8)
    .optional(),
  disablePreview: z.boolean().optional(),
})

const singleSchema = z
  .object({
    chatId: z.number().int().positive(),
    body: z.string().min(1).max(4096).optional(),
    text: z.string().min(1).max(4096).optional(),
    parseMode: z.enum(["HTML", "Markdown", "MarkdownV2"]).optional(),
    photoUrl: z.string().url().optional(),
    videoUrl: z.string().url().optional(),
    documentUrl: z.string().url().optional(),
    photoFileId: z.string().min(10).max(255).optional(),
    videoFileId: z.string().min(10).max(255).optional(),
    documentFileId: z.string().min(10).max(255).optional(),
    buttons: z
      .array(
        z.array(
          z.object({ text: z.string().min(1).max(64), url: z.string().url() })
        )
      )
      .max(8)
      .optional(),
    disablePreview: z.boolean().optional(),
    includeGreeting: z.boolean().optional(),
    greetingTemplate: z.string().max(200).optional(),
    includeButton: z.boolean().optional(),
  })
  .refine((d) => Boolean(d.body ?? d.text), { message: "متن پیام الزامی است" })

function resolveDetectTerm(input: {
  year?: number
  semester?: "MEHR" | "BAHMAN" | "SUMMER"
  termCode?: string
}): { year: number; semester: Semester } | null {
  if (input.termCode) return parseTermCode(input.termCode)
  if (input.year && input.semester) {
    return { year: input.year, semester: input.semester }
  }
  return null
}

export const adminNotificationsRoutes = new Hono<AppEnv>()
  .use("*", withAdmin, requireAdmin)
  .get(
    "/notifications/batches",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      // ?type= powers the Broadcast page (ANNOUNCEMENT) vs the detect-driven
      // pipeline list (COURSE_CHANGES). Progress fields ride on each row.
      const type = c.req.query("type")?.toUpperCase() ?? ""
      let batches = await listBatches()
      if (type === "ANNOUNCEMENT" || type === "COURSE_CHANGES") {
        batches = batches.filter((b) => b.type === type)
      }
      return ok(c, { batches })
    }
  )
  .get(
    "/notifications/batches/:id",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      const id = c.req.param("id")
      const batch = (await listBatches()).find((b) => b.id === id)
      if (!batch) return notFound(c, "دسته اعلان پیدا نشد")
      return ok(c, { batch })
    }
  )
  .get(
    "/notifications/batches/:id/messages",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      const id = c.req.param("id")
      const raw = c.req.query("status")?.toUpperCase() ?? ""
      const status = MESSAGE_STATUSES.includes(raw as MessageStatus)
        ? (raw as MessageStatus)
        : undefined
      return ok(c, { messages: await listBatchMessages(id, status) })
    }
  )
  .post(
    "/notifications/detect-all",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      const adminChatId = c.get("adminChatId")!
      let includeGreeting: boolean | undefined
      let greetingTemplate: string | undefined
      let includeButton: boolean | undefined
      try {
        const body = await c.req.json().catch(() => null as any)
        if (body && typeof body === "object") {
          if (typeof (body as any).includeGreeting === "boolean")
            includeGreeting = (body as any).includeGreeting
          if (typeof (body as any).greetingTemplate === "string")
            greetingTemplate = (body as any).greetingTemplate
          if (typeof (body as any).includeButton === "boolean")
            includeButton = (body as any).includeButton
        }
      } catch {}
      try {
        const { detectAllAndCreateBatches } =
          await import("@/lib/notifications/service.ts")
        const result = await detectAllAndCreateBatches(adminChatId, {
          includeGreeting,
          greetingTemplate,
          includeButton,
        })
        return ok(
          c,
          result,
          result.created > 0
            ? `${result.created} دسته جدید ساخته شد`
            : "تغییری یافت نشد"
        )
      } catch (error) {
        console.error("detect-all failed:", error)
        return internalServerError(c)
      }
    }
  )
  .post(
    "/notifications/detect",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    zValidator("json", detectSchema),
    async (c) => {
      const input = c.req.valid("json")
      const adminChatId = c.get("adminChatId")!

      const term = resolveDetectTerm(input)
      if (!term) return conflict(c, "ترم نامعتبر است")

      try {
        const result = await detectAndCreateBatch({
          universitySlug: input.universitySlug,
          majorSlug: input.majorSlug,
          year: term.year,
          semester: term.semester,
          adminChatId,
        })
        return ok(
          c,
          {
            batch: result.batch,
            summary: result.summary,
            recipients: result.recipients,
            termCode: `${term.year}/${term.semester.toLowerCase()}`,
          },
          "دسته اعلان ساخته شد"
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : ""
        if (message === "SNAPSHOT_NOT_FOUND") {
          return notFound(c, "اسنپ‌شات این ترم در رجیستری پیدا نشد")
        }
        if (message === "NO_CHANGES" || message === "NO_RECIPIENTS") {
          return conflict(
            c,
            message === "NO_CHANGES"
              ? "تغییری نسبت به اسنپ‌شات قبلی پیدا نشد"
              : "دانشجویی برای این رشته ثبت‌نام نکرده"
          )
        }
        console.error("detect failed:", error)
        return internalServerError(c)
      }
    }
  )
  .post(
    "/notifications/announcements",
    requireRole("ADMIN", "SUPERADMIN"),
    async (c) => {
      const ct = c.req.header("content-type") ?? ""
      let body: string
      let universitySlug: string | null = null
      let universitySlugs: string[] | null = null
      let majorSlug: string | null = null
      let majorSlugs: string[] | null = null
      let entryYears: number[] | null = null
      let entrySemester: "MEHR" | "BAHMAN" | "SUMMER" | null = null
      let entrySemesters: Array<"MEHR" | "BAHMAN" | "SUMMER"> | null = null
      let gender: "MALE" | "FEMALE" | null = null
      let genders: Array<"MALE" | "FEMALE"> | null = null
      let parseMode: "HTML" | "Markdown" | "MarkdownV2" | null = null
      let photoUrl: string | null = null
      let videoUrl: string | null = null
      let documentUrl: string | null = null
      let photoFileId: string | null = null
      let videoFileId: string | null = null
      let documentFileId: string | null = null
      let buttons: { text: string; url: string }[][] | null = null
      let disablePreview: boolean | null = null
      let file: File | null = null

      const parseMaybeArray = (v: unknown): string[] | null => {
        if (!v) return null
        try {
          const parsed = JSON.parse(String(v))
          if (Array.isArray(parsed)) {
            const arr = parsed.map(String).filter(Boolean)
            return arr
          }
        } catch {}
        const s = String(v).trim()
        if (!s || s === "همه") return null
        return s
          .split(/[،,]+/)
          .map((x) => x.trim())
          .filter(Boolean)
      }

      if (ct.includes("multipart/form-data")) {
        const form = await c.req.parseBody()
        body = String(form["body"] ?? form["text"] ?? "")
        // Single or multi – support both "universitySlug" and "universitySlugs"
        const uniRaw = (form["universitySlugs"] ??
          form["universitySlug"]) as unknown
        universitySlugs = parseMaybeArray(uniRaw)
        if (universitySlugs && universitySlugs.length > 10)
          return badRequest(c, "حداکثر ۱۰ دانشگاه")
        universitySlug =
          universitySlugs?.[0] ??
          (form["universitySlug"] ? String(form["universitySlug"]) : null)
        const majorRaw = (form["majorSlugs"] ?? form["majorSlug"]) as unknown
        majorSlugs = parseMaybeArray(majorRaw)
        if (majorSlugs && majorSlugs.length > 10)
          return badRequest(c, "حداکثر ۱۰ رشته")
        majorSlug =
          majorSlugs?.[0] ??
          (form["majorSlug"] ? String(form["majorSlug"]) : null)
        if (form["entryYears"]) {
          try {
            const v = JSON.parse(String(form["entryYears"]))
            entryYears = Array.isArray(v) ? v : null
            if (entryYears && entryYears.length > 10)
              return badRequest(c, "حداکثر ۱۰ سال ورود")
          } catch {
            entryYears = null
          }
        }
        const semRaw = (form["entrySemesters"] ??
          form["entrySemester"]) as unknown
        entrySemesters = parseMaybeArray(semRaw) as any
        if (entrySemesters && entrySemesters.length > 3)
          return badRequest(c, "حداکثر ۳ ترم ورود")
        entrySemester =
          (entrySemesters?.[0] as any) ??
          (form["entrySemester"]
            ? (String(form["entrySemester"]) as any)
            : null)
        const genderRaw = (form["genders"] ?? form["gender"]) as unknown
        genders = parseMaybeArray(genderRaw) as any
        if (genders && genders.length > 2)
          return badRequest(c, "حداکثر ۲ جنسیت")
        gender =
          (genders?.[0] as any) ??
          (form["gender"]
            ? (String(form["gender"]) as unknown as typeof gender)
            : null)
        const pm = form["parseMode"] ? String(form["parseMode"]) : null
        if (pm === "HTML" || pm === "Markdown" || pm === "MarkdownV2")
          parseMode = pm
        photoUrl = form["photoUrl"] ? String(form["photoUrl"]) : null
        videoUrl = form["videoUrl"] ? String(form["videoUrl"]) : null
        documentUrl = form["documentUrl"] ? String(form["documentUrl"]) : null
        photoFileId = form["photoFileId"] ? String(form["photoFileId"]) : null
        videoFileId = form["videoFileId"] ? String(form["videoFileId"]) : null
        documentFileId = form["documentFileId"]
          ? String(form["documentFileId"])
          : null
        if (form["buttons"]) {
          try {
            buttons = JSON.parse(String(form["buttons"]))
          } catch {
            return badRequest(c, "فرمت دکمه‌ها نامعتبر است")
          }
        }
        if (form["disablePreview"] !== undefined)
          disablePreview = String(form["disablePreview"]) === "true"
        const f = (form["file"] ??
          form["photo"] ??
          form["video"] ??
          form["document"]) as unknown
        if (f instanceof File) {
          file = f
          const check = validateFileSize(file)
          if (!check.ok)
            return badRequest(c, check.error ?? "فایل بزرگتر از 4MB است")
        }
        // Validate multipart fields against the same schema as JSON branch
        {
          const candidate = {
            body,
            universitySlug: universitySlugs?.[0] ?? universitySlug ?? undefined,
            universitySlugs: universitySlugs ?? undefined,
            majorSlug: majorSlugs?.[0] ?? majorSlug ?? undefined,
            majorSlugs: majorSlugs ?? undefined,
            entryYears: entryYears ?? undefined,
            entrySemester: entrySemesters?.[0] ?? entrySemester ?? undefined,
            entrySemesters: entrySemesters ?? undefined,
            gender: genders?.[0] ?? gender ?? undefined,
            genders: genders ?? undefined,
            parseMode: parseMode ?? undefined,
            photoUrl: photoUrl ?? undefined,
            videoUrl: videoUrl ?? undefined,
            documentUrl: documentUrl ?? undefined,
            photoFileId: photoFileId ?? undefined,
            videoFileId: videoFileId ?? undefined,
            documentFileId: documentFileId ?? undefined,
            buttons: buttons ?? undefined,
            disablePreview: disablePreview ?? undefined,
          }
          const parsed = announcementSchema.safeParse(candidate)
          if (!parsed.success)
            return badRequest(
              c,
              parsed.error.issues[0]?.message ?? "ورودی نامعتبر"
            )
          const d = parsed.data as any
          body = d.body
          universitySlug = d.universitySlug ?? null
          universitySlugs = d.universitySlugs ?? null
          majorSlug = d.majorSlug ?? null
          majorSlugs = d.majorSlugs ?? null
          entryYears = d.entryYears ?? null
          entrySemester = d.entrySemester ?? null
          entrySemesters = d.entrySemesters ?? null
          gender = d.gender ?? null
          genders = d.genders ?? null
        }
      } else {
        const json = (await c.req.json().catch(() => null)) as Record<
          string,
          unknown
        > | null
        if (!json) return badRequest(c, "بدنه درخواست نامعتبر است")
        const parsed = announcementSchema.safeParse(json)
        if (!parsed.success)
          return badRequest(
            c,
            parsed.error.issues[0]?.message ?? "ورودی نامعتبر"
          )
        const d = parsed.data
        body = d.body
        universitySlug = (d as any).universitySlug ?? null
        universitySlugs = (d as any).universitySlugs ?? null
        majorSlug = (d as any).majorSlug ?? null
        majorSlugs = (d as any).majorSlugs ?? null
        entryYears = d.entryYears ?? null
        entrySemester = (d as any).entrySemester ?? null
        entrySemesters = (d as any).entrySemesters ?? null
        gender = (d as any).gender ?? null
        genders = (d as any).genders ?? null
        parseMode = d.parseMode ?? null
        photoUrl = d.photoUrl ?? null
        videoUrl = d.videoUrl ?? null
        documentUrl = d.documentUrl ?? null
        photoFileId =
          (d as unknown as { photoFileId?: string }).photoFileId ?? null
        videoFileId =
          (d as unknown as { videoFileId?: string }).videoFileId ?? null
        documentFileId =
          (d as unknown as { documentFileId?: string }).documentFileId ?? null
        buttons = (d.buttons as unknown as typeof buttons) ?? null
        disablePreview = d.disablePreview ?? null
      }

      if (!body || body.trim().length < 3)
        return badRequest(c, "متن پیام الزامی است")
      const adminChatId = c.get("adminChatId")!

      // Handle file upload for broadcast – upload once to get fileId for reuse across all recipients (4MB Vercel limit)
      // photoFileId/videoFileId/documentFileId already holds pasted fileId (if any); file upload overwrites it
      if (file) {
        const mime = file.type || ""
        const name = file.name || "attachment"
        let mediaType: "photo" | "video" | "document" = "document"
        if (mime.startsWith("image/")) mediaType = "photo"
        else if (mime.startsWith("video/")) mediaType = "video"
        else {
          const ext = name.split(".").pop()?.toLowerCase() ?? ""
          if (["jpg", "jpeg", "png", "webp"].includes(ext)) mediaType = "photo"
          else if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext))
            mediaType = "video"
        }
        const ing = await ingestMedia(file, name, mediaType)
        if (!ing.ok) return badRequest(c, `آپلود ناموفق: ${ing.error}`)
        if (mediaType === "photo") photoFileId = ing.fileId
        else if (mediaType === "video") videoFileId = ing.fileId
        else documentFileId = ing.fileId
      }

      try {
        const result = await createAnnouncementBatch({
          body: body.trim(),
          universitySlug,
          universitySlugs,
          majorSlug,
          majorSlugs,
          entryYears,
          entrySemester,
          entrySemesters,
          gender,
          genders,
          parseMode,
          photoUrl,
          videoUrl,
          documentUrl,
          photoFileId,
          videoFileId,
          documentFileId,
          buttons,
          disablePreview,
          adminChatId,
        } as any)
        return ok(
          c,
          { batch: result.batch, recipients: result.recipients },
          "اعلان ساخته شد؛ با «ارسال» به‌صورت مرحله‌ای می‌رود"
        )
      } catch (error) {
        if (error instanceof Error && error.message === "NO_RECIPIENTS") {
          return conflict(c, "گیرنده‌ای برای این محدوده پیدا نشد")
        }
        if (error instanceof Error && error.message === "TOO_MANY_VALUES") {
          return badRequest(c, "تعداد مقادیر بیش از حد مجاز است")
        }
        console.error("announcement failed:", error)
        return internalServerError(c)
      }
    }
  )
  /* ─── One-time media intake (Supabase -> STORAGE topic -> file_id) ───
     Browser uploads straight to Supabase via presigned PUT (bypassing the
     ~4.5MB serverless body limit), then prepare() pushes the bytes into the
     private STORAGE topic once and returns a file_id the broadcast reuses
     for every recipient. The file_id is persisted on the batch payload, so
     pause/unpause and page refreshes never re-upload. Supabase objects are
     deleted right after Telegram accepts them (one-time). */
  .post(
    "/uploads/presign",
    requireRole("ADMIN", "SUPERADMIN"),
    zValidator(
      "json",
      z.object({
        fileName: z.string().min(1).max(128),
        mimeType: z.string().max(128).optional(),
        sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
      })
    ),
    async (c) => {
      if (!isExportStorageConfigured()) {
        return badRequest(c, "ذخیره‌سازی پیکربندی نشده است")
      }
      const { fileName, sizeBytes } = c.req.valid("json")
      if (sizeBytes > MAX_UPLOAD_BYTES) {
        return badRequest(c, "فایل بزرگتر از 20MB است")
      }
      const safe = fileName
        .split("/")
        .pop()!
        .replace(/[^\w.\-()\[\] ]+/g, "_")
        .slice(0, 80)
      const key = `admin-media/${randomUUID()}/${safe || "upload.bin"}`
      const { uploadUrl } = await presignExportPut(key)
      return ok(c, { uploadUrl, key })
    }
  )
  .post(
    "/uploads/prepare",
    requireRole("ADMIN", "SUPERADMIN"),
    zValidator(
      "json",
      z.object({
        key: z.string().min(1).max(256).optional(),
        url: z.string().url().max(2048).optional(),
        mediaType: z.enum(["photo", "video", "document"]),
        fileName: z.string().min(1).max(128).optional(),
      })
    ),
    async (c) => {
      const { key, url, mediaType, fileName } = c.req.valid("json")
      if ((key && url) || (!key && !url)) {
        return badRequest(c, "یکی از کلید یا نشانی ارسال شود")
      }
      if (!isExportStorageConfigured() && key) {
        return badRequest(c, "ذخیره‌سازی پیکربندی نشده است")
      }
      let bytes: Buffer
      let name = fileName?.trim() || "upload.bin"
      try {
        if (key) {
          if (!key.startsWith("admin-media/") || key.includes("..")) {
            return badRequest(c, "کلید نامعتبر است")
          }
          bytes = await getExportBytes(key)
          const tail = key.split("/").pop()
          if (!fileName && tail) name = tail
        } else {
          const fetched = await fetchUrlBytesLimited(url!)
          bytes = fetched.bytes
          if (!fileName) {
            try {
              const tail = new URL(fetched.finalUrl).pathname
                .split("/")
                .pop()
              if (tail) name = decodeURIComponent(tail).slice(0, 80)
            } catch {}
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "دریافت فایل ناموفق بود"
        return badRequest(c, msg)
      }
      if (bytes.length > MAX_UPLOAD_BYTES) {
        return badRequest(c, "فایل بزرگتر از 20MB است")
      }
      const ing = await ingestMedia(
        new Blob([bytes]),
        name,
        mediaType
      )
      if (!ing.ok) return badRequest(c, `آپلود ناموفق: ${ing.error}`)
      // One-time: drop the Supabase object once Telegram hosts the bytes.
      if (key) void deleteExportObject(key)
      return ok(c, {
        fileId: ing.fileId,
        mediaType,
        sizeBytes: bytes.length,
      })
    }
  )
  .delete(
    "/uploads/object",
    requireRole("ADMIN", "SUPERADMIN"),
    async (c) => {
      const key = c.req.query("key") ?? ""
      if (!key.startsWith("admin-media/") || key.includes("..")) {
        return badRequest(c, "کلید نامعتبر است")
      }
      // Idempotent orphan cleanup (e.g. cancelled uploads).
      await deleteExportObject(key)
      return ok(c, null, "پاک شد")
    }
  )
  .post(
    "/notifications/batches/:id/send-next",
    // Advancing a queue serves all three flows - any send-capable grant works.
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      try {
        const result = await sendNextMessage(c.req.param("id"))
        if (!result) return notFound(c, "دسته اعلان پیدا نشد")
        return ok(c, result)
      } catch (error) {
        console.error("send-next failed:", error)
        return internalServerError(c)
      }
    }
  )
  .post(
    "/notifications/batches/:id/send-batch",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      try {
        const body = await c.req.json().catch(() => ({}) as any)
        const count = Math.min(Math.max(Number(body.count) || 30, 1), 30)
        const { sendNextBatch } = await import("@/lib/notifications/service.ts")
        const result = await sendNextBatch(c.req.param("id"), count)
        if (!result) return notFound(c, "دسته اعلان پیدا نشد")
        return ok(c, result)
      } catch (error) {
        console.error("send-batch failed:", error)
        return internalServerError(c)
      }
    }
  )
  .post(
    "/messages/single",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      // Supports JSON (URL) + multipart FormData (file upload up to 4MB).
      // Direct one-off DM - sent immediately, not queued. Greeting configurable.
      const ct = c.req.header("content-type") ?? ""
      let chatId: number
      let text: string
      let parseMode: "HTML" | "Markdown" | "MarkdownV2" | undefined
      let photoUrl: string | undefined
      let videoUrl: string | undefined
      let documentUrl: string | undefined
      let photoFileId: string | undefined
      let videoFileId: string | undefined
      let documentFileId: string | undefined
      let buttons: { text: string; url: string }[][] | undefined
      let disablePreview: boolean | undefined
      let includeGreeting: boolean = true
      let greetingTemplate: string | undefined
      let includeButton: boolean = true
      let file: File | null = null
      let fileName: string | undefined

      if (ct.includes("multipart/form-data")) {
        const body = await c.req.parseBody()
        chatId = Number(body["chatId"])
        text = String(body["text"] ?? body["body"] ?? "")
        const pm = body["parseMode"] ? String(body["parseMode"]) : undefined
        if (pm === "HTML" || pm === "Markdown" || pm === "MarkdownV2")
          parseMode = pm
        photoUrl = body["photoUrl"] ? String(body["photoUrl"]) : undefined
        videoUrl = body["videoUrl"] ? String(body["videoUrl"]) : undefined
        documentUrl = body["documentUrl"]
          ? String(body["documentUrl"])
          : undefined
        photoFileId = body["photoFileId"]
          ? String(body["photoFileId"])
          : undefined
        videoFileId = body["videoFileId"]
          ? String(body["videoFileId"])
          : undefined
        documentFileId = body["documentFileId"]
          ? String(body["documentFileId"])
          : undefined
        if (body["buttons"]) {
          try {
            buttons = JSON.parse(String(body["buttons"]))
          } catch {
            return badRequest(c, "فرمت دکمه‌ها نامعتبر است")
          }
        }
        if (body["disablePreview"] !== undefined)
          disablePreview = String(body["disablePreview"]) === "true"
        if (body["includeGreeting"] !== undefined)
          includeGreeting = String(body["includeGreeting"]) === "true"
        if (body["greetingTemplate"] !== undefined)
          greetingTemplate = String(body["greetingTemplate"])
        if (body["includeButton"] !== undefined)
          includeButton = String(body["includeButton"]) === "true"
        const f =
          body["file"] ?? body["photo"] ?? body["video"] ?? body["document"]
        if (f instanceof File) {
          file = f
          fileName = file.name
          const check2 = validateFileSize(file)
          if (!check2.ok)
            return badRequest(c, check2.error ?? "فایل بزرگتر از 4MB است")
        }
      } else {
        const json = (await c.req.json().catch(() => null)) as Record<
          string,
          unknown
        > | null
        if (!json) return badRequest(c, "بدنه درخواست نامعتبر است")
        const parsed = singleSchema.safeParse(json)
        if (!parsed.success)
          return badRequest(
            c,
            parsed.error.issues[0]?.message ?? "ورودی نامعتبر"
          )
        const d = parsed.data
        chatId = d.chatId
        text = (d.text ?? d.body ?? "") as string
        parseMode = d.parseMode as
          "HTML" | "Markdown" | "MarkdownV2" | undefined
        photoUrl = d.photoUrl
        videoUrl = d.videoUrl
        documentUrl = (d as unknown as { documentUrl?: string }).documentUrl
        photoFileId = (d as unknown as { photoFileId?: string }).photoFileId
        videoFileId = (d as unknown as { videoFileId?: string }).videoFileId
        documentFileId = (d as unknown as { documentFileId?: string })
          .documentFileId
        buttons = d.buttons as { text: string; url: string }[][] | undefined
        disablePreview = d.disablePreview
        includeGreeting = (d as any).includeGreeting ?? true
        greetingTemplate = (d as any).greetingTemplate ?? undefined
        includeButton = (d as any).includeButton ?? true
      }

      if (!chatId || !text?.trim())
        return badRequest(c, "chatId و متن الزامی است")
      text = text.trim()
      // Greeting configurable: if enabled, prepend personalized greeting
      if (includeGreeting) {
        const [targetUser] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, chatId))
          .limit(1)
        const { getDisplayName } = await import("@/lib/notifications/render.ts")
        const name = getDisplayName(targetUser?.firstName, targetUser?.lastName)
        const template = greetingTemplate?.trim() || "سلام {name} عزیز"
        text = `${template.replace("{name}", name)}\n\n${text}`
      }
      // Button toggle: include open-app button if enabled
      if (includeButton) {
        const { renderOpenAppButton } =
          await import("@/lib/notifications/render.ts")
        const btn = renderOpenAppButton()
        if (btn) {
          const hasOpen = buttons?.some((row) =>
            row.some((b) => b.text === btn.text)
          )
          if (!hasOpen) buttons = [...(buttons ?? []), [btn]]
        }
      }

      // File upload takes precedence – direct stream to chat (no fileId saved, 4MB Vercel limit)
      if (file) {
        const result = await sendWithFile(
          chatId,
          file,
          fileName ?? file.name,
          text,
          {
            parseMode,
            buttons,
          }
        )
        if (!result.ok) return badRequest(c, `ارسال ناموفق: ${result.error}`)
        await db
          .update(users)
          .set({ lastOnlineAt: new Date() })
          .where(eq(users.id, chatId))
        return ok(c, { chatId, sent: true }, "پیام ارسال شد")
      }

      const hasRich = Boolean(
        photoUrl ||
        videoUrl ||
        documentUrl ||
        photoFileId ||
        videoFileId ||
        documentFileId ||
        (buttons && buttons.length) ||
        parseMode ||
        disablePreview !== undefined
      )
      const result = hasRich
        ? await sendRichMessage(chatId, {
            text,
            parseMode,
            photoUrl: photoUrl ?? undefined,
            videoUrl: videoUrl ?? undefined,
            documentUrl: documentUrl ?? undefined,
            photoFileId: photoFileId ?? undefined,
            videoFileId: videoFileId ?? undefined,
            documentFileId: documentFileId ?? undefined,
            buttons,
            disablePreview,
          })
        : await sendMessage(chatId, text)
      if (!result.ok) {
        return badRequest(c, `ارسال ناموفق: ${result.error}`)
      }
      await db
        .update(users)
        .set({ lastOnlineAt: new Date() })
        .where(eq(users.id, chatId))
      return ok(c, { chatId, sent: true }, "پیام ارسال شد")
    }
  )
  .post(
    "/notifications/batches/:id/dismiss",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      const id = c.req.param("id")
      const adminChatId = c.get("adminChatId")!
      const adminRole = (c.get("adminRole") as string | undefined) ?? ""
      const [raw] = await db
        .select()
        .from(notificationBatches)
        .where(eq(notificationBatches.id, id))
        .limit(1)
      if (!raw) return notFound(c, "دسته اعلان پیدا نشد")
      if (
        raw.createdById !== null &&
        raw.createdById !== adminChatId &&
        adminRole !== "SUPERADMIN"
      )
        return forbidden(c, "دسته متعلق به شما نیست")
      const did = (raw.payload as { diffId?: string } | null)?.diffId ?? null
      if (did) {
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            did
          )
        )
          return badRequest(c, "شناسه diff نامعتبر")
        await completeOfferingDiff(did, adminChatId)
        return ok(
          c,
          { diffId: did },
          "تغییر به‌عنوان انجام‌شده علامت خورد و دیگر نمایش داده نمی‌شود"
        )
      }
      // Announcements (no diffId) are removed outright — including COMPLETED
      // ones, which is exactly when the admin UI offers مخفی کردن. Messages
      // cascade by FK; already-sent Telegram messages are unaffected.
      await db.delete(notificationBatches).where(eq(notificationBatches.id, id))
      return ok(c, null, "دسته اعلان حذف شد")
    }
  )
  .post(
    "/notifications/diffs/:diffId/complete",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      const diffId = c.req.param("diffId")
      const adminChatId = c.get("adminChatId")!
      try {
        await completeOfferingDiff(diffId, adminChatId)
        return ok(c, { diffId }, "diff کامل شد")
      } catch (e) {
        const msg = e instanceof Error ? e.message : ""
        if (msg === "INVALID_UUID") return badRequest(c, "شناسه diff نامعتبر")
        console.error("complete diff failed", e)
        return internalServerError(c)
      }
    }
  )
  .delete(
    "/notifications/batches/:id",
    requireRole("NOTIFICATIONER", "ADMIN", "SUPERADMIN"),
    async (c) => {
      const id = c.req.param("id")
      const adminChatId = c.get("adminChatId")!
      const adminRole = (c.get("adminRole") as string | undefined) ?? ""
      // Allow READY and SENDING to be deleted (cancel). COMPLETED is audit trail.
      const [raw] = await db
        .select()
        .from(notificationBatches)
        .where(eq(notificationBatches.id, id))
        .limit(1)
      if (!raw) return notFound(c, "دسته اعلان پیدا نشد")
      if (
        raw.createdById !== null &&
        raw.createdById !== adminChatId &&
        adminRole !== "SUPERADMIN"
      )
        return forbidden(c, "دسته متعلق به شما نیست")
      if (raw.status === "COMPLETED") {
        return conflict(
          c,
          "دسته‌های تکمیل‌شده قابل حذف نیستند - از «اتمام» استفاده کنید"
        )
      }
      // Deleting counts as handling: record completion so a later detect
      // never resurrects this exact content (with baselines, only truly new
      // changes surface afterwards).
      try {
        await completeBatchDiff(id, adminChatId)
      } catch {
        // Best-effort: the delete itself must still succeed.
      }
      await db.delete(notificationBatches).where(eq(notificationBatches.id, id))
      return ok(c, null, "دسته اعلان حذف شد")
    }
  )

/* ─── Upload moderation ───
   Flow (pinned in AGENTS.md): user upload -> PENDING -> admin reviews here ->
   admin MANUALLY appends archives.json via a registry PR -> approve. There is
   no auto-PR bot. */

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  registryPrUrl: z.string().url().optional(),
})

export const adminUploadsRoutes = new Hono<AppEnv>()
  .use("*", withAdmin, requireAdmin)
  .get("/uploads", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const raw = c.req.query("status") ?? ""
    const where =
      raw === "PENDING" ||
      raw === "APPROVED" ||
      raw === "ADDED_TO_REGISTRY" ||
      raw === "REJECTED"
        ? eq(uploads.status, raw)
        : undefined
    // kind filter is future-proofing - ARCHIVE is the only kind for now;
    // this queue IS the «آرشیوهای در انتظار» section.
    const kind = c.req.query("kind")
    const kindWhere =
      kind === "ARCHIVE" ? eq(uploads.kind, "ARCHIVE") : undefined
    const rows = await db
      .select()
      .from(uploads)
      .where(where && kindWhere ? and(where, kindWhere) : (where ?? kindWhere))
      .orderBy(desc(uploads.createdAt))
      .limit(100)
    return ok(c, { uploads: rows })
  })
  .post("/uploads/direct", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    const adminChatId = c.get("adminChatId")!
    const form = await c.req.parseBody()
    const file = form.file
    const title = String(form.title ?? "").trim()
    const description = String(form.description ?? "").trim()
    if (!(file instanceof File) || file.size === 0)
      return badRequest(c, "فایلی ارسال نشده است")
    {
      const check3 = validateFileSize(file)
      if (!check3.ok)
        return badRequest(c, check3.error ?? "فایل بزرگتر از 4MB است")
    }
    if (title.length < 3 || title.length > 255)
      return badRequest(c, "عنوان باید بین ۳ تا ۲۵۵ کاراکتر باشد")
    // Direct admin upload – no university/major needed, just title/description (archive uploads from mini app carry those)
    const ingested = await ingestFile(
      file,
      file.name || "upload",
      `${title} — admin ${adminChatId}`
    )
    if (!ingested.ok)
      return badRequest(
        c,
        `دریافت فایل توسط تلگرام ناموفق بود: ${ingested.error}`
      )
    const [row] = await db
      .insert(uploads)
      .values({
        userId: adminChatId,
        kind: "ARCHIVE",
        status: "PENDING",
        telegramFileId: ingested.fileId,
        fileName: file.name || null,
        mimeType: file.type || null,
        sizeBytes: file.size,
        title,
        description: description || null,
        universitySlug: "azad-malard",
        majorSlug: null,
      })
      .returning()
    return ok(c, { upload: row }, "آپلود مستقیم ثبت شد")
  })
  .post(
    "/uploads/:id/review",
    requireRole("ADMIN", "SUPERADMIN"),
    zValidator("json", reviewSchema),
    async (c) => {
      const id = c.req.param("id")
      const adminChatId = c.get("adminChatId")!
      const { action, registryPrUrl } = c.req.valid("json")

      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, id))
        .limit(1)
      if (!upload) return notFound(c, "آپلود پیدا نشد")
      if (upload.status !== "PENDING" && upload.status !== "APPROVED") {
        return conflict(c, "این آپلود قبلاً بررسی شده")
      }

      if (action === "reject") {
        await db
          .update(uploads)
          .set({
            status: "REJECTED",
            reviewedById: adminChatId,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(uploads.id, id))
        return ok(c, null, "آپلود رد شد")
      }

      // Approve: APPROVED while waiting for the manual registry PR; once the
      // admin passes its PR link, mark ADDED_TO_REGISTRY for traceability.
      const nextStatus = registryPrUrl ? "ADDED_TO_REGISTRY" : "APPROVED"
      await db
        .update(uploads)
        .set({
          status: nextStatus,
          registryPrUrl: registryPrUrl ?? upload.registryPrUrl,
          reviewedById: adminChatId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(uploads.id, id))
      return ok(
        c,
        { status: nextStatus },
        "تأیید شد؛ حالا ورودی را به archives.json اضافه کنید"
      )
    }
  )
  .post(
    "/uploads/:id/send-to-me",
    requireRole("ADMIN", "SUPERADMIN"),
    async (c) => {
      const id = c.req.param("id")
      const adminChatId = c.get("adminChatId")!
      const [upload] = await db
        .select()
        .from(uploads)
        .where(eq(uploads.id, id))
        .limit(1)
      if (!upload) return notFound(c, "آپلود پیدا نشد")
      const result = await sendStoredFile(
        adminChatId,
        upload.telegramFileId,
        `فایل: ${upload.fileName ?? upload.id}`
      )
      if (!result.ok) return badRequest(c, `ارسال ناموفق: ${result.error}`)
      return ok(c, { sent: true }, "فایل به پی‌وی شما ارسال شد")
    }
  )
  .delete("/uploads/:id", requireRole("ADMIN", "SUPERADMIN"), async (c) => {
    // Spam cleanup only - reviewed uploads are part of the audit trail.
    const id = c.req.param("id")
    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, id))
      .limit(1)
    if (!upload) return notFound(c, "آپلود پیدا نشد")
    if (upload.status !== "PENDING" && upload.status !== "REJECTED") {
      return forbidden(c, "فقط آپلودهای در انتظار یا ردشده قابل حذف هستند")
    }
    await db.delete(uploads).where(eq(uploads.id, id))
    return ok(c, null, "آپلود حذف شد")
  })
