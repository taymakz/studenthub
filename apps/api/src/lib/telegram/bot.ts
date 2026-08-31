import { MAX_UPLOAD_BYTES, validateFileSize } from "@workspace/ui/lib/file"

import { config } from "@/config"

export { MAX_UPLOAD_BYTES, validateFileSize }

/**
 * Telegram delivery via the Bot API over native `fetch` - no client library.
 *
 * grammY was removed because its Node shim (node-fetch + `abort-controller`
 * polyfill) broke under the esbuild serverless bundle: the polyfilled signal
 * fails `instanceof AbortSignal` checks inside the bundled copy of
 * node-fetch, and undici (Vercel's global fetch) rejects it outright. Every
 * call this app makes is an outbound Bot API request, so a small client on
 * platform globals is all we need - nothing to mismatch, nothing to shim.
 *
 * Every helper keeps the `{ ok } | { ok: false; error }` contract the
 * controllers expect, and honours TELEGRAM_DRY (dev: log instead of send).
 */

const REQUEST_TIMEOUT_MS = 30_000

const apiRoot = () => `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}`

const dry = () => !config.TELEGRAM_BOT_TOKEN || config.TELEGRAM_DRY

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause
    const causeText =
      cause instanceof Error
        ? ` (cause: ${cause.message})`
        : cause !== undefined
          ? ` (cause: ${String(cause)})`
          : ""
    return `${error.message}${causeText}`
  }
  return "unknown telegram error"
}

