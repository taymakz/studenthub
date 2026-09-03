import { zValidator } from "@hono/zod-validator"
import {
  chartFiles,
  failedCourses,
  friendships,
  notedCourses,
  passedCourses,
  universityProfiles,
  uploads,
  users,
} from "@workspace/db/schema"
import type { ChartDoc, Offering, Semester } from "@workspace/registry"
import { formatYearDirectory } from "@workspace/registry"
import { and, desc, eq, inArray, or, sql } from "drizzle-orm"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { join, relative, resolve, sep } from "node:path"
import { Hono } from "hono"
import { z } from "zod"

import { config } from "@/config"
import { db } from "@/lib/db"
import {
  deleteExportObject,
  getExportBytes,
  isExportStorageConfigured,
  publicExportUrl,
  presignExportPut,
} from "@/lib/storage/s3"
import {
  badRequest,
  conflict,
  forbidden,
  internalServerError,
  notFound,
  ok,
  parsePagination,
} from "@/lib/http/common"
import {
  getCurrentTermCode,
  formatTermCode,
  parseTermCode,
  termLabelWithCode,
} from "@/lib/terms"
import {
  findChartYearDirForYear,
  getChart,
  getOfferings,
  getPreviousOfferings,
  listOfferingTerms,
  readIndexes,
  registryRoot,
} from "@/lib/registry"
import { calculateOfferingChanges, diffSummary } from "@/lib/notifications/diff"
import { ingestFile, ingestPdfBytes, sendStoredFile } from "@/lib/telegram/bot"
import type { AppEnv } from "@/middleware/auth"
import { requireUser, withUser } from "@/middleware/auth"

/** Enterprise: strict slug validation — registry slugs are kebab-case, year dirs are 1405 or [1400-1401] */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const YEAR_RANGE_RE = /^(\d{4}|\[\d{4}-\d{4}\])$/
function isSafeSlug(s: string): boolean {
  return SLUG_RE.test(s)
}
function isSafeYearRange(s: string): boolean {
  return YEAR_RANGE_RE.test(s)
}
function safeRegistryPath(...parts: string[]): string | null {
  const rel = parts.join("/")
  if (rel.includes("..") || rel.includes("\\")) return null
  const abs = resolve(registryRoot(), rel)
  const root = resolve(registryRoot())
  const relFromRoot = relative(root, abs)
  if (relFromRoot.startsWith("..")) return null
  return abs
}

/**
 * Current mini-app user + their course lists. Identity = Telegram chat id;
 * the profile references the git registry by slugs and may dangle - clients
 * handle «چارت پیدا نشد».
 */

async function offeringExists(
  universitySlug: string,
  majorSlug: string,
  courseIndex: string,
  year?: number,
  semester?: Semester
): Promise<boolean> {
  // Any term's snapshot counts - noted pins survive term rotation until the
  // offering disappears everywhere (the diff pipeline then soft-deletes).
  const fromIndex = readIndexes().offeringTerms.filter(
    (t) => t.uniSlug === universitySlug && t.majorSlug === majorSlug
  )
  const terms =
    fromIndex.length > 0
      ? fromIndex
      : listOfferingTerms(universitySlug, majorSlug).map((t) => ({
          uniSlug: universitySlug,
          majorSlug,
          year: t.year,
          semester: t.semester,
        }))
  for (const term of terms) {
    if (
      year !== undefined &&
      semester !== undefined &&
      (term.year !== year || term.semester !== semester)
    ) {
      continue
    }
    const doc = getOfferings(
      universitySlug,
      majorSlug,
      term.year,
      term.semester as Semester
    )
    if (doc?.offerings.some((o) => o.index === courseIndex)) return true
  }
  return false
}

/**
 * Normalize raw registry offerings to the API contract:
 * the registry stores `professor` as a plain string (e.g. "سید مهدی طباطبایی"),
 * while the mini-app expects `{ fa: string }`. Keep nulls as-is.
 */
function normalizeOfferings(offerings: Offering[]): Offering[] {
  return offerings.map((o) => {
    const p = (o as unknown as { professor: unknown }).professor
    if (typeof p === "string") {
      const trimmed = p.trim()
      return { ...o, professor: trimmed ? { fa: trimmed } : null }
    }
    // Already object/null — pass through unchanged.
    return o
  })
}

/** First year of an entry-cohort directory: "[1403-1404]" -> 1403, "1405" -> 1405. */
function entryYearStart(range: string | null | undefined): number | null {
  if (!range) return null
  const single = /^(\d{4})$/.exec(range)
  if (single) return Number(single[1])
  const pair = /^\[(\d{4})-(\d{4})\]$/.exec(range)
  if (pair) return Number(pair[1])
  return null
}

/** Sorted (oldest→newest) نیم‌سال codes that have offering snapshots. */
function availableSemesterCodes(
  universitySlug: string | null,
  majorSlug: string | null
): string[] {
  if (!universitySlug || !majorSlug) return []
  const fromIndex = readIndexes().offeringTerms.filter(
    (t) => t.uniSlug === universitySlug && t.majorSlug === majorSlug
  )
  const terms =
    fromIndex.length > 0
      ? fromIndex
      : listOfferingTerms(universitySlug, majorSlug).map((t) => ({
          uniSlug: universitySlug,
          majorSlug,
          year: t.year,
          semester: String(t.semester),
          hasPrevious: false,
        }))
  return terms.map((t) => formatTermCode(t.year, t.semester as Semester)).sort()
}

/**
 * نیم‌سال clamp: keep the preferred code when it exists in the registry,
 * otherwise fall back to the newest available one (one always exists when any
 * term has been scraped); null when the uni/major has no terms at all.
 */
function resolveAvailableSemesterCode(
  universitySlug: string,
  majorSlug: string,
  preferred: string
): string | null {
  const codes = availableSemesterCodes(universitySlug, majorSlug)
  if (codes.length === 0) return preferred
  if (codes.includes(preferred)) return preferred
  return codes[codes.length - 1] ?? preferred
}

