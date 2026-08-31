import { and, asc, eq, inArray, sql } from "drizzle-orm"

import type {
  NotificationBatch,
  NotificationMessage,
} from "@workspace/db/schema"
import {
  completedOfferingDiffs,
  notedCourses,
  notificationBatches,
  notificationMessages,
  passedCourses,
  universityProfiles,
  users,
} from "@workspace/db/schema"
import {
  type ChartCourse,
  getChart,
  getOfferingDiff,
  getOfferings,
  getPreviousOfferings,
  parseYearDirectory,
  yearDirectoryCovers,
} from "@workspace/registry"
import type { Semester } from "@workspace/registry"
import { randomUUID } from "node:crypto"

import { db } from "@/lib/db"
import { calculateOfferingChanges, diffSummary } from "@/lib/notifications/diff"
import {
  renderAnnouncementMessage,
  renderCourseChangeMessage,
  termLabel,
} from "@/lib/notifications/render"
import { sendMessage, sendRichMessage } from "@/lib/telegram/bot"

/**
 * The resumable notification pipeline:
 *
 *   detect(uni, major, year, semester)
 *     -> diffs registry new.json vs old.json
 *     -> creates ONE batch (READY) + one personalized PENDING message per
 *        eligible student of that major
 *
 *   sendNext(batchId)   <- the dashboard loops this while the admin is online
 *     -> claims a single PENDING/SENDING row atomically
 *     -> sends via bot, commits that row's status alone
 *     -> crash mid-campaign loses nothing; next call resumes at the same row
 */

export interface DetectInput {
  universitySlug: string
  majorSlug: string
  year: number
  semester: Semester
  adminChatId: number
  includeGreeting?: boolean
  greetingTemplate?: string | null
  includeButton?: boolean
}

export interface DetectResult {
  batch: NotificationBatch
  summary: { added: number; removed: number; changed: number }
  recipients: number
}

export interface DetectAllResult {
  total: number
  created: number
  skipped: number
  errors: number
  batches: NotificationBatch[]
}

