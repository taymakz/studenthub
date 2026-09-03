import { config } from "@/config"

import { sendMessageRaw, telegramDry } from "./bot"

/**
 * Admin forum notifications.
 *
 * Three topics are used:
 *  - JOINS   : new user signups + first-time profile completion
 *  - STORAGE : user uploads via POST /me/uploads (file lands in TELEGRAM_UPLOADS_CHAT_ID, notice goes here)
 *  - DEFAULT : fallback / generic operational messages
 *
 * Env supports two styles:
 *  1) Separate: TELEGRAM_ADMIN_GROUP_ID plus per-topic thread ids
 *  2) Combined: TELEGRAM_SERVICE_TOPICS_*_ID = "-100123_14" (chatId_topicId)
 *
 * When no group is configured or TELEGRAM_DRY=true, messages are logged and ignored.
 * Failures are swallowed (best-effort, never break the user request).
 */

export type AdminTopic = "JOINS" | "STORAGE" | "DEFAULT"

function dry(): boolean {
  return telegramDry()
}

interface ResolvedTarget {
  chatId: string
  threadId: number | undefined
}

/**
 * Resolve chatId + message_thread_id for a topic.
 * Prefers the new separate vars, falls back to the legacy combined ones.
 */
function resolveTarget(topic: AdminTopic): ResolvedTarget | null {
  const combinedMap: Record<AdminTopic, string> = {
    JOINS:
      config.TELEGRAM_SERVICE_TOPICS_JOINS_ID ||
      config.TELEGRAM_ADMIN_TOPIC_JOINS,
    STORAGE:
      config.TELEGRAM_SERVICE_TOPICS_STORAGE_ID ||
      config.TELEGRAM_ADMIN_TOPIC_STORAGE,
    DEFAULT:
      config.TELEGRAM_SERVICE_TOPICS_DEFAULT_ID ||
      config.TELEGRAM_ADMIN_TOPIC_DEFAULT,
  }
  const separateGroup = config.TELEGRAM_ADMIN_GROUP_ID

  // If group + thread are separate, use them.
  const separateThreadMap: Record<AdminTopic, string> = {
    JOINS: config.TELEGRAM_ADMIN_TOPIC_JOINS,
    STORAGE: config.TELEGRAM_ADMIN_TOPIC_STORAGE,
    DEFAULT: config.TELEGRAM_ADMIN_TOPIC_DEFAULT,
  }
  const separateThread = separateThreadMap[topic]
  if (separateGroup && separateThread) {
    const tid = Number.parseInt(separateThread, 10)
    if (tid === 1) return { chatId: separateGroup, threadId: undefined }
    return {
      chatId: separateGroup,
      threadId: Number.isFinite(tid) ? tid : undefined,
    }
  }
  if (separateGroup && !separateThread && combinedMap[topic]?.includes("_")) {
    // group given separately but topic value is combined -> split combined
    const val = combinedMap[topic]
    const [c, t] = val.split("_")
    const tid = Number.parseInt(t ?? "", 10)
    if (tid === 1) return { chatId: c || separateGroup, threadId: undefined }
    return {
      chatId: c || separateGroup,
      threadId: Number.isFinite(tid) ? tid : undefined,
    }
  }

  // Fallback: combined format "-100xxx_14" — thread 1 is General, must be sent without message_thread_id
  const raw = combinedMap[topic]
  if (raw) {
    if (raw.includes("_")) {
      const parts = raw.split("_")
      const chatId = (parts[0] ?? "").trim()
      const thread = parts[1] ?? ""
      if (!chatId) return null
      const tid = Number.parseInt(thread, 10)
      // Enterprise: thread 1 == General topic — Telegram rejects message_thread_id=1, send to General without it
      if (tid === 1) return { chatId, threadId: undefined }
      return { chatId, threadId: Number.isFinite(tid) ? tid : undefined }
    }
    // Plain chat id without thread
    return { chatId: raw, threadId: undefined }
  }

  // Topic-specific unset -> fall back to DEFAULT group for that topic
  if (topic !== "DEFAULT") {
    const def = resolveTarget("DEFAULT")
    if (def) return def
  }
  return null
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

/**
 * Send a best-effort admin message. Never throws — logs and swallows errors
 * so user-facing requests are not failed by a Telegram outage.
 */
export async function sendAdminMessage(
  topic: AdminTopic,
  text: string,
  opts?: {
    parseMode?: "HTML"
    disablePreview?: boolean
    buttons?: { text: string; url: string }[][]
  }
): Promise<void> {
  const target = resolveTarget(topic)
  if (!target) {
    console.log(`[telegram:admin:dry:${topic}] ${text.slice(0, 200)}`)
    return
  }
  if (dry()) {
    console.log(
      `[telegram:admin:dry:${topic} -> ${target.chatId}${target.threadId ? `:${target.threadId}` : ""}] ${text.slice(0, 200)}`
    )
    return
  }
  try {
    await sendMessageRaw(target.chatId, text, {
      ...(opts?.parseMode ? { parseMode: opts.parseMode } : {}),
      disablePreview: opts?.disablePreview ?? true,
      ...(target.threadId ? { messageThreadId: target.threadId } : {}),
      ...(opts?.buttons?.length
        ? { replyMarkup: { inline_keyboard: opts.buttons } }
        : {}),
    })
  } catch (error) {
    console.warn(
      `[telegram:admin] failed to send to ${topic}:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}

/* ─── Message builders ─── */

function normalize(text: string): string {
  return text.trim().replaceAll(/\s+/g, " ")
}

function fmtUsername(u: string | null | undefined): string {
  return u ? `@${u}` : "—"
}

function translateEntrySemester(sem: string | null | undefined): string {
  if (sem === "MEHR") return "مهر"
  if (sem === "BAHMAN") return "بهمن"
  if (sem === "SUMMER") return "تابستان"
  return sem ?? "مشخص نشده"
}

function translateGender(g: string | null | undefined): string {
  if (g === "MALE") return "آقا"
  if (g === "FEMALE") return "خانم"
  return g ?? "مشخص نشده"
}

/** New user JOIN message for the JOINS topic. */
export function buildJoinMessage(user: {
  id: number
  firstName: string
  lastName: string | null
  telegramUsername: string | null
}): string {
  const name =
    `${normalize(user.firstName)} ${normalize(user.lastName ?? "")}`.trim()
  let msg = `🟢 ثبت‌نام جدید\n${escapeHtml(name)}\n`
  if (user.telegramUsername)
    msg += `${escapeHtml(fmtUsername(user.telegramUsername))}\n`
  msg += `🆔 <code>${user.id}</code>`
  return msg
}

/** Profile completion message for the JOINS topic. */
export function buildProfileCompleteMessage(
  user: {
    id: number
    firstName: string
    lastName: string | null
    telegramUsername: string | null
  },
  profile: {
    universitySlug: string | null
    majorSlug: string | null
    degree: string | null
    entryYearRange: string | null
    entrySemester: string | null
    gender: string | null
    termNumber: number | null
  }
): string {
  const name =
    `${normalize(user.firstName)} ${normalize(user.lastName ?? "")}`.trim()
  let msg = `🟢 مشخصات کاربر تکمیل شد\n${escapeHtml(name)}\n`
  if (user.telegramUsername)
    msg += `${escapeHtml(fmtUsername(user.telegramUsername))}\n`
  msg += `🆔 <code>${user.id}</code>\n`
  msg += `جنسیت: ${escapeHtml(translateGender(profile.gender))}\n`
  msg += `دانشگاه: ${escapeHtml(profile.universitySlug ?? "مشخص نشده")}\n`
  msg += `رشته: ${escapeHtml(profile.majorSlug ?? "مشخص نشده")}\n`
  msg += `مقطع: ${escapeHtml(profile.degree ?? "مشخص نشده")}\n`
  msg += `سال: ${escapeHtml(profile.entryYearRange ?? "مشخص نشده")}\n`
  msg += `نیمسال: ${escapeHtml(translateEntrySemester(profile.entrySemester))}\n`
  msg += `ترم: ${escapeHtml(profile.termNumber != null ? String(profile.termNumber) : "مشخص نشده")}`
  return msg
}

/** Upload STORAGE notice — file already landed in TELEGRAM_UPLOADS_CHAT_ID via ingestFile. */
export function buildUploadMessage(
  user: {
    id: number
    firstName: string
    lastName: string | null
    telegramUsername: string | null
  },
  info: {
    title: string
    universitySlug: string
    majorSlug: string | null
    fileName: string | null
    sizeBytes: number
  }
): string {
  const name =
    `${normalize(user.firstName)} ${normalize(user.lastName ?? "")}`.trim()
  let msg = `📦 آپلود جدید\n${escapeHtml(name)} ${escapeHtml(fmtUsername(user.telegramUsername))} — <code>${user.id}</code>\n`
  msg += `عنوان: ${escapeHtml(info.title)}\n`
  msg += `دانشگاه: ${escapeHtml(info.universitySlug)} · رشته: ${escapeHtml(info.majorSlug ?? "—")}\n`
  msg += `فایل: ${escapeHtml(info.fileName ?? "—")} (${(info.sizeBytes / 1024).toFixed(1)} KB)`
  return msg
}

/** Feedback submission notification for the DEFAULT topic. */
export function buildFeedbackMessage(
  user: {
    id: number
    firstName: string
    lastName: string | null
    telegramUsername: string | null
  },
  info: { kind: string; message: string }
): string {
  const name =
    `${normalize(user.firstName)} ${normalize(user.lastName ?? "")}`.trim()
  const kindLabel: Record<string, string> = {
    BUG: "🐛 گزارش اشکال",
    SUGGESTION: "💡 پیشنهاد",
    THANKS: "🙏 تشکر",
    SOURCE: "📚 معرفی منبع",
  }
  let msg = `📬 بازخورد جدید\n`
  msg += `${escapeHtml(name)} ${escapeHtml(fmtUsername(user.telegramUsername))} — <code>${user.id}</code>\n`
  msg += `نوع: ${escapeHtml(kindLabel[info.kind] ?? info.kind)}\n\n`
  // Truncate long messages to keep the notification readable.
  const truncated =
    info.message.length > 300 ? info.message.slice(0, 300) + "…" : info.message
  msg += escapeHtml(truncated)
  return msg
}
