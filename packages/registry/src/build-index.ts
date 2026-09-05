import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

import {
  getChart,
  getMajor,
  getOfferingDiff,
  getPreviousOfferings,
  getUniversity,
  listChartFiles,
  listChartYearDirs,
  listMajorSlugs,
  listOfferingTerms,
  listUniversitySlugs,
} from "./loader"
import { coursesDir, registryRoot } from "./paths"
import type { LocalizedText, Semester, UniversityType } from "./schema/index"
import { coveredSemesters } from "./schema/chart"
import { formatYearDirectory, type YearDirectory } from "./year-dir"

/**
 * Generates the search layer: registry/index/*.json - flat, denormalized
 * views of the whole tree so the mini app / API can answer "which
 * universities/majors/charts/courses exist" from ONE small read instead of
 * walking thousands of directories per request (serverless-friendly).
 *
 * Run via CI after every merge to main:
 *
 *   pnpm --filter @workspace/registry build-index
 *
 * Everything here is derived data - never hand-edit the output.
 */

export interface UniversityIndexEntry {
  slug: string
  name: LocalizedText
  /** Institution type (azad | gov | pnu) - drives the card logo in the app. */
  type: UniversityType
  location: LocalizedText
}

export interface MajorIndexEntry {
  uniSlug: string
  slug: string
  name: LocalizedText
  degrees: Array<{
    slug: string
    name: LocalizedText
    termCount: number
    maxTermCount?: number
  }>
}

export interface ChartIndexEntry {
  uniSlug: string
  majorSlug: string
  degreeSlug: string
  yearDir: string
  /** Semesters this file covers - BOTH fans out to MEHR + BAHMAN. */
  semesters: Semester[]
  /** Registry-relative path of the actual chart file (forward slashes). */
  path: string
}

export interface OfferingTermIndexEntry {
  uniSlug: string
  majorSlug: string
  year: number
  semester: Semester
  /** True when a rotated old.json exists next to new.json. */
  hasPrevious: boolean
}

export interface OfferingDiffIndexEntry {
  id: string
  uniSlug: string
  majorSlug: string
  year: number
  semester: Semester
  createdAt: string
  summary: { added: number; removed: number; changed: number }
  hasPrevious: boolean
}

/** Unique course catalog across ALL charts - the global course search. */
export interface CourseIndexEntry {
  name: string
  code?: string
  theoreticalUnits: number
  practicalUnits: number
  refs: Array<{ uniSlug: string; majorSlug: string; degreeSlug: string }>
}

export interface RegistryIndex {
  universities: UniversityIndexEntry[]
  majors: MajorIndexEntry[]
  charts: ChartIndexEntry[]
  offeringTerms: OfferingTermIndexEntry[]
  offeringDiffs: OfferingDiffIndexEntry[]
  courses: CourseIndexEntry[]
}

function indexFilePath(name: string): string {
  return join(registryRoot(), "index", `${name}.json`)
}

function writeIndexFile<T>(name: string, data: T): void {
  const path = indexFilePath(name)
  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
}