export async function detectAndCreateBatch(
  input: DetectInput
): Promise<DetectResult> {
  const current = getOfferings(
    input.universitySlug,
    input.majorSlug,
    input.year,
    input.semester
  )
  if (!current) throw new Error("SNAPSHOT_NOT_FOUND")

  const previous = getPreviousOfferings(
    input.universitySlug,
    input.majorSlug,
    input.year,
    input.semester
  )

  const diff = calculateOfferingChanges(current, previous)
  const summary = diffSummary(diff)

  // First snapshots have no baseline - notifying "everything was added" would
  // be noise; the old system only notified on real updates too.
  if (!previous || summary.added + summary.removed + summary.changed === 0) {
    throw new Error("NO_CHANGES")
  }

  // UUID from diff.json is the source of truth (sync script generates fresh UUID per new.json change).
  // If diff.json missing (legacy term), fallback to summary hash.
  const diffDoc = getOfferingDiff(
    input.universitySlug,
    input.majorSlug,
    input.year,
    input.semester
  )
  const diffIdFromDoc = diffDoc?.id ?? null
  // Check completed diffs table - once a UUID is marked completed it never shows again
  if (diffIdFromDoc) {
    const [completed] = await db
      .select({ diffId: completedOfferingDiffs.diffId })
      .from(completedOfferingDiffs)
      .where(eq(completedOfferingDiffs.diffId, diffIdFromDoc))
      .limit(1)
    if (completed) throw new Error("NO_CHANGES")
  }

  const affected = new Set<string>()
  for (const o of diff.added) affected.add(o.index)
  for (const o of diff.removed) affected.add(o.index)
  for (const u of diff.updated) affected.add(u.after.index)

  // Eligible recipients: students of this uni+major, not banned.
  const recipients = await db
    .select({
      chatId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      degree: universityProfiles.degree,
      entryYearRange: universityProfiles.entryYearRange,
      entrySemester: universityProfiles.entrySemester,
    })
    .from(users)
    .innerJoin(universityProfiles, eq(universityProfiles.userId, users.id))
    .where(
      and(
        eq(users.banned, false),
        eq(universityProfiles.universitySlug, input.universitySlug),
        eq(universityProfiles.majorSlug, input.majorSlug)
      )
    )

  if (recipients.length === 0) throw new Error("NO_RECIPIENTS")

  // Noted courses matching the affected offerings -> per-user index sets.
  const notedRows = await db
    .select({
      userId: notedCourses.userId,
      courseIndex: notedCourses.courseIndex,
    })
    .from(notedCourses)
    .where(
      and(
        eq(notedCourses.universitySlug, input.universitySlug),
        eq(notedCourses.majorSlug, input.majorSlug),
        eq(notedCourses.isDeleted, false),
        inArray(notedCourses.courseIndex, [...affected])
      )
    )
  const notedByUser = new Map<number, Set<string>>()
  for (const row of notedRows) {
    const set = notedByUser.get(row.userId) ?? new Set<string>()
    set.add(row.courseIndex)
    notedByUser.set(row.userId, set)
  }

  // Passed course NAMES per user - excluded from notification relevance.
  const recipientIds = recipients.map((r) => r.chatId)
  const passedRows = await db
    .select({
      userId: passedCourses.userId,
      courseName: passedCourses.courseName,
    })
    .from(passedCourses)
    .where(inArray(passedCourses.userId, recipientIds))
  const passedByUser = new Map<number, Set<string>>()
  for (const row of passedRows) {
    const set = passedByUser.get(row.userId) ?? new Set<string>()
    set.add(row.courseName)
    passedByUser.set(row.userId, set)
  }

  const label = `${input.year}/${input.semester.toLowerCase()}`
  const title = `تغییرات ارائه‌ها - ${input.universitySlug}/${input.majorSlug} (${label})`
  // Prefer diff.json UUID; fallback to randomUUID for legacy terms without diff.json
  const diffDocForId = getOfferingDiff(
    input.universitySlug,
    input.majorSlug,
    input.year,
    input.semester
  )
  const diffId = diffDocForId?.id ?? randomUUID()

  const includeGreeting = input.includeGreeting ?? true
  const greetingTemplate = input.greetingTemplate?.trim() || "سلام {name} عزیز"
  const includeButton = input.includeButton ?? true

  const [batch] = await db
    .insert(notificationBatches)
    .values({
      type: "COURSE_CHANGES",
      status: "READY",
      title,
      universitySlug: input.universitySlug,
      majorSlug: input.majorSlug,
      diffId,
      payload: {
        universitySlug: input.universitySlug,
        majorSlug: input.majorSlug,
        semesterFile: label,
        diffId,
        ...summary,
        includeGreeting,
        greetingTemplate,
        includeButton,
      } as any,
      totalMessages: recipients.length,
      createdById: input.adminChatId,
    })
    .onConflictDoNothing({ target: notificationBatches.diffId })
    .returning()

  if (!batch) {
    // Unique violation on diffId -> another concurrent detect already created the batch
    if (diffId) {
      const [existing] = await db
        .select()
        .from(notificationBatches)
        .where(eq(notificationBatches.diffId, diffId))
        .limit(1)
      if (existing) throw new Error("NO_CHANGES")
    }
    throw new Error("BATCH_INSERT_FAILED")
  }

  const rows = recipients.map((recipient) => {
    // The user's own chart (terms + moaref), name-keyed like the old system.
    // entryYearRange IS the chart directory name ("[1403-1404]" or "1405");
    // getChart falls back to both.json when needed and returns null when the
    // profile's chart no longer exists (renamed cohort etc).
    const chartCourses = new Map<string, ChartCourse>()
    if (
      recipient.entryYearRange &&
      recipient.entrySemester &&
      recipient.degree
    ) {
      const chart = getChart(
        input.universitySlug,
        input.majorSlug,
        recipient.degree,
        recipient.entryYearRange,
        recipient.entrySemester as Semester
      )
      if (chart) {
        for (const courses of Object.values(chart.terms)) {
          for (const course of courses) chartCourses.set(course.name, course)
        }
        for (const course of chart.moaref) chartCourses.set(course.name, course)
      }
    }

    const body = renderCourseChangeMessage(
      {
        chatId: recipient.chatId,
        firstName: recipient.firstName,
        lastName: (recipient as any).lastName,
        chartCourses,
        passedNames: passedByUser.get(recipient.chatId) ?? new Set(),
        notedIndexes: notedByUser.get(recipient.chatId) ?? new Set(),
      },
      diff,
      termLabel(input.year, input.semester),
      { includeGreeting, greetingTemplate }
    )

    return {
      batchId: batch.id,
      userId: recipient.chatId,
      chatId: recipient.chatId,
      body,
    }
  })

  // Chunked insert keeps parameter counts sane for large majors.
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(notificationMessages).values(rows.slice(i, i + 500))
  }

  return { batch, summary, recipients: recipients.length }
}

