import type { ChartCourse, Offering, Semester } from "@workspace/registry"

import { config } from "@/config"
import type { OfferingDiff } from "@/lib/notifications/diff"

/**
 * Port of the old system's per-user message builder in
 * `notify_users_about_update`: greeting + summary counts (only courses from
 * the user's own chart, minus passed ones) + a detailed section for courses
 * the user actually NOTED, then the Telegram 4096-byte truncation.
 */

const OPEN_APP_BUTTON_TEXT = "اجرای برنامه"
export const MAX_MESSAGE_BYTES = 4096

export function truncateToTelegramLimit(message: string): string {
  const bytes = Buffer.from(message, "utf-8")
  if (bytes.length <= MAX_MESSAGE_BYTES) return message
  // Slice to 4093 bytes + "…" (3 bytes) = 4096, handling multi-byte cut
  let truncated = bytes.subarray(0, 4093).toString("utf-8")
  // If slicing cut a multi-byte char, byteLength may be <4093, still ok – ensure + "…" <=4096
  while (Buffer.byteLength(truncated + "…", "utf-8") > MAX_MESSAGE_BYTES) {
    truncated = truncated.slice(0, -1)
  }
  return `${truncated}…`
}

export interface RecipientContext {
  chatId: number
  firstName: string
  lastName?: string | null
  /** name-keyed chart courses of THIS user (terms + moaref). */
  chartCourses: Map<string, ChartCourse>
  /** names the user already passed - excluded from notifications. */
  passedNames: Set<string>
  /** offering indexes this user noted - get the detailed treatment. */
  notedIndexes: Set<string>
}

export function getDisplayName(
  firstName?: string | null,
  lastName?: string | null
): string {
  const full = [firstName?.trim(), lastName?.trim()]
    .filter(Boolean)
    .join(" ")
    .trim()
  return full || "دانشجوی عزیز"
}

export function buildGreeting(
  firstName?: string | null,
  lastName?: string | null,
  template: string = "سلام {name} عزیز"
): string {
  const name = getDisplayName(firstName, lastName)
  return template.replace("{name}", name)
}

export function renderAnnouncementMessage(
  firstName: string | null,
  lastName: string | null,
  body: string,
  opts: RenderOptions = {}
): string {
  if (!opts.includeGreeting) return truncateToTelegramLimit(body)
  const greet = buildGreeting(
    firstName,
    lastName,
    opts.greetingTemplate?.trim() || "سلام {name} عزیز"
  )
  return truncateToTelegramLimit(`${greet}\n\n${body}`)
}

export function renderOpenAppButton(): { text: string; url: string } | null {
  if (!config.TELEGRAM_APP_URL) return null
  return { text: OPEN_APP_BUTTON_TEXT, url: config.TELEGRAM_APP_URL }
}

export interface RenderOptions {
  includeGreeting?: boolean
  greetingTemplate?: string | null // e.g. "سلام {name} عزیز" – {name} replaced with display name
}

export function renderCourseChangeMessage(
  recipient: RecipientContext,
  diff: OfferingDiff,
  termLabel: string,
  opts: RenderOptions = {}
): string {
  const includeGreeting = opts.includeGreeting ?? true
  const lines: string[] = []
  if (includeGreeting) {
    const greeting = buildGreeting(
      recipient.firstName,
      recipient.lastName,
      opts.greetingTemplate?.trim() || "سلام {name} عزیز"
    )
    lines.push(greeting, `🔔 لیست درس بروزرسانی شد`)
  } else {
    lines.push(`🔔 لیست درس بروزرسانی شد`)
  }

  const isRelevant = (courseName: string) =>
    recipient.chartCourses.has(courseName) &&
    !recipient.passedNames.has(courseName)

  const relevantNew = diff.added.filter((o) => isRelevant(o.courseName))
  const relevantUpdated = diff.updated.filter((u) =>
    isRelevant(u.after.courseName)
  )
  const relevantRemoved = diff.removed.filter((o) => isRelevant(o.courseName))

  if (relevantNew.length > 0) {
    lines.push(`➕ درس جدید: ${toFa(relevantNew.length)} مورد`)
  }
  if (relevantUpdated.length > 0) {
    lines.push(`🔄 تغییرات جزئی: ${toFa(relevantUpdated.length)} مورد`)
  }
  if (relevantRemoved.length > 0) {
    lines.push(`❌ حذف: ${toFa(relevantRemoved.length)} مورد`)
  }

  // Detailed section for courses this user explicitly noted.
  const notedUpdated = diff.updated.filter((u) =>
    recipient.notedIndexes.has(u.after.index)
  )
  const notedDeleted = diff.removed.filter((o) =>
    recipient.notedIndexes.has(o.index)
  )

  if (notedUpdated.length > 0 || notedDeleted.length > 0) {
    lines.push("", `📌 تغییرات در درس‌های انتخابی شما:`)

    if (notedUpdated.length > 0) {
      lines.push(`✏️ تغییرات در ${toFa(notedUpdated.length)} مورد:`)
      for (const update of notedUpdated) {
        lines.push(
          `- ${update.after.courseName} (کد: ${update.after.courseCode})`
        )
        for (const change of update.changes) {
          lines.push(`  • ${change.label}`)
          if (change.before !== null) lines.push(`     قبلی: ${change.before}`)
          lines.push(`     جدید: ${change.after ?? "—"}`)
        }
      }
    }

    if (notedDeleted.length > 0) {
      lines.push(`🗑 حذف ${toFa(notedDeleted.length)} مورد:`)
      for (const course of notedDeleted) {
        lines.push(`- ${course.courseName} (کد: ${course.courseCode})`)
      }
    }
  }

  lines.push("", `📚 ترم: ${termLabel}`)
  return truncateToTelegramLimit(lines.join("\n"))
}

export function termLabel(year: number, semester: Semester): string {
  const labels: Record<Semester, string> = {
    MEHR: "مهر",
    BAHMAN: "بهمن",
    SUMMER: "تابستان",
  }
  return `${toFa(year)} - ${labels[semester]}`
}

function toFa(value: number | string): string {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)] ?? d)
}

/** Type-only helper re-export so callers keep Offering import locality. */
export type { Offering }