export const meRoutes = new Hono<AppEnv>()
  .use("*", withUser, requireUser)
  .get("/me", async (c) => {
    const user = c.get("user")!

    const [profileRows, passedRows, failedRows, notedRows] = await Promise.all([
      db
        .select()
        .from(universityProfiles)
        .where(eq(universityProfiles.userId, user.id))
        .limit(1),
      db
        .select()
        .from(passedCourses)
        .where(eq(passedCourses.userId, user.id))
        .orderBy(desc(passedCourses.createdAt)),
      db
        .select()
        .from(failedCourses)
        .where(eq(failedCourses.userId, user.id))
        .orderBy(desc(failedCourses.createdAt)),
      db
        .select()
        .from(notedCourses)
        .where(eq(notedCourses.userId, user.id))
        .orderBy(desc(notedCourses.updatedAt)),
    ])
    const profile = profileRows[0] ?? null

    // Chart / offerings / terms / changes come from the REGISTRY (JSON on disk),
    // not the database - resolved here so the mini app gets it all in ONE call.
    let terms: Array<{
      year: number
      semester: Semester
      termCode: string
      label: string
      hasPrevious?: boolean
    }> = []
    let chart: ChartDoc | null = null
    let resolvedYearDir: string | null = null
    let term: { termCode: string; label: string } | null = null
    let offerings: Offering[] = []
    let changes: {
      scrapedAt: string
      summary: { added: number; removed: number; changed: number }
      detail: unknown
    } | null = null

    const uni = profile?.universitySlug
    const major = profile?.majorSlug
    if (uni && major) {
      const fromIndex = readIndexes().offeringTerms.filter(
        (t) => t.uniSlug === uni && t.majorSlug === major
      )
      const rawTerms =
        fromIndex.length > 0 ? fromIndex : listOfferingTerms(uni, major)
      terms = rawTerms.map((t) => ({
        year: t.year,
        semester: t.semester as Semester,
        termCode: formatTermCode(t.year, t.semester as Semester),
        label: termLabelWithCode(t.year, t.semester as Semester),
        hasPrevious: "hasPrevious" in t ? Boolean(t.hasPrevious) : undefined,
      }))

      if (
        profile?.degree &&
        profile?.entryYearRange &&
        profile?.entrySemester
      ) {
        const year = entryYearStart(profile.entryYearRange)
        if (year != null) {
          const ydir = findChartYearDirForYear(uni, major, profile.degree, year)
          if (ydir) {
            chart = getChart(
              uni,
              major,
              profile.degree,
              formatYearDirectory(ydir),
              profile.entrySemester
            )
            resolvedYearDir = formatYearDirectory(ydir)
          }
        }
      }

      const code = resolveAvailableSemesterCode(
        uni,
        major,
        profile?.currentSemesterCode ?? getCurrentTermCode()
      )
      if (code) {
        const parsed = parseTermCode(code)
        if (parsed) {
          const doc = getOfferings(uni, major, parsed.year, parsed.semester)
          if (doc) {
            offerings = normalizeOfferings(doc.offerings)
            const prev = getPreviousOfferings(
              uni,
              major,
              parsed.year,
              parsed.semester
            )
            const diff = calculateOfferingChanges(doc, prev)
            // Normalize diff details too so frontend shows professor names.
            const normalizedDetail = {
              added: normalizeOfferings(diff.added),
              removed: normalizeOfferings(diff.removed),
              updated: diff.updated.map((u) => ({
                ...u,
                after: normalizeOfferings([u.after])[0]!,
              })),
            }
            changes = {
              scrapedAt: doc.scrapedAt,
              summary: diffSummary(diff),
              detail: normalizedDetail,
            }
            term = {
              termCode: code,
              label: termLabelWithCode(parsed.year, parsed.semester),
            }
          }
        }
      }
    }

    return ok(c, {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.telegramUsername,
        photoUrl: user.photoUrl,
        role: user.role,
        isContributor: user.isContributor,
        visibleInCourseLists: user.visibleInCourseLists,
        visibleInCourseListsLastUpdated:
          user.visibleInCourseListsLastUpdated?.toISOString() ?? null,
      },
      profile,
      passed: passedRows,
      failed: failedRows,
      noted: notedRows,
      term,
      terms,
      offerings,
      changes,
      chart,
      resolvedYearDir,
    })
  })

  /* ─── Noted courses (درس‌های انتخابی/دنبال‌شده) ─── */

  .get("/me/noted", async (c) => {
    const user = c.get("user")!
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()
    const entryYearRange = c.req.query("entryYearRange")?.trim()
    const entrySemester = c.req.query("entrySemester")?.trim()?.toUpperCase()
    const termCode = c.req.query("termCode")?.trim()
    const term = termCode ? parseTermCode(termCode) : null
    const filters = [eq(notedCourses.userId, user.id)]
    if (uni) filters.push(eq(notedCourses.universitySlug, uni))
    if (major) filters.push(eq(notedCourses.majorSlug, major))
    if (entryYearRange)
      filters.push(eq(notedCourses.entryYearRange, entryYearRange))
    if (entrySemester)
      filters.push(eq(notedCourses.entrySemester, entrySemester))
    if (term) {
      filters.push(eq(notedCourses.year, String(term.year)))
      filters.push(eq(notedCourses.semester, term.semester))
    }
    const rows = await db
      .select()
      .from(notedCourses)
      .where(and(...filters))
      .orderBy(desc(notedCourses.updatedAt))
    return ok(c, { noted: rows })
  })
  .post(
    "/me/noted",
    zValidator(
      "json",
      z.object({
        universitySlug: z.string().min(1),
        majorSlug: z.string().min(1),
        entryYearRange: z.string().max(16).optional(),
        entrySemester: z.string().max(8).optional(),
        courseIndex: z.string().min(1).max(64),
        year: z.string().max(8).optional(),
        semester: z.string().max(8).optional(),
      })
    ),
    async (c) => {
      const user = c.get("user")!
      const body = c.req.valid("json")

      const year = body.year ? Number.parseInt(body.year, 10) : undefined
      const semester = (body.semester?.toUpperCase() ?? undefined) as
        Semester | undefined
      if (
        !(await offeringExists(
          body.universitySlug,
          body.majorSlug,
          body.courseIndex,
          year,
          semester
        ))
      ) {
        return badRequest(c, "ارائه‌ای با این شماره در رجیستری پیدا نشد")
      }

      // Only last 2 نیم‌سال can be edited (e.g. 4052,4053 when 3 terms exist)
      if (year != null && semester) {
        const { listOfferingTerms } = await import("@workspace/registry")
        const allTerms = listOfferingTerms(body.universitySlug, body.majorSlug)
          .map((t) => ({
            year: t.year,
            semester: t.semester,
            code: `${String(t.year).slice(-3)}${t.semester === "MEHR" ? "1" : t.semester === "BAHMAN" ? "2" : "3"}`,
          }))
          .sort((a, b) => b.code.localeCompare(a.code))
        const lastTwo = new Set(
          allTerms.slice(0, 2).map((t) => `${t.year}-${t.semester}`)
        )
        if (lastTwo.size > 0 && !lastTwo.has(`${year}-${semester}`)) {
          return badRequest(c, "فقط ۲ نیم‌سال آخر قابل ویرایش هستند")
        }
      }

      const [row] = await db
        .insert(notedCourses)
        .values({
          userId: user.id,
          universitySlug: body.universitySlug,
          majorSlug: body.majorSlug,
          entryYearRange: body.entryYearRange ?? null,
          entrySemester: body.entrySemester?.toUpperCase() ?? null,
          courseIndex: body.courseIndex,
          year: body.year ?? null,
          semester: body.semester ?? null,
        })
        .onConflictDoUpdate({
          target: [
            notedCourses.userId,
            notedCourses.universitySlug,
            notedCourses.majorSlug,
            notedCourses.entryYearRange,
            notedCourses.entrySemester,
            notedCourses.year,
            notedCourses.semester,
            notedCourses.courseIndex,
          ],
          set: { isDeleted: false, updatedAt: new Date() },
        })
        .returning()

      return ok(c, { noted: row }, "درس به فهرست انتخابی اضافه شد")
    }
  )
  .delete("/me/noted/:courseIndex", async (c) => {
    const user = c.get("user")!
    const courseIndex = decodeURIComponent(c.req.param("courseIndex"))
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()
    const entryYearRange = c.req.query("entryYearRange")?.trim()
    const entrySemester = c.req.query("entrySemester")?.trim()?.toUpperCase()
    const termCode = c.req.query("termCode")?.trim()
    const term = termCode ? parseTermCode(termCode) : null
    if (term) {
      const { listOfferingTerms } = await import("@workspace/registry")
      const allTerms = listOfferingTerms(uni ?? "", major ?? "")
        .map((t) => ({
          year: t.year,
          semester: t.semester,
          code: `${String(t.year).slice(-3)}${t.semester === "MEHR" ? "1" : t.semester === "BAHMAN" ? "2" : "3"}`,
        }))
        .sort((a, b) => b.code.localeCompare(a.code))
      const lastTwo = new Set(
        allTerms.slice(0, 2).map((t) => `${t.year}-${t.semester}`)
      )
      if (lastTwo.size > 0 && !lastTwo.has(`${term.year}-${term.semester}`)) {
        return badRequest(c, "فقط ۲ نیم‌سال آخر قابل ویرایش هستند")
      }
    }
    const filters = [
      eq(notedCourses.userId, user.id),
      eq(notedCourses.courseIndex, courseIndex),
    ]
    if (uni) filters.push(eq(notedCourses.universitySlug, uni))
    if (major) filters.push(eq(notedCourses.majorSlug, major))
    if (entryYearRange)
      filters.push(eq(notedCourses.entryYearRange, entryYearRange))
    if (entrySemester)
      filters.push(eq(notedCourses.entrySemester, entrySemester))
    if (term) {
      filters.push(eq(notedCourses.year, String(term.year)))
      filters.push(eq(notedCourses.semester, term.semester))
    }
    await db.delete(notedCourses).where(and(...filters))
    return ok(c, null, "از فهرست انتخابی حذف شد")
  })

  /* ─── Passed courses (دروس گذرانده‌شده) ─── */

  .get("/me/passed", async (c) => {
    const user = c.get("user")!
    const rows = await db
      .select()
      .from(passedCourses)
      .where(eq(passedCourses.userId, user.id))
      .orderBy(desc(passedCourses.createdAt))
    return ok(c, { passed: rows })
  })
  .post(
    "/me/passed",
    zValidator(
      "json",
      z.object({
        items: z
          .array(
            z.object({
              universitySlug: z.string().min(1),
              majorSlug: z.string().min(1),
              courseName: z.string().min(1).max(255),
              year: z.string().max(8).optional(),
              semester: z.string().max(8).optional(),
            })
          )
          .max(200),
        /** Replace the whole list instead of merging (mini-app sync flow). */
        replace: z.boolean().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user")!
      const { items, replace } = c.req.valid("json")

      if (items.length === 0 && !replace) {
        return badRequest(c, "حداقل یک درس باید ارسال شود")
      }

      const result = await db.transaction(async (tx) => {
        if (replace) {
          await tx
            .delete(passedCourses)
            .where(eq(passedCourses.userId, user.id))
        }
        // Passed and failed are mutually exclusive — a passed course cannot stay failed.
        if (items.length > 0) {
          const names = items.map((i) => i.courseName)
          await tx
            .delete(failedCourses)
            .where(
              and(
                eq(failedCourses.userId, user.id),
                inArray(failedCourses.courseName, names)
              )
            )
        }
        if (items.length === 0) return []
        return tx
          .insert(passedCourses)
          .values(items.map((item) => ({ ...item, userId: user.id })))
          .onConflictDoNothing()
          .returning()
      })

      return ok(c, { inserted: result.length }, "دروس گذرانده‌شده ذخیره شد")
    }
  )
  .delete("/me/passed/:name", async (c) => {
    const user = c.get("user")!
    const name = decodeURIComponent(c.req.param("name"))
    if (!name.trim()) return badRequest(c, "نام درس نامعتبر")
    const deleted = await db
      .delete(passedCourses)
      .where(
        and(
          eq(passedCourses.userId, user.id),
          eq(passedCourses.courseName, name)
        )
      )
      .returning({ id: passedCourses.id })
    if (deleted.length === 0)
      return notFound(c, "درسی با این نام در فهرست شما نبود")
    return ok(c, null, "حذف شد")
  })

  /* ─── Failed courses (دروس مردود / نیازمند تکرار) ─── */

  .get("/me/failed", async (c) => {
    const user = c.get("user")!
    const rows = await db
      .select()
      .from(failedCourses)
      .where(eq(failedCourses.userId, user.id))
      .orderBy(desc(failedCourses.createdAt))
    return ok(c, { failed: rows })
  })
  .post(
    "/me/failed",
    zValidator(
      "json",
      z.object({
        items: z
          .array(
            z.object({
              universitySlug: z.string().min(1),
              majorSlug: z.string().min(1),
              courseName: z.string().min(1).max(255),
              year: z.string().max(8).optional(),
              semester: z.string().max(8).optional(),
            })
          )
          .max(200),
        /** Replace the whole list instead of merging (mini-app sync flow). */
        replace: z.boolean().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user")!
      const { items, replace } = c.req.valid("json")

      if (items.length === 0 && !replace) {
        return badRequest(c, "حداقل یک درس باید ارسال شود")
      }

      const result = await db.transaction(async (tx) => {
        if (replace) {
          await tx
            .delete(failedCourses)
            .where(eq(failedCourses.userId, user.id))
        }
        // Keep the two lists exclusive — a failed course should not remain passed.
        if (items.length > 0) {
          const names = items.map((i) => i.courseName)
          await tx
            .delete(passedCourses)
            .where(
              and(
                eq(passedCourses.userId, user.id),
                inArray(passedCourses.courseName, names)
              )
            )
        }
        if (items.length === 0) return []
        return tx
          .insert(failedCourses)
          .values(items.map((item) => ({ ...item, userId: user.id })))
          .onConflictDoNothing()
          .returning()
      })

      return ok(c, { inserted: result.length }, "دروس مردود ذخیره شد")
    }
  )
  .delete("/me/failed/:name", async (c) => {
    const user = c.get("user")!
    const name = decodeURIComponent(c.req.param("name"))
    if (!name.trim()) return badRequest(c, "نام درس نامعتبر")
    const deleted = await db
      .delete(failedCourses)
      .where(
        and(
          eq(failedCourses.userId, user.id),
          eq(failedCourses.courseName, name)
        )
      )
      .returning({ id: failedCourses.id })
    if (deleted.length === 0)
      return notFound(c, "درسی با این نام در فهرست مردود شما نبود")
    return ok(c, null, "حذف شد")
  })

  /* ─── University profile ─── */

  .put(
    "/me/profile",
    zValidator(
      "json",
      z.object({
        universitySlug: z
          .string()
          .min(1)
          .max(128)
          .regex(SLUG_RE, "slug نامعتبر"),
        majorSlug: z.string().min(1).max(128).regex(SLUG_RE, "slug نامعتبر"),
        degree: z.string().min(1).max(128).regex(SLUG_RE, "slug نامعتبر"),
        entryYearRange: z
          .string()
          .max(16)
          .regex(YEAR_RANGE_RE, "بازه سال نامعتبر"),
        entrySemester: z.enum(["MEHR", "BAHMAN", "SUMMER"]),
        gender: z.enum(["MALE", "FEMALE"]).optional(),
        termNumber: z.number().int().min(1).max(12).optional(),
        currentSemesterCode: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
        isLastTerm: z.boolean().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user")!
      const body = c.req.valid("json")

      // Enterprise: reject any slug that bypassed zod or contains path traversal
      if (
        !isSafeSlug(body.universitySlug) ||
        !isSafeSlug(body.majorSlug) ||
        !isSafeSlug(body.degree) ||
        !isSafeYearRange(body.entryYearRange)
      ) {
        return badRequest(c, "slug نامعتبر")
      }
      // Validate against registry index — prevents dangling slugs stored in DB
      {
        const idx = readIndexes()
        if (!idx.universities.some((u) => u.slug === body.universitySlug))
          return badRequest(c, "دانشگاه یافت نشد")
        if (
          !idx.majors.some(
            (m) =>
              m.uniSlug === body.universitySlug && m.slug === body.majorSlug
          )
        )
          return badRequest(c, "رشته یافت نشد")
      }

      const [existing] = await db
        .select()
        .from(universityProfiles)
        .where(eq(universityProfiles.userId, user.id))
        .limit(1)

      // نیم‌سال auto-fill: prefer the client/calendar value, but ALWAYS clamp
      // to the offering terms that actually exist for this uni/major - one
      // always exists. Calendar value wins when available (user may be ahead
      // of the newest scraped term).
      const preferred =
        body.currentSemesterCode ??
        existing?.currentSemesterCode ??
        getCurrentTermCode()
      const resolvedTermCode = resolveAvailableSemesterCode(
        body.universitySlug,
        body.majorSlug,
        preferred
      )

      // Detect first-time completion for JOINS notification.
      const wasComplete = Boolean(
        existing?.universitySlug &&
        existing?.majorSlug &&
        existing?.degree &&
        existing?.entryYearRange &&
        existing?.entrySemester
      )
      const willBeComplete = true // PUT always sets all required fields.

      if (!existing) {
        const [profile] = await db
          .insert(universityProfiles)
          .values({
            userId: user.id,
            universitySlug: body.universitySlug,
            majorSlug: body.majorSlug,
            degree: body.degree,
            entryYearRange: body.entryYearRange,
            entrySemester: body.entrySemester,
            gender: body.gender ?? null,
            termNumber: body.termNumber ?? null,
            currentSemesterCode: resolvedTermCode,
            isLastTerm: body.isLastTerm ?? false,
          })
          .returning()
        if (!profile) return internalServerError(c, "خطا در ذخیره پروفایل")
        // Fire-and-forget: first-time profile completion → JOINS (same group as signup).
        if (!wasComplete && willBeComplete) {
          void (async () => {
            try {
              const { sendAdminMessage, buildProfileCompleteMessage } =
                await import("@/lib/telegram/admin.ts")
              const text = buildProfileCompleteMessage(
                {
                  id: user.id as number,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  telegramUsername: user.telegramUsername,
                },
                {
                  universitySlug: profile.universitySlug,
                  majorSlug: profile.majorSlug,
                  degree: profile.degree,
                  entryYearRange: profile.entryYearRange,
                  entrySemester: profile.entrySemester,
                  gender: profile.gender,
                  termNumber: profile.termNumber,
                }
              )
              await sendAdminMessage("JOINS", text, { parseMode: "HTML" })
            } catch {}
          })()
        }
        return ok(c, { profile }, "پروفایل ذخیره شد")
      }

      const [profile] = await db
        .update(universityProfiles)
        .set({
          universitySlug: body.universitySlug,
          majorSlug: body.majorSlug,
          degree: body.degree,
          entryYearRange: body.entryYearRange,
          entrySemester: body.entrySemester,
          gender: body.gender ?? existing.gender,
          termNumber: body.termNumber ?? existing.termNumber,
          currentSemesterCode: resolvedTermCode,
          isLastTerm: body.isLastTerm ?? existing.isLastTerm,
          updatedAt: new Date(),
        })
        .where(eq(universityProfiles.userId, user.id))
        .returning()

      if (!profile) return internalServerError(c, "خطا در ذخیره پروفایل")
      if (!wasComplete && willBeComplete) {
        void (async () => {
          try {
            const { sendAdminMessage, buildProfileCompleteMessage } =
              await import("@/lib/telegram/admin.ts")
            const text = buildProfileCompleteMessage(
              {
                id: user.id as number,
                firstName: user.firstName,
                lastName: user.lastName,
                telegramUsername: user.telegramUsername,
              },
              {
                universitySlug: profile.universitySlug,
                majorSlug: profile.majorSlug,
                degree: profile.degree,
                entryYearRange: profile.entryYearRange,
                entrySemester: profile.entrySemester,
                gender: profile.gender,
                termNumber: profile.termNumber,
              }
            )
            await sendAdminMessage("JOINS", text, { parseMode: "HTML" })
          } catch {}
        })()
      }

      return ok(c, { profile }, "پروفایل ذخیره شد")
    }
  )
  .patch(
    "/me/profile",
    zValidator(
      "json",
      z.object({
        termNumber: z.number().int().min(1).max(12).optional(),
        currentSemesterCode: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
        isLastTerm: z.boolean().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user")!
      const body = c.req.valid("json")

      if (
        body.termNumber === undefined &&
        body.currentSemesterCode === undefined &&
        body.isLastTerm === undefined
      ) {
        return badRequest(c, "هیچ فیلدی برای به‌روزرسانی ارسال نشده")
      }

      const [existing] = await db
        .select()
        .from(universityProfiles)
        .where(eq(universityProfiles.userId, user.id))
        .limit(1)
      if (!existing) return notFound(c, "پروفایل یافت نشد")

      // Only allow نیم‌سال codes that actually exist in the registry.
      if (body.currentSemesterCode !== undefined) {
        const allowed = availableSemesterCodes(
          existing.universitySlug,
          existing.majorSlug
        )
        if (allowed.length > 0 && !allowed.includes(body.currentSemesterCode)) {
          return badRequest(c, "این نیم‌سال برای رشته شما وجود ندارد")
        }
      }

      const [profile] = await db
        .update(universityProfiles)
        .set({
          ...(body.termNumber !== undefined
            ? { termNumber: body.termNumber }
            : {}),
          ...(body.currentSemesterCode !== undefined
            ? { currentSemesterCode: body.currentSemesterCode }
            : {}),
          ...(body.isLastTerm !== undefined
            ? { isLastTerm: body.isLastTerm }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(universityProfiles.userId, user.id))
        .returning()

      return ok(c, { profile }, "پروفایل به‌روزرسانی شد")
    }
  )
  .post("/me/visibility/toggle", async (c) => {
    const user = c.get("user")!
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
    if (!dbUser) return notFound(c, "کاربر یافت نشد")

    /** Visibility may change once every 2 weeks (abuse-resistant). */
    const VISIBILITY_CHANGE_DAYS = 14
    const last = dbUser.visibleInCourseListsLastUpdated
    if (last) {
      const diffMs = Date.now() - new Date(last).getTime()
      const daysPassed = diffMs / (1000 * 60 * 60 * 24)
      if (daysPassed < VISIBILITY_CHANGE_DAYS) {
        const remaining = Math.ceil(VISIBILITY_CHANGE_DAYS - daysPassed)
        return badRequest(
          c,
          `شما باید ${remaining} روز دیگر صبر کنید تا بتوانید این تنظیم را تغییر دهید`
        )
      }
    }

    const newValue = !dbUser.visibleInCourseLists
    const [updated] = await db
      .update(users)
      .set({
        visibleInCourseLists: newValue,
        visibleInCourseListsLastUpdated: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning()
    if (!updated) return notFound(c, "کاربر یافت نشد")

    return ok(
      c,
      {
        visible: updated.visibleInCourseLists,
        lastUpdated: updated.visibleInCourseListsLastUpdated,
      },
      newValue ? "نمایش فعال شد" : "نمایش غیرفعال شد"
    )
  })
  .get("/me/students", async (c) => {
    const user = c.get("user")!

    // Gate: requester must have enabled visibility
    if (!user.visibleInCourseLists) {
      return forbidden(
        c,
        "برای مشاهده لیست دانشجویان ابتدا نمایش در لیست دانشجویان را در تنظیمات فعال کنید"
      )
    }

    const [profile] = await db
      .select()
      .from(universityProfiles)
      .where(eq(universityProfiles.userId, user.id))
      .limit(1)

    if (!profile?.universitySlug) {
      return badRequest(c, "ابتدا پروفایل دانشگاهی خود را کامل کنید")
    }

    // The drawer is per-offering: classmates are those who pinned THIS exact
    // offering index (شماره) in their noted list.
    const courseIndex = c.req.query("courseIndex")
    if (!courseIndex) {
      return badRequest(c, "شناسه درس ارسال نشده است")
    }

    const { page, limit, offset } = parsePagination(c)
    const friendsOnly = c.req.query("friendsOnly") === "1"

    // Same university only (major-agnostic), pinned this offering index in
    // their noted list, visible, not banned, not self
    const where = and(
      eq(universityProfiles.universitySlug, profile.universitySlug),
      eq(users.visibleInCourseLists, true),
      eq(users.banned, false),
      sql`${users.id} != ${user.id}`
    )
    const notedJoin = and(
      eq(notedCourses.userId, users.id),
      eq(notedCourses.courseIndex, courseIndex),
      eq(notedCourses.universitySlug, profile.universitySlug),
      eq(notedCourses.isDeleted, false)
    )
    const friendJoin = or(
      and(
        eq(friendships.userLowId, user.id),
        eq(friendships.userHighId, users.id)
      ),
      and(
        eq(friendships.userHighId, user.id),
        eq(friendships.userLowId, users.id)
      )
    )

    // Privacy: classmates expose only a name and avatar — nothing else.
    // isFriend flags mutual friends (no new identity: viewers know their own
    // friends; matching by name alone would be ambiguous).
    const base = db
      .selectDistinct({
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        isFriend: sql<boolean>`exists(select 1 from friendships f where (f.user_low_id = ${user.id} and f.user_high_id = ${users.id}) or (f.user_high_id = ${user.id} and f.user_low_id = ${users.id}))`,
      })
      .from(users)
      .innerJoin(universityProfiles, eq(users.id, universityProfiles.userId))
      .innerJoin(notedCourses, notedJoin)
      .where(where)
      .$dynamic()
    const rows = await (friendsOnly
      ? base.innerJoin(friendships, friendJoin)
      : base
    )
      // DISTINCT requires ordering by selected columns — alphabetical it is.
      .orderBy(users.lastName, users.firstName)
      .limit(limit + 1)
      .offset(offset)

    const hasMore = rows.length > limit
    const students = hasMore ? rows.slice(0, limit) : rows

    // Friend-classmates summary for the avatar group (same filtered set).
    const [countRow] = await db
      .select({ count: sql<number>`count(distinct ${users.id})::int` })
      .from(users)
      .innerJoin(universityProfiles, eq(users.id, universityProfiles.userId))
      .innerJoin(notedCourses, notedJoin)
      .innerJoin(friendships, friendJoin)
      .where(where)
    const sample = await db
      .selectDistinct({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        photoUrl: users.photoUrl,
        telegramUsername: users.telegramUsername,
      })
      .from(users)
      .innerJoin(universityProfiles, eq(users.id, universityProfiles.userId))
      .innerJoin(notedCourses, notedJoin)
      .innerJoin(friendships, friendJoin)
      .where(where)
      .orderBy(users.lastName, users.firstName)
      .limit(5)

    return ok(c, {
      students,
      page,
      limit,
      hasMore,
      friends: {
        count: countRow?.count ?? 0,
        sample,
      },
    })
  })

  /* ─── Archive uploads (intake side of the moderation flow) ───
     File streams to the private Telegram storage chat; only the file_id is
     persisted. Row starts PENDING - an admin reviews it and MANUALLY appends
     archives.json via a registry PR (AGENTS.md - no auto-PR bot). */

  .post("/me/uploads", async (c) => {
    const user = c.get("user")!

    const form = await c.req.parseBody()
    const file = form.file
    const title = String(form.title ?? "").trim()
    const description = String(form.description ?? "").trim()
    const universitySlug = String(form.universitySlug ?? "").trim()
    const majorSlug = String(form.majorSlug ?? "").trim() || null

    if (!(file instanceof File) || file.size === 0) {
      return badRequest(c, "فایلی ارسال نشده است")
    }
    if (title.length < 3 || title.length > 255) {
      return badRequest(c, "عنوان باید بین ۳ تا ۲۵۵ کاراکتر باشد")
    }
    if (description.length > 1000) {
      return badRequest(c, "توضیح حداکثر ۱۰۰۰ کاراکتر است")
    }

    // Slugs must exist in the current registry index.
    const indexes = readIndexes()
    const uniOk = indexes.universities.some((u) => u.slug === universitySlug)
    if (!uniOk) return badRequest(c, "دانشگاه نامعتبر است")
    if (
      majorSlug &&
      !indexes.majors.some(
        (m) => m.uniSlug === universitySlug && m.slug === majorSlug
      )
    ) {
      return badRequest(c, "رشته نامعتبر است")
    }

    // Enterprise: MIME whitelist + filename sanitization (prevents script uploads)
    const ALLOWED_MIMES = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/zip",
    ]
    if (
      file.type &&
      !ALLOWED_MIMES.includes(file.type) &&
      !file.type.startsWith("image/")
    ) {
      return badRequest(c, "نوع فایل مجاز نیست (PDF/عکس)")
    }
    const safeName = (file.name || "upload")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 128)

    const maxBytes = config.MAX_UPLOAD_MB * 1024 * 1024
    if (file.size > maxBytes) {
      return badRequest(c, `حجم فایل حداکثر ${config.MAX_UPLOAD_MB} مگابایت`)
    }

    const ingested = await ingestFile(
      file,
      safeName,
      `${title} — ${user.firstName}`
    )
    if (!ingested.ok) {
      return badRequest(
        c,
        `دریافت فایل توسط تلگرام ناموفق بود: ${ingested.error}`
      )
    }

    const [row] = await db
      .insert(uploads)
      .values({
        userId: user.id,
        kind: "ARCHIVE",
        status: "PENDING",
        telegramFileId: ingested.fileId,
        fileName: safeName || null,
        mimeType: file.type || null,
        sizeBytes: file.size,
        title,
        description: description || null,
        universitySlug,
        majorSlug,
      })
      .returning()

    // Fire-and-forget STORAGE notification — file already in TELEGRAM_UPLOADS_CHAT_ID.
    void (async () => {
      try {
        const { sendAdminMessage, buildUploadMessage } =
          await import("@/lib/telegram/admin.ts")
        const text = buildUploadMessage(
          {
            id: user.id as number,
            firstName: user.firstName,
            lastName: user.lastName,
            telegramUsername: user.telegramUsername,
          },
          {
            title,
            universitySlug,
            majorSlug,
            fileName: file.name || null,
            sizeBytes: file.size,
          }
        )
        await sendAdminMessage("STORAGE", text, { parseMode: "HTML" })
      } catch {}
    })()

    return ok(c, { upload: row }, "آپلود ثبت شد و در انتظار بررسی مدیر است")
  })
  .get("/me/uploads", async (c) => {
    const user = c.get("user")!
    const rows = await db
      .select()
      .from(uploads)
      .where(eq(uploads.userId, user.id))
      .orderBy(desc(uploads.createdAt))
      .limit(50)
    return ok(c, { uploads: rows })
  })
  .delete("/me/uploads/:id", async (c) => {
    const user = c.get("user")!
    const id = c.req.param("id")

    const [row] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, id))
      .limit(1)
    if (!row || row.userId !== user.id) return notFound(c, "آپلود پیدا نشد")
    // Only un-reviewed submissions can be withdrawn by their owner.
    if (row.status !== "PENDING") {
      return conflict(c, "این آپلود بررسی شده و قابل حذف نیست")
    }
    await db.delete(uploads).where(eq(uploads.id, id))
    return ok(c, null, "آپلود حذف شد")
  })

  /* ─── وضعیت چارت (برای بج «در دسترس نیست») ─── */
  .get("/me/chart-file/status", async (c) => {
    const user = c.get("user")!
    const [profile] = await db
      .select()
      .from(universityProfiles)
      .where(eq(universityProfiles.userId, user.id))
      .limit(1)
    if (
      !profile?.universitySlug ||
      !profile?.majorSlug ||
      !profile?.degree ||
      !profile?.entryYearRange ||
      !profile?.entrySemester
    ) {
      return ok(c, { available: false, reason: "profile_incomplete" })
    }
    const semester = (c.req.query("semester")?.toUpperCase() ??
      profile.entrySemester) as Semester
    if (semester !== "MEHR" && semester !== "BAHMAN" && semester !== "SUMMER") {
      return ok(c, { available: false, reason: "invalid_semester" })
    }
    const tryPdf = (sem: string) => {
      const abs = safeRegistryPath(
        "universities",
        profile.universitySlug!,
        "majors",
        profile.majorSlug!,
        "charts",
        profile.degree!,
        profile.entryYearRange!,
        `${sem}.pdf`
      )
      if (!abs) return false
      try {
        readFileSync(abs)
        return true
      } catch {
        return false
      }
    }
    // Direct semester PDF, then fallback to both.pdf for MEHR/BAHMAN (shared chart)
    if (tryPdf(semester.toLowerCase())) return ok(c, { available: true })
    if ((semester === "MEHR" || semester === "BAHMAN") && tryPdf("both")) {
      return ok(c, { available: true })
    }
    return ok(c, { available: false, reason: "not_found" })
  })

  /* ─── دریافت چارت (PDF) ───
     PDFs live in the registry beside the chart JSON. First request uploads
     the bytes to the user's PV and caches the file_id + content hash; later
     requests reuse the cached file_id. A new commit changes the hash ->
     cache invalidates -> fresh PDF is sent.
     If CHART_PDF_BASE_URL is set (public GitHub raw), the PDF is sent to
     Telegram as a URL (Telegram fetches it) instead of uploading bytes from
     Vercel — saves serverless bandwidth. */

  .get("/me/chart-file", async (c) => {
    const user = c.get("user")!

    const [profile] = await db
      .select()
      .from(universityProfiles)
      .where(eq(universityProfiles.userId, user.id))
      .limit(1)
    if (
      !profile?.universitySlug ||
      !profile?.majorSlug ||
      !profile?.degree ||
      !profile?.entryYearRange ||
      !profile?.entrySemester
    ) {
      return conflict(c, "ابتدا پروفایل دانشگاهی خود را کامل کنید")
    }

    const semester = (c.req.query("semester")?.toUpperCase() ??
      profile.entrySemester) as Semester
    if (semester !== "MEHR" && semester !== "BAHMAN" && semester !== "SUMMER") {
      return badRequest(c, "semester نامعتبر است")
    }

    const yearDir = profile.entryYearRange
    const uni = profile.universitySlug
    const major = profile.majorSlug
    const degree = profile.degree

    // Enterprise: validate slugs again before disk read (defense in depth)
    if (
      !isSafeSlug(uni) ||
      !isSafeSlug(major) ||
      !isSafeSlug(degree) ||
      !isSafeYearRange(yearDir)
    ) {
      return badRequest(c, "slug نامعتبر")
    }
    let pdfRel = [
      "universities",
      uni,
      "majors",
      major,
      "charts",
      degree,
      yearDir,
      `${semester.toLowerCase()}.pdf`,
    ].join("/")
    let pdfAbs = safeRegistryPath(
      "universities",
      uni,
      "majors",
      major,
      "charts",
      degree,
      yearDir,
      `${semester.toLowerCase()}.pdf`
    )
    if (!pdfAbs) return badRequest(c, "مسیر نامعتبر")

    // Check existence first (404 if not in registry) — fallback to both.pdf for MEHR/BAHMAN
    let bytes: Buffer | null = null
    try {
      bytes = readFileSync(pdfAbs)
    } catch {
      if (semester === "MEHR" || semester === "BAHMAN") {
        const bothRel = [
          "universities",
          uni,
          "majors",
          major,
          "charts",
          degree,
          yearDir,
          "both.pdf",
        ].join("/")
        const bothAbs = safeRegistryPath(
          "universities",
          uni,
          "majors",
          major,
          "charts",
          degree,
          yearDir,
          "both.pdf"
        )
        if (!bothAbs) return badRequest(c, "مسیر نامعتبر")
        try {
          bytes = readFileSync(bothAbs)
          pdfRel = bothRel
          pdfAbs = bothAbs
        } catch {
          return notFound(c, "فایل PDF این چارت هنوز بارگذاری نشده است")
        }
      } else {
        return notFound(c, "فایل PDF این چارت هنوز بارگذاری نشده است")
      }
    }

    // Public-repo shortcut: send CDN URL, let Telegram fetch it — encode brackets for Telegram fetch
    // Caption: Persian detailed like "چارت دانشگاه آزاد مهندسی کامپیوتر ورودی 402 مهر"
    const buildCaption = () => {
      try {
        const idx = readIndexes()
        const uniName = idx.universities.find((u) => u.slug === uni)?.name.fa ?? uni
        const majorName = idx.majors.find((m) => m.uniSlug === uni && m.slug === major)?.name.fa ?? major
        const semFa = semester === "MEHR" ? "مهر" : semester === "BAHMAN" ? "بهمن" : semester === "SUMMER" ? "تابستان" : semester
        const yearFa = yearDir.replace(/[\[\]]/g, "")
        return `📄 چارت ${uniName} ${majorName} ورودی ${yearFa} ${semFa}`
      } catch {
        return `📄 چارت ${yearDir} - ترم ${semester}`
      }
    }
    const reqId = Math.random().toString(36).slice(2, 6)
    if (config.CHART_PDF_BASE_URL) {
      const base = config.CHART_PDF_BASE_URL.replace(/\/$/, "")
      const pdfUrl = `${base}/${encodeURI(pdfRel)}`
      console.log(`[chart:${reqId}] DEBUG trying CDN`, { pdfRel, pdfUrl, base, yearDir, semester, uni, major, degree, bytesLen: bytes.length, registryRoot: registryRoot(), userId: user.id })
      const { sendRichMessage } = await import("@/lib/telegram/bot.ts")
      const sent = await sendRichMessage(user.id, {
        documentUrl: pdfUrl,
        text: buildCaption(),
      })
      console.log(`[chart:${reqId}] DEBUG sendRichMessage result`, JSON.stringify(sent).slice(0, 800))
      if (sent.ok) return ok(c, { sent: true, via: "url" })
      // Fallback to bytes upload if CDN fetch fails (e.g. Telegram 404)
      console.warn(`[chart:${reqId}] CDN send failed, falling back to bytes:`, sent.error, "pdfUrl:", pdfUrl)
    } else {
      console.log(`[chart:${reqId}] DEBUG no CHART_PDF_BASE_URL, using bytes fallback`)
    }

    console.log("[chart] DEBUG bytes fallback start", { bytesLen: bytes.length, pdfRel, yearDir, semester })
    const contentHash = createHash("sha256").update(bytes).digest("hex")
    console.log("[chart] DEBUG contentHash", contentHash.slice(0, 12))

    const [cached] = await db
      .select()
      .from(chartFiles)
      .where(
        and(
          eq(chartFiles.universitySlug, uni),
          eq(chartFiles.majorSlug, major),
          eq(chartFiles.degree, degree),
          eq(chartFiles.yearDir, yearDir),
          eq(chartFiles.semester, semester.toLowerCase())
        )
      )
      .limit(1)

    let fileId: string
    let isCacheHit = false
    // Enterprise: DRY fileIds (DRY*, DRYPDF*) are fake and not sendable — treat as miss
    const isDryId = cached?.telegramFileId?.startsWith("DRY") ?? false
    console.log("[chart] DEBUG cache", { hasCached: !!cached, contentHash: contentHash.slice(0, 8), cachedHash: cached?.contentHash?.slice(0, 8), isDryId, cachedFileId: cached?.telegramFileId?.slice(0, 20) })
    if (cached && cached.contentHash === contentHash && !isDryId) {
      fileId = cached.telegramFileId
      isCacheHit = true
      console.log("[chart] DEBUG using cached fileId", fileId.slice(0, 20))
    } else {
      // Cache miss or stale - upload fresh bytes through the bot.
      const ingested = await ingestPdfBytes(bytes, pdfRel)
      if (!ingested.ok) {
        return badRequest(
          c,
          `ارسال فایل به تلگرام ناموفق بود: ${ingested.error}`
        )
      }
      fileId = ingested.fileId
      await db
        .insert(chartFiles)
        .values({
          universitySlug: uni,
          majorSlug: major,
          degree,
          yearDir,
          semester: semester.toLowerCase(),
          telegramFileId: fileId,
          contentHash,
        })
        .onConflictDoUpdate({
          target: [
            chartFiles.universitySlug,
            chartFiles.majorSlug,
            chartFiles.degree,
            chartFiles.yearDir,
            chartFiles.semester,
          ],
          set: { telegramFileId: fileId, contentHash, updatedAt: new Date() },
        })
    }

    console.log("[chart] DEBUG trying sendStoredFile", { fileId: fileId.slice(0, 20), isCacheHit, caption: buildCaption().slice(0, 40) })
    let sent = await sendStoredFile(user.id, fileId, buildCaption())
    console.log("[chart] DEBUG sendStoredFile result", JSON.stringify(sent).slice(0, 500))
    // Enterprise: if cached fileId is invalid (bot token rotated, wrong bot), auto-recover
    if (!sent.ok && isCacheHit && sent.error.includes("wrong remote file identifier")) {
      console.warn("[chart] cached fileId invalid, re-uploading:", fileId.slice(0, 20))
      if (cached?.id) await db.delete(chartFiles).where(eq(chartFiles.id, cached.id))
      const ingested = await ingestPdfBytes(bytes, pdfRel)
      if (!ingested.ok) {
        return badRequest(c, `ارسال به تلگرام ناموفق بود: ${ingested.error}`)
      }
      fileId = ingested.fileId
      await db
        .insert(chartFiles)
        .values({
          universitySlug: uni,
          majorSlug: major,
          degree,
          yearDir,
          semester: semester.toLowerCase(),
          telegramFileId: fileId,
          contentHash,
        })
        .onConflictDoUpdate({
          target: [
            chartFiles.universitySlug,
            chartFiles.majorSlug,
            chartFiles.degree,
            chartFiles.yearDir,
            chartFiles.semester,
          ],
          set: { telegramFileId: fileId, contentHash, updatedAt: new Date() },
        })
      sent = await sendStoredFile(user.id, fileId, buildCaption())
    }
    if (!sent.ok) {
      return badRequest(c, `ارسال به تلگرام ناموفق بود: ${sent.error}`)
    }

    await db
      .update(chartFiles)
      .set({ sentCount: sql`${chartFiles.sentCount} + 1` })
      .where(eq(chartFiles.id, cached?.id ?? ""))

    return ok(c, {
      sent: true,
      cached: Boolean(cached && cached.contentHash === contentHash),
    })
  })

  /* ─── خروجی عکس (برنامه هفتگی / امتحانی) ───
     One-time Supabase S3 flow: presign a PUT for the client, then on send
     hand Telegram a short-lived presigned GET and delete the object. */

  .post(
    "/me/export-image/presign",
    zValidator(
      "json",
      z.object({
        kind: z.enum(["weekly", "exam"]),
      })
    ),
    async (c) => {
      const user = c.get("user")!
      if (!isExportStorageConfigured()) {
        return badRequest(c, "ذخیره‌سازی تصاویر پیکربندی نشده است")
      }
      const { kind } = c.req.valid("json")
      const key = `exports/${user.id}/${kind}-${Date.now()}.png`
      const { uploadUrl } = await presignExportPut(key)
      return ok(c, { uploadUrl, key })
    }
  )
  .post(
    "/me/export-image/send",
    zValidator(
      "json",
      z.object({
        key: z.string().min(1).max(256),
      })
    ),
    async (c) => {
      const user = c.get("user")!
      const { key } = c.req.valid("json")
      // Keys are namespaced per user - nobody can send someone else's object.
      if (!key.startsWith(`exports/${user.id}/`) || !key.endsWith(".png")) {
        return badRequest(c, "کلید نامعتبر است")
      }
      if (!isExportStorageConfigured()) {
        return badRequest(c, "ذخیره‌سازی تصاویر پیکربندی نشده است")
      }
      const objectUrl = publicExportUrl(key)
      const { sendRichMessage, sendWithFile } =
        await import("@/lib/telegram/bot.ts")
      let sent = await sendRichMessage(user.id, {
        photoUrl: objectUrl,
        text: "🗓 خروجی عکس شما آماده است",
      })
      // Fallback: download bytes from S3 and upload directly
      if (!sent.ok) {
        try {
          const bytes = await getExportBytes(key)
          sent = await sendWithFile(
            user.id,
            new Blob([bytes], { type: "image/png" }),
            "export.png",
            "🗓 خروجی عکس شما آماده است",
            { mediaType: "photo" }
          )
        } catch {}
      }
      if (sent.ok) {
        void deleteExportObject(key)
      }
      if (!sent.ok) {
        return badRequest(c, `ارسال به تلگرام ناموفق بود: ${sent.error}`)
      }
      return ok(c, { sent: true })
    }
  )

  /* ─── Online heartbeat ─── */
  .post("/me/online", async (c) => {
    const user = c.get("user")!
    await db
      .update(users)
      .set({ lastOnlineAt: new Date() })
      .where(eq(users.id, user.id))
    return ok(c, null)
  })