export async function detectAllAndCreateBatches(
  adminChatId: number,
  opts?: {
    includeGreeting?: boolean
    greetingTemplate?: string | null
    includeButton?: boolean
  }
): Promise<DetectAllResult> {
  const { listUniversitySlugs, listMajorSlugs, listOfferingTerms } =
    await import("@workspace/registry")
  const universities = listUniversitySlugs()
  let total = 0
  let created = 0
  let skipped = 0
  let errors = 0
  const batches: NotificationBatch[] = []
  const tasks: Promise<void>[] = []

  for (const uni of universities) {
    const majors = listMajorSlugs(uni)
    for (const major of majors) {
      const terms = listOfferingTerms(uni, major)
      for (const term of terms) {
        total++
        tasks.push(
          detectAndCreateBatch({
            universitySlug: uni,
            majorSlug: major,
            year: term.year,
            semester: term.semester,
            adminChatId,
            includeGreeting: opts?.includeGreeting,
            greetingTemplate: opts?.greetingTemplate,
            includeButton: opts?.includeButton,
          })
            .then((res) => {
              batches.push(res.batch)
              created++
            })
            .catch((e) => {
              const msg = e instanceof Error ? e.message : ""
              if (
                msg === "NO_CHANGES" ||
                msg === "NO_RECIPIENTS" ||
                msg === "SNAPSHOT_NOT_FOUND"
              ) {
                skipped++
              } else {
                errors++
              }
            })
        )
        // batch concurrency to avoid DB overload
        if (tasks.length >= 12) {
          await Promise.allSettled(tasks.splice(0, tasks.length))
        }
      }
    }
  }
  if (tasks.length > 0) await Promise.allSettled(tasks)
  return { total, created, skipped, errors, batches }
}

/** One resumable send step. Returns progress info for the dashboard loop. */
export async function sendNextMessage(batchId: string): Promise<
  | { done: true; sentCount: number; failedCount: number }
  | {
      done: false
      messageId: string
      remaining: number
      outcome: "SENT" | "FAILED"
      error?: string
    }
  | null
