import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

import type {
  ArchiveItem,
  ChartCourse,
  ChartDoc,
  ChartSemester,
  Degree,
  MajorDoc,
  OfferingDiffDoc,
  OfferingDoc,
  Professor,
  Semester,
  TelegramGroup,
  UniversityDoc,
} from "./schema/index"
import {
  archivesDocSchema,
  chartDegreeMetaSchema,
  chartDocSchema,
  groupsDocSchema,
  majorDocSchema,
  offeringDiffDocSchema,
  offeringDocSchema,
  professorsDocSchema,
  universityDocSchema,
} from "./schema/index"
import {
  archivesDocPath,
  chartDegreeMetaPath,
  chartPath,
  chartsDir,
  coursesDir,
  groupsDocPath,
  majorDocPath,
  majorDocPathLegacy,
  offeringDiffPath,
  offeringOldPath,
  offeringPath,
  parseChartFileName,
  parseSemesterFileName,
  professorsDocPath,
  registryRoot,
  universityDocPath,
  universityDocPathLegacy,
} from "./paths"
import {
  formatYearDirectory,
  parseYearDirectory,
  sortYearDirectories,
  yearDirectoryCovers,
  type YearDirectory,
} from "./year-dir"

export class RegistryNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`Registry document not found: ${path}`)
    this.name = "RegistryNotFoundError"
  }
}

export class RegistryParseError extends Error {
  constructor(
    readonly path: string,
    readonly cause: unknown
  ) {
    super(`Invalid registry document: ${path}`)
    this.name = "RegistryParseError"
  }
}

function readJson<T>(
  absolutePath: string,
  schema: { parse: (data: unknown) => T }
): T {
  let raw: string
  try {
    raw = readFileSync(absolutePath, "utf-8")
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
    ) {
      throw new RegistryNotFoundError(absolutePath)
    }
    throw error
  }

  try {
    return schema.parse(JSON.parse(raw))
  } catch (error) {
    throw new RegistryParseError(absolutePath, error)
  }
}

function resolve(relativePath: string): string {
  return join(registryRoot(), relativePath)
}