/** Throws on network errors AND on Telegram `{ ok: false }` responses. */
async function callBotApi<T>(
  method: string,
  body: FormData | string,
  headers?: Record<string, string>
): Promise<T> {
  const res = await fetch(`${apiRoot()}/${method}`, {
    method: "POST",
    headers,
    body,
    // Native AbortSignal.timeout - no polyfill involved.
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = (await res.json()) as {
    ok: boolean
    result?: T
    description?: string
  }
  if (!data.ok) {
    throw new Error(
      `Telegram says: ${data.description ?? `HTTP ${res.status}`}`
    )
  }
  return data.result as T
}

/** JSON-call a Bot API method. */
async function callMethod<T>(
  method: string,
  payload: Record<string, unknown>
): Promise<T> {
  return callBotApi<T>(method, JSON.stringify(payload), {
    "content-type": "application/json",
  })
}

/** Multipart-upload a file to a Bot API method (`photo`/`video`/`document`). */
async function callUpload<T>(
  method: string,
  field: "photo" | "video" | "document",
  buffer: Buffer,
  fileName: string,
  payload: Record<string, unknown>
): Promise<T> {
  const form = new FormData()
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue
    // Strings (chat_id, caption, parse_mode, file refs) must be sent raw —
    // JSON.stringify would wrap them in quotes and Telegram fails to parse
    // them (e.g. chat_id "\"-100...\"" -> Bad Request: chat not found).
    // Only objects/arrays/booleans/numbers need JSON encoding.
    form.append(key, typeof value === "string" ? value : JSON.stringify(value))
  }
  form.append(field, new Blob([new Uint8Array(buffer)]), fileName)
  return callBotApi<T>(method, form)
}

/* ─── Minimal Bot API response shapes ─── */

interface TelegramMessage {
  message_id: number
  document?: { file_id: string }
  video?: { file_id: string }
  photo?: { file_id: string }[]
}

type InlineKeyboard = { inline_keyboard: { text: string; url: string }[][] }

/** sendMessage with raw extra params (used for admin topic threads). */
export async function sendMessageRaw(
  chatId: number | string,
  text: string,
  extra?: {
    parseMode?: "HTML"
    disablePreview?: boolean
    messageThreadId?: number
    replyMarkup?: InlineKeyboard
  }
): Promise<void> {
  await callMethod("sendMessage", {
    chat_id: chatId,
    text,
    ...(extra?.parseMode ? { parse_mode: extra.parseMode } : {}),
    link_preview_options: { is_disabled: extra?.disablePreview ?? true },
    ...(extra?.messageThreadId
      ? { message_thread_id: extra.messageThreadId }
      : {}),
    ...(extra?.replyMarkup ? { reply_markup: extra.replyMarkup } : {}),
  })
}

export async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    inlineButton?: { text: string; url: string } | null
    /** "HTML" enables <code>/<b> markup in `text`. */
    parseMode?: "HTML"
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (dry()) {
    console.log(
      `[telegram:dry] sendMessage -> ${chatId}:`,
      JSON.stringify(text).slice(0, 120)
    )
    return { ok: true }
  }
  try {
    await callMethod("sendMessage", {
      chat_id: chatId,
      text,
      // Plain text like the old system unless a caller opts into markup.
      ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
      link_preview_options: { is_disabled: true },
      ...(options?.inlineButton
        ? { reply_markup: { inline_keyboard: [[options.inlineButton]] } }
        : {}),
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

export type RichInlineButton = { text: string; url: string }

/**
 * Notify a user that their access/permissions changed. Sends their own chat id
 * (copy-pastable) plus an inline button to the admin console login page.
 */
export async function notifyPermissionChanged(
  chatId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appUrl = "https://admin.student-hub.ir/"
  return sendRichMessage(chatId, {
    text:
      `دسترسی شما در دانشجویار به‌روزرسانی شد.\n\n` +
      `شناسه ورود شما:\n` +
      `<code>${chatId}</code>\n\n` +
      `این شناسه را کپی کنید و در صفحه‌ی ورود وارد کنید.`,
    parseMode: "HTML",
    buttons: [[{ text: "ورود به پنل مدیریت", url: appUrl }]],
  })
}

export async function sendRichMessage(
  chatId: number,
  payload: {
    text: string
    parseMode?: "HTML" | "Markdown" | "MarkdownV2"
    photoUrl?: string
    videoUrl?: string
    documentUrl?: string
    photoFileId?: string
    videoFileId?: string
    documentFileId?: string
    buttons?: RichInlineButton[][]
    disablePreview?: boolean
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (dry()) {
    console.log(
      `[telegram:dry] sendRich -> ${chatId}:`,
      JSON.stringify(payload).slice(0, 180)
    )
    return { ok: true }
  }
  const replyMarkup: InlineKeyboard | undefined = payload.buttons?.length
    ? { inline_keyboard: payload.buttons }
    : undefined
  const parseMode = payload.parseMode
  let media:
    | { field: "photo" | "video" | "document"; source: string }
    | null = null
  try {
    // fileId takes precedence over Url (broadcast cached)
    media =
      payload.photoFileId || payload.photoUrl
        ? ({
            field: "photo",
            source: payload.photoFileId ?? payload.photoUrl!,
          } as const)
        : payload.videoFileId || payload.videoUrl
          ? ({
              field: "video",
              source: payload.videoFileId ?? payload.videoUrl!,
            } as const)
          : payload.documentFileId || payload.documentUrl
            ? ({
                field: "document",
                source: payload.documentFileId ?? payload.documentUrl!,
              } as const)
            : null
    if (media) {
      // Telegram Bot API requires FormData for photo/video/document URLs —
      // JSON body only works for fileId strings, not HTTP URLs.
      const isUrl = media.source.startsWith("http")
      if (isUrl) {
        const form = new FormData()
        form.append("chat_id", String(chatId))
        form.append(media.field, media.source)
        if (payload.text) form.append("caption", payload.text)
        if (parseMode) form.append("parse_mode", parseMode)
        if (replyMarkup)
          form.append("reply_markup", JSON.stringify(replyMarkup))
        await callBotApi(`send${media.field.charAt(0).toUpperCase()}${media.field.slice(1)}`, form)
      } else {
        await callMethod(`send${media.field.charAt(0).toUpperCase()}${media.field.slice(1)}`, {
          chat_id: chatId,
          [media.field]: media.source,
          caption: payload.text || undefined,
          ...(parseMode ? { parse_mode: parseMode } : {}),
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        })
      }
      return { ok: true }
    }
    await callMethod("sendMessage", {
      chat_id: chatId,
      text: payload.text,
      ...(parseMode ? { parse_mode: parseMode } : {}),
      link_preview_options: { is_disabled: payload.disablePreview ?? true },
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
    return { ok: true }
  } catch (error) {
    console.warn(`[telegram] sendRichMessage failed:`, errorMessage(error), { chatId, media: media?.field, source: media?.source?.slice(0, 120) })
    return { ok: false, error: errorMessage(error) }
  }
}

// Direct upload for single message – streams file bytes straight to the target chat (no fileId saved)
export async function sendWithFile(
  chatId: number,
  file: Blob,
  fileName: string,
  caption: string,
  options?: {
    parseMode?: "HTML" | "Markdown" | "MarkdownV2"
    buttons?: RichInlineButton[][]
    mediaType?: "photo" | "video" | "document"
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const _check = validateFileSize(file)
  if (!_check.ok) {
    return {
      ok: false,
      error: `فایل بزرگتر از 4MB است (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
    }
  }
  if (dry()) {
    console.log(
      `[telegram:dry] sendWithFile -> ${chatId}: ${fileName} (${file.size}b)`
    )
    return { ok: true }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const replyMarkup: InlineKeyboard | undefined = options?.buttons?.length
    ? { inline_keyboard: options.buttons }
    : undefined
  try {
    const type = options?.mediaType ?? inferMediaType(fileName, file.type)
    const method = `send${type.charAt(0).toUpperCase()}${type.slice(1)}`
    await callUpload(method, type, buffer, fileName, {
      chat_id: chatId,
      caption: caption || undefined,
      ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

function inferMediaType(
  fileName: string,
  mime: string
): "photo" | "video" | "document" {
  if (mime.startsWith("image/")) return "photo"
  if (mime.startsWith("video/")) return "video"
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "photo"
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video"
  return "document"
}

// Upload once to STORAGE topic and return fileId for broadcast reuse — uses SERVICE_TOPICS_STORAGE_ID as private storage
function getUploadsTarget(): { chatId: string; threadId?: number } | null {
  const raw = config.TELEGRAM_SERVICE_TOPICS_STORAGE_ID
  if (!raw) return null
  if (raw.includes("_")) {
    const [c, t] = raw.split("_")
    const tid = Number.parseInt(t ?? "", 10)
    if (tid === 1) return { chatId: c }
    return { chatId: c, threadId: Number.isFinite(tid) ? tid : undefined }
  }
  return { chatId: raw }
}

export async function ingestMedia(
  file: Blob,
  fileName: string,
  mediaType: "photo" | "video" | "document"
): Promise<{ ok: true; fileId: string } | { ok: false; error: string }> {
  const _check2 = validateFileSize(file)
  if (!_check2.ok) {
    return { ok: false, error: `فایل بزرگتر از 4MB است` }
  }
  const uploadsTarget = getUploadsTarget()
  if (dry() || !uploadsTarget) {
    console.log(
      `[telegram:dry] ingestMedia(${mediaType}) ${fileName} (${file.size}b)`
    )
    return { ok: true, fileId: `DRY-${mediaType}-${Date.now().toString(36)}` }
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const msg = await callUpload<TelegramMessage>(
      `send${mediaType.charAt(0).toUpperCase()}${mediaType.slice(1)}`,
      mediaType, buffer, fileName, {
      chat_id: uploadsTarget.chatId,
      ...(uploadsTarget.threadId ? { message_thread_id: uploadsTarget.threadId } : {}),
    })
    const fileId =
      mediaType === "photo"
        ? msg.photo?.[msg.photo.length - 1]?.file_id
        : mediaType === "video"
          ? msg.video?.file_id
          : msg.document?.file_id
    if (!fileId) return { ok: false, error: "Telegram returned no file_id" }
    return { ok: true, fileId }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

/**
 * Sends a previously-ingested file by file_id (instant - Telegram hosts the
 * bytes). Used for chart-PDF delivery.
 */
export async function sendStoredFile(
  chatId: number,
  fileId: string,
  caption?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (dry()) {
    console.log(`[telegram:dry] sendDocument(file_id) -> ${chatId}`)
    return { ok: true }
  }
  try {
    await callMethod("sendDocument", {
      chat_id: chatId,
      document: fileId,
      ...(caption ? { caption } : {}),
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

/**
 * Upload intake: streams a user file into the private storage chat and
 * returns its file_id - the ONLY thing we persist (AGENTS.md: no object
 * storage). Dry mode mints a fake id so the whole flow stays testable.
 */
export async function ingestFile(
  file: Blob,
  fileName: string,
  caption?: string
): Promise<{ ok: true; fileId: string } | { ok: false; error: string }> {
  const uploadsTarget = getUploadsTarget()
  if (dry() || !uploadsTarget) {
    console.log(
      `[telegram:dry] sendDocument(upload) ${fileName} (${file.size}b)`
    )
    return {
      ok: true,
      fileId: `DRY-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const message = await callUpload<TelegramMessage>(
      "sendDocument",
      "document",
      buffer,
      fileName,
      {
        chat_id: uploadsTarget.chatId,
        ...(uploadsTarget.threadId ? { message_thread_id: uploadsTarget.threadId } : {}),
        ...(caption ? { caption } : {}),
      }
    )
    const fileId = message.document?.file_id
    if (!fileId) return { ok: false, error: "Telegram returned no file_id" }
    return { ok: true, fileId }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}

/** Streams raw chart-PDF bytes and returns the new file_id. */
export async function ingestPdfBytes(
  bytes: Buffer,
  fileName: string
): Promise<{ ok: true; fileId: string } | { ok: false; error: string }> {
  const uploadsTarget = getUploadsTarget()
  if (dry() || !uploadsTarget) {
    console.log(
      `[telegram:dry] sendDocument(pdf) ${fileName} (${bytes.length}b)`
    )
    return {
      ok: true,
      fileId: `DRYPDF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    }
  }
  try {
    const message = await callUpload<TelegramMessage>(
      "sendDocument",
      "document",
      bytes,
      fileName,
      {
        chat_id: uploadsTarget!.chatId,
        ...(uploadsTarget!.threadId ? { message_thread_id: uploadsTarget!.threadId } : {}),
      }
    )
    const fileId = message.document?.file_id
    if (!fileId) return { ok: false, error: "Telegram returned no file_id" }
    return { ok: true, fileId }
  } catch (error) {
    return { ok: false, error: errorMessage(error) }
  }
}