> {
  // Claim one row atomically. SENDING leftovers from a crashed run are fair
  // game again here - that IS the resume mechanism.
  const claimed = await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(notificationMessages)
      .where(
        and(
          eq(notificationMessages.batchId, batchId),
          inArray(notificationMessages.status, ["PENDING", "SENDING"])
        )
      )
      .orderBy(asc(notificationMessages.createdAt))
      .limit(1)
      .for("update", { skipLocked: true })

    if (!candidate) return null

    await tx
      .update(notificationMessages)
      .set({
        status: "SENDING",
        attempts: candidate.attempts + 1,
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notificationMessages.id, candidate.id))

    return candidate
  })

  const batch = await readBatch(batchId)
  if (!batch) return null

  if (!claimed) {
    // Nothing pending left -> finalize.
    if (batch.status === "SENDING") {
      await db
        .update(notificationBatches)
        .set({ status: "COMPLETED", updatedAt: new Date() })
        .where(eq(notificationBatches.id, batchId))
    }
    return {
      done: true,
      sentCount: batch.sentCount,
      failedCount: batch.failedCount,
    }
  }

  if (batch.status === "READY") {
    await db
      .update(notificationBatches)
      .set({ status: "SENDING", updatedAt: new Date() })
      .where(eq(notificationBatches.id, batchId))
  }

  // Rich broadcast: if batch.payload carries media/fileId/buttons, use sendRichMessage so fileId/button is reused
  const rich = batch.payload as {
    parseMode?: string | null
    photoUrl?: string | null
    videoUrl?: string | null
    documentUrl?: string | null
    photoFileId?: string | null
    videoFileId?: string | null
    documentFileId?: string | null
    buttons?: { text: string; url: string }[][] | null
    disablePreview?: boolean | null
    includeButton?: boolean | null
    includeGreeting?: boolean | null
  } | null
  const hasRichPayload = Boolean(
    rich &&
    (rich.photoUrl ||
      rich.videoUrl ||
      rich.documentUrl ||
      rich.photoFileId ||
      rich.videoFileId ||
      rich.documentFileId ||
      rich.buttons?.length ||
      rich.parseMode)
  )
  // For course changes, include open app button if enabled (not stored in rich)
  const courseIncludeButton = (rich as any)?.includeButton
  const shouldIncludeButton = hasRichPayload
    ? true
    : courseIncludeButton !== false
  const openAppBtn = shouldIncludeButton
    ? (await import("@/lib/notifications/render.ts")).renderOpenAppButton()
    : null

  const result = hasRichPayload
    ? await sendRichMessage(claimed.chatId, {
        text: claimed.body,
        parseMode:
          (rich?.parseMode as "HTML" | "Markdown" | "MarkdownV2" | undefined) ??
          undefined,
        photoUrl: rich?.photoUrl ?? undefined,
        videoUrl: rich?.videoUrl ?? undefined,
        documentUrl: rich?.documentUrl ?? undefined,
        photoFileId: rich?.photoFileId ?? undefined,
        videoFileId: rich?.videoFileId ?? undefined,
        documentFileId: rich?.documentFileId ?? undefined,
        buttons: rich?.buttons ?? (openAppBtn ? [[openAppBtn]] : undefined),
        disablePreview: rich?.disablePreview ?? undefined,
      })
    : openAppBtn
      ? await sendRichMessage(claimed.chatId, {
          text: claimed.body,
          buttons: [[openAppBtn]],
        })
      : await sendMessage(claimed.chatId, claimed.body)

  let outcome: "SENT" | "FAILED"
  let error: string | undefined

  const isPermanentError = (msg?: string) =>
    !!msg &&
    /400|chat not found|blocked|deactivated|kicked|not found|Forbidden/i.test(
      msg
    )

  // Permanent errors (chat not found / blocked) – consider as "tried" and don't retry, like old system
  const shouldRetry =
    !result.ok &&
    !isPermanentError(result.error) &&
    claimed.attempts + 1 < claimed.maxAttempts

  if (result.ok || !shouldRetry) {
    // For permanent failures we still count as attempted (user tried) – mark FAILED but don't keep retrying
    outcome = result.ok ? "SENT" : "FAILED"
    error = result.ok ? undefined : (result.error ?? "unknown")
    await db
      .update(notificationMessages)
      .set({
        status: outcome,
        lastError: error ?? null,
        sentAt: outcome === "SENT" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(notificationMessages.id, claimed.id))

    await db
      .update(notificationBatches)
      .set(
        outcome === "SENT"
          ? {
              sentCount: sql`${notificationBatches.sentCount} + 1`,
              updatedAt: new Date(),
            }
          : {
              failedCount: sql`${notificationBatches.failedCount} + 1`,
              updatedAt: new Date(),
            }
      )
      .where(eq(notificationBatches.id, batchId))
  } else {
    // Transient failure with attempts left: back to PENDING for the next run.
    outcome = "FAILED"
    error = result.error
    await db
      .update(notificationMessages)
      .set({ status: "PENDING", lastError: error, updatedAt: new Date() })
      .where(eq(notificationMessages.id, claimed.id))
  }

  const remaining = await countRemaining(batchId)
  return {
    done: false,
    messageId: claimed.id,
    remaining,
    outcome,
    ...(error !== undefined ? { error } : {}),
  }
}