function listDirs(absolutePath: string): string[] {
  try {
    return readdirSync(absolutePath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

// ── Universities ────────────────────────────────────────────────────────────

export function listUniversitySlugs(): string[] {
  return listDirs(resolve("universities"))
}

export function getUniversity(slug: string): UniversityDoc | null {
  // Try new meta.json first, fallback to legacy university.json
  for (const p of [universityDocPath(slug), universityDocPathLegacy(slug)]) {
    try {
      return readJson(resolve(p), universityDocSchema)
    } catch (error) {
      if (error instanceof RegistryNotFoundError) continue
      throw error
    }
  }
  return null
}

// ── Majors ──────────────────────────────────────────────────────────────────

export function listMajorSlugs(universitySlug: string): string[] {
  return listDirs(join(universitiesRoot(), universitySlug, "majors"))
}

function universitiesRoot(): string {
  return resolve("universities")
}

export function getMajor(
  universitySlug: string,
  majorSlug: string
): MajorDoc | null {
  for (const p of [
    majorDocPath(universitySlug, majorSlug),
    majorDocPathLegacy(universitySlug, majorSlug),
  ]) {
    try {
      return readJson(resolve(p), majorDocSchema)
    } catch (error) {
      if (error instanceof RegistryNotFoundError) continue
      throw error
    }
  }
  return null
}

export function getChartDegreeMeta(
  universitySlug: string,
  majorSlug: string,
  degreeSlug: string
): import("./schema/chart").ChartDegreeMeta | null {
  try {
    return readJson(
      resolve(chartDegreeMetaPath(universitySlug, majorSlug, degreeSlug)),
      chartDegreeMetaSchema
    )
  } catch (error) {
    if (error instanceof RegistryNotFoundError) return null
    throw error
  }
}

export function getDegree(
  universitySlug: string,
  majorSlug: string,
  degreeSlug: string
): Degree | null {
  const fromMajor = getMajor(universitySlug, majorSlug)?.degrees?.find(
    (d) => d.slug === degreeSlug
  )
  if (fromMajor) return fromMajor
  // Fallback to per-degree meta.json when degrees array has been removed (duplicate)
  const meta = getChartDegreeMeta(universitySlug, majorSlug, degreeSlug)
  if (meta)
    return { slug: meta.slug, name: meta.name, termCount: meta.termCount }
  return null
}

// ── Charts ──────────────────────────────────────────────────────────────────

/** All entry-cohort directories available for a degree's charts, newest first. */
export function listChartYearDirs(
  universitySlug: string,
  majorSlug: string,
  degreeSlug: string
): YearDirectory[] {
  const degreeCharts = resolve(
    join(chartsDir(universitySlug, majorSlug), degreeSlug)
  )

  const dirs: YearDirectory[] = []
  for (const name of listDirs(degreeCharts)) {
    const parsed = parseYearDirectory(name)
    if (parsed) dirs.push(parsed)
  }
  return sortYearDirectories(dirs)
}

/**
 * Find the chart directory covering a given entry year - prefers the most
 * specific match (a single-year directory over a range).
 */
export function findChartYearDirForYear(
  universitySlug: string,
  majorSlug: string,
  degreeSlug: string,
  year: number
): YearDirectory | null {
  const covering = listChartYearDirs(
    universitySlug,
    majorSlug,
    degreeSlug
  ).filter((d) => yearDirectoryCovers(d, year))

  return (
    covering.sort((a, b) =>
      a.kind === b.kind ? 0 : a.kind === "single" ? -1 : 1
    )[0] ?? null
  )
}

function readChartDoc(
  universitySlug: string,
  majorSlug: string,
  degreeSlug: string,
  dirName: string,
  semester: ChartSemester
): ChartDoc | null {
  try {
    return readJson(
      resolve(
        chartPath(universitySlug, majorSlug, degreeSlug, dirName, semester)
      ),
      chartDocSchema
    )
  } catch (error) {
    if (error instanceof RegistryNotFoundError) return null
    throw error
  }
}

/** Chart files physically present in one year directory (mehr/bahman/
    summer/both). Used by the index builder instead of probing semesters. */
export function listChartFiles(
  universitySlug: string,
  majorSlug: string,
  degreeSlug: string,
  yearDir: string | YearDirectory
): Array<{ semester: ChartSemester; fileName: string }> {
  const name =
    typeof yearDir === "string" ? yearDir : formatYearDirectory(yearDir)
  if (!parseYearDirectory(name)) return []

  try {
    return readdirSync(
      resolve(join(chartsDir(universitySlug, majorSlug), degreeSlug, name)),
      { withFileTypes: true }
    )
      .filter((e) => e.isFile())
      .map((e) => ({
        semester: parseChartFileName(e.name),
        fileName: e.name,
      }))
      .filter(
        (entry): entry is { semester: ChartSemester; fileName: string } =>
          entry.semester !== null
      )
      .sort((a, b) => a.fileName.localeCompare(b.fileName))
  } catch {
    return []
  }
}

/** Reads the chart for an entry semester. Falls back to the shared
    both.json when the exact semester file is absent and BOTH covers it. */
export function getChart(
  universitySlug: string,
  majorSlug: string,
  degreeSlug: string,
  yearDir: string | YearDirectory,
  semester: Semester
): ChartDoc | null {
  const name =
    typeof yearDir === "string" ? yearDir : formatYearDirectory(yearDir)
  if (!parseYearDirectory(name)) return null

  if (semester === "SUMMER") return null
  const direct = readChartDoc(
    universitySlug,
    majorSlug,
    degreeSlug,
    name,
    semester as import("./schema/chart").ChartSemester
  )
  if (direct) return direct

  if (semester === "MEHR" || semester === "BAHMAN") {
    return readChartDoc(universitySlug, majorSlug, degreeSlug, name, "BOTH")
  }
  return null
}

/** Flat list of every course line in a chart (all terms + moaref). */
export function getChartCourses(chart: ChartDoc): ChartCourse[] {
  return [...Object.values(chart.terms).flat(), ...chart.moaref]
}

// ── Semester offerings ──────────────────────────────────────────────────────

export type OfferingTermRef = { year: number; semester: Semester }

const SEMESTER_ORDER: Record<Semester, number> = {
  MEHR: 0,
  BAHMAN: 1,
  SUMMER: 2,
}

/** All offering terms for a major, newest first. A term exists when its
    courses/<year>/<semester>/ folder holds a new.json snapshot. */
export function listOfferingTerms(
  universitySlug: string,
  majorSlug: string
): OfferingTermRef[] {
  const coursesRoot = resolve(coursesDir(universitySlug, majorSlug))
  const terms: OfferingTermRef[] = []

  try {
    for (const yearEntry of readdirSync(coursesRoot, { withFileTypes: true })) {
      if (!yearEntry.isDirectory()) continue
      if (!/^\d{4}$/.test(yearEntry.name)) continue
      const year = Number(yearEntry.name)

      for (const termEntry of readdirSync(join(coursesRoot, yearEntry.name), {
        withFileTypes: true,
      })) {
        if (!termEntry.isDirectory()) continue
        const semester = parseSemesterFileName(`${termEntry.name}.json`)
        if (!semester) continue
        if (
          !existsSync(
            join(coursesRoot, yearEntry.name, termEntry.name, "new.json")
          )
        ) {
          continue
        }
        terms.push({ year, semester })
      }
    }
  } catch {
    return []
  }

  return terms.sort((a, b) =>
    b.year !== a.year
      ? b.year - a.year
      : SEMESTER_ORDER[a.semester] - SEMESTER_ORDER[b.semester]
  )
}

export function getOfferings(
  universitySlug: string,
  majorSlug: string,
  year: number,
  semester: Semester
): OfferingDoc | null {
  try {
    return readJson(
      resolve(offeringPath(universitySlug, majorSlug, year, semester)),
      offeringDocSchema
    )
  } catch (error) {
    if (error instanceof RegistryNotFoundError) return null
    throw error
  }
}

/** The previous (CI-rotated) snapshot of a term; null when the term has only
    ever had one snapshot or old.json was never generated. */
export function getPreviousOfferings(
  universitySlug: string,
  majorSlug: string,
  year: number,
  semester: Semester
): OfferingDoc | null {
  try {
    return readJson(
      resolve(offeringOldPath(universitySlug, majorSlug, year, semester)),
      offeringDocSchema
    )
  } catch (error) {
    if (error instanceof RegistryNotFoundError) return null
    throw error
  }
}

/** Diff of a term (added/removed/updated) - null when no diff.json yet. */
export function getOfferingDiff(
  universitySlug: string,
  majorSlug: string,
  year: number,
  semester: Semester
): OfferingDiffDoc | null {
  try {
    return readJson(
      resolve(offeringDiffPath(universitySlug, majorSlug, year, semester)),
      offeringDiffDocSchema
    )
  } catch (error) {
    if (error instanceof RegistryNotFoundError) return null
    throw error
  }
}

/** Newest offering snapshot of a major (the one shown by default). */
export function getLatestOfferings(
  universitySlug: string,
  majorSlug: string
): { term: OfferingTermRef; doc: OfferingDoc } | null {
  const [term] = listOfferingTerms(universitySlug, majorSlug)
  if (!term) return null

  const doc = getOfferings(universitySlug, majorSlug, term.year, term.semester)
  return doc ? { term, doc } : null
}

// ── Professors / Archives / Groups ──────────────────────────────────────────

export function getProfessors(
  universitySlug: string,
  majorSlug: string
): Professor[] {
  try {
    return readJson(
      resolve(professorsDocPath(universitySlug, majorSlug)),
      professorsDocSchema
    ).professors
  } catch (error) {
    if (error instanceof RegistryNotFoundError) return []
    throw error
  }
}

export function getArchives(
  universitySlug: string,
  majorSlug: string
): ArchiveItem[] {
  try {
    return readJson(
      resolve(archivesDocPath(universitySlug, majorSlug)),
      archivesDocSchema
    ).items
  } catch (error) {
    if (error instanceof RegistryNotFoundError) return []
    throw error
  }
}

export function getGroups(
  universitySlug: string,
  majorSlug: string
): TelegramGroup[] {
  try {
    return readJson(
      resolve(groupsDocPath(universitySlug, majorSlug)),
      groupsDocSchema
    ).groups
  } catch (error) {
    if (error instanceof RegistryNotFoundError) return []
    throw error
  }
}
