import type { Semester } from "@workspace/registry"
import { Hono } from "hono"

import { badRequest, notFound, ok } from "@/lib/http/common"
import { calculateOfferingChanges, diffSummary } from "@/lib/notifications/diff"
import {
  findChartYearDirForYear,
  getArchives,
  getChart,
  getChartByPath,
  getGroups,
  getOfferings,
  getPreviousOfferings,
  getProfessors,
  listOfferingTerms,
  readIndexes,
} from "@/lib/registry"
import { formatTermCode, parseTermCode, termLabelWithCode } from "@/lib/terms"
import type { AppEnv } from "@/middleware/auth"
import { requireUser, withUser } from "@/middleware/auth"

/**
 * Mini-app registry browsing. NOT public - every request is authenticated
 * via `tma <initData>` (stateless). The old /public/* surface was removed:
 * the product is the mini app + admin dashboard only.
 */

const CACHE_INDEX = "private, max-age=60"
const CACHE_DOC = "private, max-age=30"

/** Persian-homoglyph-insensitive matching for search (ی/ي، ک/ك). */
function normalizeFa(value: string): string {
  return value
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u064A/g, "\u06CC")
    .toLowerCase()
    .trim()
}

/** Normalize professor from raw registry (string) to API shape ({ fa }) */
function normalizeOfferings(
  offerings: import("@workspace/registry").Offering[]
): import("@workspace/registry").Offering[] {
  return offerings.map((o) => {
    const p = (o as unknown as { professor: unknown }).professor
    if (typeof p === "string") {
      const trimmed = p.trim()
      return { ...o, professor: trimmed ? ({ fa: trimmed } as any) : null }
    }
    return o
  })
}

/** Resolves ?termCode=4051 OR ?year=&semester= into a term. */
function resolveTerm(
  c: import("hono").Context
): { year: number; semester: Semester } | null | "invalid" {
  const termCode = c.req.query("termCode")?.trim()
  if (termCode) return parseTermCode(termCode)

  const year = Number.parseInt(c.req.query("year") ?? "", 10)
  const raw = c.req.query("semester")?.toUpperCase() ?? ""
  const semester =
    raw === "MEHR" || raw === "BAHMAN" || raw === "SUMMER"
      ? (raw as Semester)
      : null
  if (!Number.isFinite(year) || !semester) return "invalid"
  return { year, semester }
}