export async function sendNextBatch(
  batchId: string,
  count = 30
): Promise<{
  sent: number
  failed: number
  remaining: number
  done: boolean
  results: Array<{
    messageId: string
    outcome: "SENT" | "FAILED"
    error?: string
  }>
}> {
  // Optimized: claim 30 rows in one transaction, send, then bulk update DB in 2 queries
  const batch = await readBatch(batchId)
  if (!batch)
    return { sent: 0, failed: 0, remaining: 0, done: true, results: [] }

  if (batch.status === "READY") {
    await db
      .update(notificationBatches)
      .set({ status: "SENDING", updatedAt: new Date() })
      .where(eq(notificationBatches.id, batchId))
  }

  const claimed = await db.transaction(async (tx) => {
    const candidates = await tx
      .select()
      .from(notificationMessages)
      .where(
        and(
          eq(notificationMessages.batchId, batchId),
          inArray(notificationMessages.status, ["PENDING", "SENDING"])
        )
      )
      .orderBy(asc(notificationMessages.createdAt))
      .limit(count)
      .for("update", { skipLocked: true })

    if (candidates.length === 0) return []

    const ids = candidates.map((c) => c.id)
    await tx
      .update(notificationMessages)
      .set({
        status: "SENDING",
        lastAttemptAt: new Date(),
        updatedAt: new Date(),
        attempts: sql`${notificationMessages.attempts} + 1`,
      })
      .where(inArray(notificationMessages.id, ids))

    return candidates
  })

  if (claimed.length === 0) {
    const remaining = await countRemaining(batchId)
    const done = remaining === 0
    if (done && batch.status === "SENDING") {
      await db
        .update(notificationBatches)
        .set({ status: "COMPLETED", updatedAt: new Date() })
        .where(eq(notificationBatches.id, batchId))
    }
    return { sent: 0, failed: 0, remaining, done, results: [] }
  }

  const rich = batch.payload as {
    parseMode?: string | null
    photoUrl?: string | null
    videoUrl?: string | null
    documentUrl?: string | null
    photoFileId?: string | null
    videoFileId?: string | null
    documentFileId?: string | null
    buttons?: { text: string; url: string }[][] | null
    disablePreview?: boolean | null
  } | null
  const hasRichPayload = Boolean(
    rich &&
    (rich.photoUrl ||
      rich.videoUrl ||
      rich.documentUrl ||
      rich.photoFileId ||
      rich.videoFileId ||
      rich.documentFileId ||
      rich.buttons?.length ||
      rich.parseMode)
  )

  const results: Array<{
    messageId: string
    outcome: "SENT" | "FAILED"
    error?: string
  }> = []
  const sentIds: string[] = []
  const failedIds: string[] = []
  const sentWithError: Array<{ id: string; error: string }> = []

  for (const msg of claimed) {
    const res = hasRichPayload
      ? await sendRichMessage(msg.chatId, {
          text: msg.body,
          parseMode: (rich?.parseMode as any) ?? undefined,
          photoUrl: rich?.photoUrl ?? undefined,
          videoUrl: rich?.videoUrl ?? undefined,
          documentUrl: rich?.documentUrl ?? undefined,
          photoFileId: rich?.photoFileId ?? undefined,
          videoFileId: rich?.videoFileId ?? undefined,
          documentFileId: rich?.documentFileId ?? undefined,
          buttons: rich?.buttons ?? undefined,
          disablePreview: rich?.disablePreview ?? undefined,
        })
      : await sendMessage(msg.chatId, msg.body)

    const isPermanentError = (e?: string) =>
      !!e &&
      /400|chat not found|blocked|deactivated|kicked|not found|Forbidden/i.test(
        e
      )
    // Dry mode or chat not found → treat as tried (don't retry forever)
    const shouldMarkFailed = !res.ok

    if (res.ok) {
      sentIds.push(msg.id)
      results.push({ messageId: msg.id, outcome: "SENT" })
    } else {
      // For permanent errors, mark FAILED immediately; for transient, we still mark FAILED after one attempt in bulk mode (no retry loop for 30-batch)
      failedIds.push(msg.id)
      sentWithError.push({ id: msg.id, error: res.error ?? "unknown" })
      results.push({ messageId: msg.id, outcome: "FAILED", error: res.error })
    }
  }

  // Bulk DB update: 2 queries for messages + 1 for batch counters (optimized)
  if (sentIds.length > 0) {
    await db
      .update(notificationMessages)
      .set({
        status: "SENT",
        sentAt: new Date(),
        updatedAt: new Date(),
        lastError: null,
      })
      .where(inArray(notificationMessages.id, sentIds))
  }
  if (failedIds.length > 0) {
    // Enterprise: per-row parameterized updates — avoids sql.raw injection from Telegram error strings
    // Single query CASE with interpolated error is unsafe (Telegram description can contain '); use N safe queries.
    await Promise.all(
      sentWithError.map((f) =>
        db
          .update(notificationMessages)
          .set({
            status: "FAILED",
            lastError: f.error.slice(0, 500),
            updatedAt: new Date(),
          })
          .where(eq(notificationMessages.id, f.id))
      )
    )
    // Fallback for any failedIds without explicit error entry (should not happen)
    const withErrorIds = new Set(sentWithError.map((f) => f.id))
    const withoutError = failedIds.filter((id) => !withErrorIds.has(id))
    if (withoutError.length > 0) {
      await db
        .update(notificationMessages)
        .set({
          status: "FAILED",
          lastError: "نامشخص",
          updatedAt: new Date(),
        })
        .where(inArray(notificationMessages.id, withoutError))
    }
  }

  if (sentIds.length > 0 || failedIds.length > 0) {
    await db
      .update(notificationBatches)
      .set({
        sentCount:
          sentIds.length > 0
            ? sql`${notificationBatches.sentCount} + ${sentIds.length}`
            : undefined,
        failedCount:
          failedIds.length > 0
            ? sql`${notificationBatches.failedCount} + ${failedIds.length}`
            : undefined,
        updatedAt: new Date(),
      })
      .where(eq(notificationBatches.id, batchId))
  }

  const remaining = await countRemaining(batchId)
  const done = remaining === 0
  if (done) {
    await db
      .update(notificationBatches)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(notificationBatches.id, batchId))
  }

  return {
    sent: sentIds.length,
    failed: failedIds.length,
    remaining,
    done,
    results,
  }
}