export function buildRegistryIndex(): RegistryIndex {
  const universities: UniversityIndexEntry[] = []
  const majors: MajorIndexEntry[] = []
  const charts: ChartIndexEntry[] = []
  const offeringTerms: OfferingTermIndexEntry[] = []
  const offeringDiffs: OfferingDiffIndexEntry[] = []

  // Dedup key -> catalog entry; keyed by normalized name (code removed)
  const courseByKey = new Map<string, CourseIndexEntry>()
  const courseKey = (name: string) => `n:${name.trim().toLowerCase()}`

  for (const uniSlug of listUniversitySlugs()) {
    const uni = getUniversity(uniSlug)
    if (!uni) continue
    universities.push({
      slug: uni.slug,
      name: uni.name,
      type: uni.type,
      location: uni.location,
    })

    for (const majorSlug of listMajorSlugs(uniSlug)) {
      const major = getMajor(uniSlug, majorSlug)
      if (!major) continue
      // Degrees may live in major.json (legacy) or per-degree as charts/<degree>/meta.json
      let degrees: Array<{
        slug: string
        name: import("./schema/index").LocalizedText
        termCount: number
        maxTermCount?: number
      }> = (major.degrees ?? []) as any
      if (degrees.length === 0) {
        const chartsRoot = join(
          registryRoot(),
          "universities",
          uniSlug,
          "majors",
          majorSlug,
          "charts"
        )
        try {
          const dirs = readdirSync(chartsRoot, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
          for (const degSlug of dirs) {
            try {
              const metaPath = join(chartsRoot, degSlug, "meta.json")
              if (existsSync(metaPath)) {
                const meta = JSON.parse(readFileSync(metaPath, "utf-8"))
                degrees.push({
                  slug: meta.slug ?? degSlug,
                  name: meta.name ?? { fa: degSlug },
                  termCount: meta.termCount ?? 8,
                  maxTermCount: meta.maxTermCount,
                })
              }
            } catch {}
          }
        } catch {}
      } else {
        // Enrich existing degrees with maxTermCount from chart-degree meta when available
        for (const d of degrees) {
          try {
            const metaPath = join(
              registryRoot(),
              "universities",
              uniSlug,
              "majors",
              majorSlug,
              "charts",
              d.slug,
              "meta.json"
            )
            if (existsSync(metaPath)) {
              const meta = JSON.parse(readFileSync(metaPath, "utf-8"))
              if (meta.maxTermCount != null)
                (d as any).maxTermCount = meta.maxTermCount
            }
          } catch {}
        }
      }
      majors.push({
        uniSlug,
        slug: major.slug,
        name: major.name,
        degrees: degrees.map((d) => ({
          slug: d.slug,
          name: d.name,
          termCount: d.termCount,
          ...(d.maxTermCount != null ? { maxTermCount: d.maxTermCount } : {}),
        })),
      })

      // Charts: one entry per physically present chart file.
      for (const degree of degrees) {
        const yearDirs: YearDirectory[] = listChartYearDirs(
          uniSlug,
          majorSlug,
          degree.slug
        )
        for (const yearDir of yearDirs) {
          const dirName = formatYearDirectory(yearDir)
          for (const file of listChartFiles(
            uniSlug,
            majorSlug,
            degree.slug,
            dirName
          )) {
            const path = [
              "universities",
              uniSlug,
              "majors",
              majorSlug,
              "charts",
              degree.slug,
              dirName,
              file.fileName,
            ].join("/")

            // Clean legacy fields (type/degree/semester) on next build — file name + folder already declare them
            try {
              const absPath = join(registryRoot(), path)
              const raw = readFileSync(absPath, "utf-8")
              const data = JSON.parse(raw) as Record<string, unknown>
              let changed = false
              for (const key of ["type", "degree", "semester"] as const) {
                if (key in data) {
                  delete (data as Record<string, unknown>)[key]
                  changed = true
                }
              }
              if (changed) {
                writeFileSync(absPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
              }
            } catch {}

            charts.push({
              uniSlug,
              majorSlug,
              degreeSlug: degree.slug,
              yearDir: dirName,
              semesters: coveredSemesters(file.semester),
              path,
            })

            // Flatten every course line into the global catalog.
            const chart = getChart(
              uniSlug,
              majorSlug,
              degree.slug,
              dirName,
              file.semester === "BOTH" ? "MEHR" : file.semester
            )
            if (!chart) continue
            const lines = [
              ...Object.values(chart.terms).flat(),
              ...chart.moaref,
              ...Object.values(chart.electives).flatMap((g) => g.courses),
            ]
            for (const line of lines) {
              const key = courseKey(line.name)
              let entry = courseByKey.get(key)
              if (!entry) {
                entry = {
                  name: line.name,
                  theoreticalUnits: line.theoreticalUnits,
                  practicalUnits: line.practicalUnits,
                  refs: [],
                }
                courseByKey.set(key, entry)
              }
              const ref = {
                uniSlug,
                majorSlug,
                degreeSlug: degree.slug,
              }
              if (
                !entry.refs.some(
                  (r) =>
                    r.uniSlug === ref.uniSlug &&
                    r.majorSlug === ref.majorSlug &&
                    r.degreeSlug === ref.degreeSlug
                )
              ) {
                entry.refs.push(ref)
              }
            }
          }
        }
      }

      // Clean legacy year/semester fields from offering snapshots (now inferred from path)
      for (const term of listOfferingTerms(uniSlug, majorSlug)) {
        try {
          const newPath = join(registryRoot(), coursesDir(uniSlug, majorSlug), String(term.year), term.semester.toLowerCase(), "new.json")
          const rawNew = readFileSync(newPath, "utf-8")
          const dataNew = JSON.parse(rawNew) as Record<string, unknown>
          let changedNew = false
          for (const k of ["year", "semester"] as const) if (k in dataNew) { delete dataNew[k]; changedNew = true }
          if (changedNew) writeFileSync(newPath, `${JSON.stringify(dataNew, null, 2)}\n`, "utf-8")
          const oldPath = join(registryRoot(), coursesDir(uniSlug, majorSlug), String(term.year), term.semester.toLowerCase(), "old.json")
          if (existsSync(oldPath)) {
            const rawOld = readFileSync(oldPath, "utf-8")
            const dataOld = JSON.parse(rawOld) as Record<string, unknown>
            let changedOld = false
            for (const k of ["year", "semester"] as const) if (k in dataOld) { delete dataOld[k]; changedOld = true }
            if (changedOld) writeFileSync(oldPath, `${JSON.stringify(dataOld, null, 2)}\n`, "utf-8")
          }
        } catch {}
      }

      // Offering terms with snapshot-pair status.
      for (const term of listOfferingTerms(uniSlug, majorSlug)) {
        const prev = getPreviousOfferings(
          uniSlug,
          majorSlug,
          term.year,
          term.semester
        )
        offeringTerms.push({
          uniSlug,
          majorSlug,
          year: term.year,
          semester: term.semester,
          hasPrevious: prev !== null,
        })
        const diff = getOfferingDiff(
          uniSlug,
          majorSlug,
          term.year,
          term.semester
        )
        if (diff) {
          offeringDiffs.push({
            id: diff.id,
            uniSlug,
            majorSlug,
            year: term.year,
            semester: term.semester,
            createdAt: diff.generatedAt,
            summary: diff.summary,
            hasPrevious: prev !== null,
          })
        }
      }
    }
  }

  const index: RegistryIndex = {
    universities: universities.sort((a, b) => a.slug.localeCompare(b.slug)),
    majors: majors.sort(
      (a, b) =>
        a.uniSlug.localeCompare(b.uniSlug) || a.slug.localeCompare(b.slug)
    ),
    charts,
    offeringTerms,
    offeringDiffs,
    courses: [...courseByKey.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "fa")
    ),
  }

  writeIndexFile("universities", index.universities)
  writeIndexFile("majors", index.majors)
  writeIndexFile("charts", index.charts)
  writeIndexFile("offering-terms", index.offeringTerms)
  writeIndexFile("offering-diffs", index.offeringDiffs)
  writeIndexFile("courses", index.courses)

  return index
}