export const appRegistryRoutes = new Hono<AppEnv>()
  .use("*", withUser, requireUser)
  .get("/universities", (c) => {
    const { universities } = readIndexes()
    c.header("cache-control", CACHE_INDEX)
    return ok(c, { universities })
  })
  .get("/universities/:slug", (c) => {
    const slug = c.req.param("slug")
    const university = readIndexes().universities.find((u) => u.slug === slug)
    if (!university) return notFound(c, "دانشگاه پیدا نشد")
    c.header("cache-control", CACHE_INDEX)
    return ok(c, { university })
  })
  .get("/majors", (c) => {
    const uni = c.req.query("uni")?.trim()
    let { majors } = readIndexes()
    if (uni) majors = majors.filter((m) => m.uniSlug === uni)
    c.header("cache-control", CACHE_INDEX)
    return ok(c, { majors })
  })
  .get("/charts", (c) => {
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()
    let { charts } = readIndexes()
    if (uni) charts = charts.filter((x) => x.uniSlug === uni)
    if (major) charts = charts.filter((x) => x.majorSlug === major)
    c.header("cache-control", CACHE_INDEX)
    return ok(c, { charts })
  })
  .get("/chart", async (c) => {
    const path = c.req.query("path")?.trim() ?? ""
    const chart = getChartByPath(path)
    if (!chart) return notFound(c, "چارت پیدا نشد یا مسیر مجاز نیست")
    c.header("cache-control", CACHE_DOC)
    return ok(c, { chart })
  })
  .get("/charts/resolve", (c) => {
    // "My chart": resolve the entry-cohort directory for a year then load the
    // chart - mehr/bahman fall back to the shared both.json automatically.
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()
    const degree = c.req.query("degree")?.trim()
    const year = Number.parseInt(c.req.query("year") ?? "", 10)
    const semester = c.req.query("semester")?.toUpperCase() ?? ""
    if (!uni || !major || !degree || !Number.isFinite(year)) {
      return badRequest(c, "uni، major، degree و year الزامی است")
    }
    if (semester !== "MEHR" && semester !== "BAHMAN" && semester !== "SUMMER") {
      return badRequest(c, "semester باید MEHR/BAHMAN/SUMMER باشد")
    }

    const yearDir = findChartYearDirForYear(uni, major, degree, year)
    if (!yearDir) return notFound(c, "چارتی برای این سال ورود یافت نشد")

    const chart = getChart(uni, major, degree, yearDir, semester as Semester)
    if (!chart) return notFound(c, "فایل چارت این ترم ورود یافت نشد")

    c.header("cache-control", CACHE_DOC)
    return ok(c, { chart, resolvedYearDir: yearDir })
  })

  /* ─── Offerings: pick by «1405 مهر (4051)» style term codes ─── */

  .get("/offerings/terms", (c) => {
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()
    if (!uni || !major) return badRequest(c, "uni و major الزامی است")

    // Prefer the index; fall back to a direct walk when CI has not built yet.
    const fromIndex = readIndexes().offeringTerms.filter(
      (t) => t.uniSlug === uni && t.majorSlug === major
    )
    const terms =
      fromIndex.length > 0
        ? fromIndex.map((t) => ({
            year: t.year,
            semester: t.semester,
            hasPrevious: t.hasPrevious,
          }))
        : listOfferingTerms(uni, major)

    c.header("cache-control", CACHE_INDEX)
    return ok(c, {
      terms: terms.map((t) => ({
        ...t,
        termCode: formatTermCode(t.year, t.semester),
        label: termLabelWithCode(t.year, t.semester),
      })),
    })
  })
  .get("/offerings", (c) => {
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()

    const term = resolveTerm(c)
    if (term === "invalid" || !term || !uni || !major) {
      return badRequest(c, "termCode یا year+semester الزامی است")
    }

    const doc = getOfferings(uni, major, term.year, term.semester)
    if (!doc) return notFound(c, "اسنپ‌شاتی برای این ترم وجود ندارد")

    c.header("cache-control", CACHE_DOC)

    // Pre-computed diff against the rotated previous snapshot, so clients can
    // show «چه چیزی عوض شد» without fetching two snapshots client-side.
    if (c.req.query("include") === "diff") {
      const previous = getPreviousOfferings(
        uni,
        major,
        term.year,
        term.semester
      )
      const diff = calculateOfferingChanges(doc, previous)
      const normalizedDetail = {
        added: normalizeOfferings(diff.added),
        removed: normalizeOfferings(diff.removed),
        updated: diff.updated.map((u) => ({
          ...u,
          after: normalizeOfferings([u.after])[0]!,
        })),
      }
      return ok(c, {
        term: {
          ...term,
          termCode: formatTermCode(term.year, term.semester),
          label: termLabelWithCode(term.year, term.semester),
        },
        offerings: normalizeOfferings(doc.offerings),
        scrapedAt: doc.scrapedAt,
        changes: { summary: diffSummary(diff), detail: normalizedDetail },
      })
    }
    return ok(c, {
      offerings: normalizeOfferings(doc.offerings),
      scrapedAt: doc.scrapedAt,
    })
  })
  .get("/search", (c) => {
    const q = normalizeFa(c.req.query("q") ?? "")
    const limit = Math.min(
      Number.parseInt(c.req.query("limit") ?? "20", 10) || 20,
      50
    )
    if (q.length < 2)
      return ok(c, { courses: [], majors: [], universities: [] })

    const indexes = readIndexes()

    const universities = indexes.universities
      .filter(
        (u) =>
          normalizeFa(u.name.fa).includes(q) ||
          u.slug.includes(q) ||
          (u.name.en ?? "").toLowerCase().includes(q)
      )
      .slice(0, limit)

    const majors = indexes.majors
      .filter(
        (m) =>
          normalizeFa(m.name.fa).includes(q) ||
          m.slug.includes(q) ||
          (m.name.en ?? "").toLowerCase().includes(q)
      )
      .slice(0, limit)

    const courses = indexes.courses
      .filter(
        (course) =>
          normalizeFa(course.name).includes(q) ||
          (course.code && course.code.includes(q))
      )
      .slice(0, limit)

    c.header("cache-control", CACHE_INDEX)
    return ok(c, { universities, majors, courses })
  })

  /* ─── Registry optional docs ─── */

  .get("/professors", async (c) => {
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()
    if (!uni || !major) return badRequest(c, "uni و major الزامی است")
    c.header("cache-control", CACHE_DOC)
    return ok(c, { professors: await getProfessors(uni, major) })
  })
  .get("/archives", async (c) => {
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()
    if (!uni || !major) return badRequest(c, "uni و major الزامی است")
    c.header("cache-control", CACHE_DOC)
    return ok(c, { archives: await getArchives(uni, major) })
  })
  .get("/groups", async (c) => {
    const uni = c.req.query("uni")?.trim()
    const major = c.req.query("major")?.trim()
    if (!uni || !major) return badRequest(c, "uni و major الزامی است")
    c.header("cache-control", CACHE_DOC)
    return ok(c, { groups: await getGroups(uni, major) })
  })

  /* ── Professor vote aggregate (moved here when /public died) ── */
  .get("/professors/:uni/:major/:slug/votes", async (c) => {
    const { db } = await import("@/lib/db.ts")
    const { professorVotes, users } = await import("@workspace/db/schema")
    const { and, avg, count, desc, eq, sql } = await import("drizzle-orm")

    const uni = c.req.param("uni")
    const major = c.req.param("major")
    const slug = c.req.param("slug")

    // Validate against the registry so ghost professors can't accrue votes.
    const known = await getProfessors(uni, major)
    if (!known.some((p) => p.slug === slug)) {
      return notFound(c, "استادی با این شناسه در رجیستری نیست")
    }

    const [aggregate] = await db
      .select({
        total: count(),
        examDifficulty: avg(professorVotes.examDifficulty),
        teachingQuality: avg(professorVotes.teachingQuality),
        mastery: avg(professorVotes.mastery),
        leniency: avg(professorVotes.leniency),
        questionSimilarity: avg(professorVotes.questionSimilarity),
        providesSampleQuestions: avg(
          sql`CASE WHEN ${professorVotes.providesSampleQuestions} THEN 1 ELSE 0 END`
        ),
        providesNotes: avg(
          sql`CASE WHEN ${professorVotes.providesNotes} THEN 1 ELSE 0 END`
        ),
        mandatoryAttendance: avg(
          sql`CASE WHEN ${professorVotes.mandatoryAttendance} THEN 1 ELSE 0 END`
        ),
      })
      .from(professorVotes)
      .where(
        and(
          eq(professorVotes.universitySlug, uni),
          eq(professorVotes.majorSlug, major),
          eq(professorVotes.professorSlug, slug)
        )
      )

    const recent = await db
      .select({
        comment: professorVotes.comment,
        createdAt: professorVotes.createdAt,
        firstName: users.firstName,
      })
      .from(professorVotes)
      .innerJoin(users, eq(users.id, professorVotes.userId))
      .where(
        and(
          eq(professorVotes.universitySlug, uni),
          eq(professorVotes.majorSlug, major),
          eq(professorVotes.professorSlug, slug)
        )
      )
      .orderBy(desc(professorVotes.createdAt))
      .limit(20)

    const round1 = (v: string | null) =>
      v ? Math.round(Number(v) * 10) / 10 : null

    return ok(c, {
      total: aggregate?.total ?? 0,
      averages: {
        examDifficulty: round1(aggregate?.examDifficulty ?? null),
        teachingQuality: round1(aggregate?.teachingQuality ?? null),
        mastery: round1(aggregate?.mastery ?? null),
        leniency: round1(aggregate?.leniency ?? null),
        questionSimilarity: round1(aggregate?.questionSimilarity ?? null),
        providesSampleQuestions: aggregate?.providesSampleQuestions
          ? Number(aggregate.providesSampleQuestions)
          : null,
        providesNotes: aggregate?.providesNotes
          ? Number(aggregate.providesNotes)
          : null,
        mandatoryAttendance: aggregate?.mandatoryAttendance
          ? Number(aggregate.mandatoryAttendance)
          : null,
      },
      comments: recent.map((r) => ({
        firstName: r.firstName,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
    })
  })