async function readBatch(batchId: string): Promise<NotificationBatch | null> {
  const [row] = await db
    .select()
    .from(notificationBatches)
    .where(eq(notificationBatches.id, batchId))
    .limit(1)
  return row ?? null
}

async function countRemaining(batchId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationMessages)
    .where(
      and(
        eq(notificationMessages.batchId, batchId),
        inArray(notificationMessages.status, ["PENDING", "SENDING"])
      )
    )
  return row?.count ?? 0
}

/** Batch list for the Notification Center. Filters out batches whose diff UUID is marked completed. */
export async function listBatches(): Promise<NotificationBatch[]> {
  const batches = await db
    .select()
    .from(notificationBatches)
    .orderBy(sql`${notificationBatches.createdAt} desc`)
    .limit(100)
  // Filter out COURSE_CHANGES batches whose diffId is in completed_offering_diffs
  const diffIds = batches
    .map((b) => (b.payload as { diffId?: string } | null)?.diffId)
    .filter((id): id is string => Boolean(id))
  if (diffIds.length === 0) return batches
  const completed = await db
    .select({ diffId: completedOfferingDiffs.diffId })
    .from(completedOfferingDiffs)
    .where(inArray(completedOfferingDiffs.diffId, diffIds))
  const completedSet = new Set(completed.map((c) => c.diffId))
  return batches.filter((b) => {
    const did = (b.payload as { diffId?: string } | null)?.diffId
    if (!did) return true
    // Only filter COURSE_CHANGES by completed diffs; ANNOUNCEMENT batches have no diffId
    if (b.type !== "COURSE_CHANGES") return true
    return !completedSet.has(did)
  })
}

export async function completeOfferingDiff(
  diffId: string,
  adminChatId: number
): Promise<void> {
  // validate uuid
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      diffId
    )
  )
    throw new Error("INVALID_UUID")
  await db
    .insert(completedOfferingDiffs)
    .values({
      diffId,
      completedById: adminChatId,
    })
    .onConflictDoNothing()
}

/** Also dismiss by batch id - extracts diffId from batch payload */
export async function completeBatchDiff(
  batchId: string,
  adminChatId: number
): Promise<string | null> {
  const [batch] = await db
    .select({ payload: notificationBatches.payload })
    .from(notificationBatches)
    .where(eq(notificationBatches.id, batchId))
    .limit(1)
  if (!batch) return null
  const diffId = (batch.payload as { diffId?: string } | null)?.diffId
  if (!diffId) return null
  await completeOfferingDiff(diffId, adminChatId)
  return diffId
}

/**
 * Manual admin broadcast (batch type ANNOUNCEMENT) with the Notification
 * Center's advanced audience filter: university / major / entry years /
 * entry semester / gender. One personalized greeting + text per recipient;
 * the batch goes through the same resumable send-next loop.
 */
export async function createAnnouncementBatch(input: {
  body: string
  universitySlug?: string | null
  universitySlugs?: string[] | null
  majorSlug?: string | null
  majorSlugs?: string[] | null
  /** Entry years - matched against each profile's chart dir ("[1403-1404]"
      covers 1404). Resolved in memory via registry year-dir utilities. */
  entryYears?: number[] | null
  entrySemester?: Semester | null
  entrySemesters?: Semester[] | null
  gender?: "MALE" | "FEMALE" | null
  genders?: Array<"MALE" | "FEMALE"> | null
  parseMode?: "HTML" | "Markdown" | "MarkdownV2" | null
  photoUrl?: string | null
  videoUrl?: string | null
  documentUrl?: string | null
  photoFileId?: string | null
  videoFileId?: string | null
  documentFileId?: string | null
  buttons?: { text: string; url: string }[][] | null
  disablePreview?: boolean | null
  includeGreeting?: boolean | null
  greetingTemplate?: string | null
  includeButton?: boolean | null
  adminChatId: number
}): Promise<{ batch: NotificationBatch; recipients: number }> {
  const uniSlugs =
    input.universitySlugs ??
    (input.universitySlug ? [input.universitySlug] : null)
  const majorSlugs =
    input.majorSlugs ?? (input.majorSlug ? [input.majorSlug] : null)
  const genders =
    (input as any).genders ?? (input.gender ? [input.gender] : null)
  const semesters =
    (input as any).entrySemesters ??
    (input.entrySemester ? [input.entrySemester] : null)
  if (uniSlugs && uniSlugs.length > 10) throw new Error("TOO_MANY_VALUES")
  if (majorSlugs && majorSlugs.length > 10) throw new Error("TOO_MANY_VALUES")
  if (genders && genders.length > 2) throw new Error("TOO_MANY_VALUES")
  if (semesters && (semesters as unknown[]).length > 3)
    throw new Error("TOO_MANY_VALUES")
  if (input.entryYears && input.entryYears.length > 10)
    throw new Error("TOO_MANY_VALUES")
  const hasProfileFilter =
    Boolean(uniSlugs?.length) ||
    Boolean(majorSlugs?.length) ||
    Boolean(semesters?.length) ||
    Boolean(genders?.length) ||
    Boolean(input.entryYears?.length)
  const scope = [
    eq(users.banned, false),
    ...(uniSlugs ? [inArray(universityProfiles.universitySlug, uniSlugs)] : []),
    ...(majorSlugs ? [inArray(universityProfiles.majorSlug, majorSlugs)] : []),
    ...(semesters
      ? [inArray(universityProfiles.entrySemester, semesters as any)]
      : []),
    ...(genders ? [inArray(universityProfiles.gender, genders as any)] : []),
  ]

  // "همه" (all filters unset) must reach EVERY user - including the ones who
  // never completed /setup and therefore have no university_profiles row.
  // Only join profiles when a profile-based filter is actually active.
  const candidates = hasProfileFilter
    ? await db
        .select({
          chatId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          degree: universityProfiles.degree,
          entryYearRange: universityProfiles.entryYearRange,
        })
        .from(users)
        .innerJoin(universityProfiles, eq(universityProfiles.userId, users.id))
        .where(and(...scope))
    : await db
        .select({
          chatId: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          degree: sql<string | null>`null`,
          entryYearRange: sql<string | null>`null`,
        })
        .from(users)
        .where(and(...scope))

  const wantedYears =
    input.entryYears && input.entryYears.length > 0
      ? [...new Set(input.entryYears)]
      : null

  // De-duplicate while applying the year-coverage filter (a profile in the
  // "[1403-1404]" cohort matches a broadcast targeting 1404).
  const seen = new Set<number>()
  const targets = candidates.filter((r) => {
    if (seen.has(r.chatId)) return false

    if (wantedYears) {
      const parsed = r.entryYearRange
        ? parseYearDirectory(r.entryYearRange)
        : null
      if (!parsed || !wantedYears.some((y) => yearDirectoryCovers(parsed, y))) {
        return false
      }
    }

    seen.add(r.chatId)
    return true
  })

  if (targets.length === 0) throw new Error("NO_RECIPIENTS")

  const uniLabel = uniSlugs ? uniSlugs.join("،") : input.universitySlug
  const majorLabel = majorSlugs ? majorSlugs.join("،") : input.majorSlug
  const semLabel = semesters
    ? (semesters as string[]).join("،")
    : input.entrySemester
  const genderLabel = genders
    ? genders.map((g: string) => (g === "MALE" ? "پسران" : "دختران")).join("،")
    : input.gender === "MALE"
      ? "پسران"
      : input.gender === "FEMALE"
        ? "دختران"
        : null
  const scopeLabel =
    [
      uniLabel,
      majorLabel,
      wantedYears ? `ورود ${wantedYears.join("، ")}` : null,
      semLabel ?? null,
      genderLabel,
    ]
      .filter(Boolean)
      .join(" / ") || "همه"

  const title = `اعلان دستی - ${scopeLabel}`

  const hasMedia = Boolean(
    input.photoUrl ||
    input.videoUrl ||
    input.documentUrl ||
    input.photoFileId ||
    input.videoFileId ||
    input.documentFileId ||
    input.parseMode ||
    input.buttons?.length ||
    input.disablePreview !== null
  )

  const richPayload = hasMedia
    ? {
        body: input.body,
        parseMode: input.parseMode ?? null,
        photoUrl: input.photoUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        documentUrl: input.documentUrl ?? null,
        photoFileId: input.photoFileId ?? null,
        videoFileId: input.videoFileId ?? null,
        documentFileId: input.documentFileId ?? null,
        buttons: input.buttons ?? null,
        disablePreview: input.disablePreview ?? null,
      }
    : null

  // Greeting & button config
  const includeGreeting = input.includeGreeting ?? true
  const greetingTemplate = input.greetingTemplate?.trim() || "سلام {name} عزیز"
  const includeButton = input.includeButton ?? true
  const openAppBtn = includeButton
    ? await import("@/lib/notifications/render.ts").then((m) =>
        m.renderOpenAppButton()
      )
    : null
  const finalButtons = (() => {
    const btns = input.buttons ? [...input.buttons] : []
    if (openAppBtn) {
      // Add open app button as last row if not already present
      const hasOpen = btns.some((row) =>
        row.some((b) => b.text === openAppBtn.text)
      )
      if (!hasOpen) btns.push([openAppBtn])
    }
    return btns.length ? btns : null
  })()
  const finalRichPayload = hasMedia
    ? {
        body: input.body,
        parseMode: input.parseMode ?? null,
        photoUrl: input.photoUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        documentUrl: input.documentUrl ?? null,
        photoFileId: input.photoFileId ?? null,
        videoFileId: input.videoFileId ?? null,
        documentFileId: input.documentFileId ?? null,
        buttons: finalButtons,
        disablePreview: input.disablePreview ?? null,
        includeGreeting,
        greetingTemplate: includeGreeting ? greetingTemplate : null,
        includeButton,
      }
    : includeButton && openAppBtn
      ? {
          body: input.body,
          buttons: finalButtons,
          includeGreeting,
          greetingTemplate: includeGreeting ? greetingTemplate : null,
          includeButton,
        }
      : null

  const [batch] = await db
    .insert(notificationBatches)
    .values({
      type: "ANNOUNCEMENT",
      status: "READY",
      title,
      universitySlug: input.universitySlug ?? null,
      majorSlug: input.majorSlug ?? null,
      payload: (finalRichPayload ??
        richPayload) as unknown as NotificationBatch["payload"],
      totalMessages: targets.length,
      createdById: input.adminChatId,
    })
    .returning()
  if (!batch) throw new Error("BATCH_INSERT_FAILED")

  const rows = targets.map((r) => {
    const body = renderAnnouncementMessage(
      r.firstName,
      (r as any).lastName ?? null,
      input.body,
      { includeGreeting, greetingTemplate }
    )
    return {
      batchId: batch.id,
      userId: r.chatId,
      chatId: r.chatId,
      body,
    }
  })
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(notificationMessages).values(rows.slice(i, i + 500))
  }

  return { batch, recipients: targets.length }
}

/** Messages of a batch, optionally filtered by status. */
export async function listBatchMessages(
  batchId: string,
  status?: NotificationMessage["status"]
): Promise<NotificationMessage[]> {
  const where = status
    ? and(
        eq(notificationMessages.batchId, batchId),
        eq(notificationMessages.status, status)
      )
    : eq(notificationMessages.batchId, batchId)
  return db.select().from(notificationMessages).where(where).limit(200)
}
