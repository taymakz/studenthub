import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ZodType } from "zod"

import {
  archivesDocSchema,
  chartDocSchema,
  groupsDocSchema,
  majorDocSchema,
  offeringDiffDocSchema,
  offeringDocSchema,
  professorsDocSchema,
  universityDocSchema,
} from "./schema/index"
import {
  chartDegreeMetaPath,
  majorDocPathLegacy,
  parseChartFileName,
  parseSemesterFileName,
  registryRoot,
  universityDocPathLegacy,
} from "./paths"
import { parseYearDirectory } from "./year-dir"
import { chartDegreeMetaSchema } from "./schema/chart"

/**
 * Validates the whole registry tree. This is what CI runs on every PR:
 *
 *   pnpm --filter @workspace/registry validate
 *
 * Checks performed:
 *   - every university.json / major.json parses against its zod schema
 *   - chart dirs are valid year directories ([a-b] or single)
 *   - chart degree folders exist in the major's degrees list
 *   - chart semester files are mehr/bahman/summer/both.json; both.json
 *     (shared MEHR+BAHMAN doc) never coexists with mehr/bahman.json
 *   - chart doc degree/semester fields match their path
 *   - courses/<year>/<semester>/ holds a required new.json + optional CI-
 *     rotated old.json; both parse and match their path; nothing else
 *   - optional professors/archives/groups docs parse when present
 *   - no orphan files inside data directories (everything must be known)
 */

type Problem = { path: string; message: string }

const problems: Problem[] = []

function problem(path: string, message: string) {
  problems.push({ path, message })
}

function tryParse(
  path: string,
  schema: ZodType<unknown>,
  label: string
): Record<string, unknown> | null {
  if (!existsSync(path)) return null // missing optional doc

  const result = schema.safeParse(JSON.parse(readFileSync(path, "utf-8")))
  if (!result.success) {
    for (const issue of result.error.issues) {
      problem(
        path,
        `${label}: ${issue.path.join(".") || "(root)"} - ${issue.message}`
      )
    }
    return null
  }
  return result.data as Record<string, unknown>
}

export function validateRegistry(): {
  ok: boolean
  problems: Problem[]
  filesChecked: number
} {
  problems.length = 0
  const root = registryRoot()
  const universitiesDir = join(root, "universities")

  if (!existsSync(universitiesDir)) {
    return {
      ok: false,
      problems: [
        {
          path: universitiesDir,
          message: "registry has no universities/ directory",
        },
      ],
      filesChecked: 0,
    }
  }

  let filesChecked = 0

  for (const uniSlug of sortedDirs(universitiesDir)) {
    const uniPath = join(universitiesDir, uniSlug)
    if (!slugRe.test(uniSlug))
      problem(
        uniPath,
        `university folder name "${uniSlug}" is not a valid slug`
      )

    // New canonical is meta.json, legacy university.json still accepted for migration
    let uni: Record<string, unknown> | null = tryParse(
      join(uniPath, "meta.json"),
      universityDocSchema,
      "meta.json"
    )
    if (!uni) {
      uni = tryParse(
        join(uniPath, "university.json"),
        universityDocSchema,
        "university.json (legacy)"
      )
      if (uni)
        problem(
          join(uniPath, "university.json"),
          `legacy file "university.json" should be renamed to "meta.json"`
        )
    }
    if (uni) filesChecked++
    if (uni && uni.slug !== uniSlug)
      problem(
        uniPath,
        `university.slug "${uni.slug}" != folder name "${uniSlug}"`
      )

    const majorsDir = join(uniPath, "majors")
    for (const majorSlug of sortedDirs(majorsDir)) {
      const majorPath = join(majorsDir, majorSlug)
      if (!slugRe.test(majorSlug))
        problem(
          majorPath,
          `major folder name "${majorSlug}" is not a valid slug`
        )

      let major = tryParse(
        join(majorPath, "meta.json"),
        majorDocSchema,
        "meta.json"
      )
      if (!major) {
        major = tryParse(
          join(majorPath, "major.json"),
          majorDocSchema,
          "major.json (legacy)"
        )
        if (major)
          problem(
            join(majorPath, "major.json"),
            `legacy file "major.json" should be renamed to "meta.json"`
          )
      }
      if (major) filesChecked++
      if (major && major.slug !== majorSlug)
        problem(
          majorPath,
          `major.slug "${major.slug}" != folder name "${majorSlug}"`
        )
      let degreeSlugs = new Set(
        ((major?.degrees as Array<{ slug: string }> | undefined) ?? []).map(
          (d) => d.slug
        )
      )
      // Degrees now live per-degree as charts/<degree>/meta.json — if major.json has no degrees, derive from filesystem
      const chartsDir = join(majorPath, "charts")
      if (degreeSlugs.size === 0 && existsSync(chartsDir)) {
        for (const d of sortedDirs(chartsDir)) degreeSlugs.add(d)
      }

      // Charts: charts/<degree>/<yearDir>/<semester>.json
      for (const degreeSlug of sortedDirs(chartsDir)) {
        if (!degreeSlugs.has(degreeSlug)) {
          problem(
            join(chartsDir, degreeSlug),
            `chart degree folder "${degreeSlug}" is not declared in major.json degrees`
          )
        }
        // Degree meta.json — required: charts/<degree>/meta.json
        const degreeMetaPath = join(chartsDir, degreeSlug, "meta.json")
        const degreeMeta = tryParse(
          degreeMetaPath,
          chartDegreeMetaSchema,
          "chart degree meta.json"
        )
        if (degreeMeta) {
          filesChecked++
          if ((degreeMeta as Record<string, unknown>).slug !== degreeSlug) {
            problem(
              degreeMetaPath,
              `chart degree meta.slug "${(degreeMeta as Record<string, unknown>).slug}" != folder "${degreeSlug}"`
            )
          }
        } else if (!existsSync(degreeMetaPath)) {
          problem(
            degreeMetaPath,
            `missing chart degree meta.json (charts/${degreeSlug}/meta.json)`
          )
        }
        for (const yearName of sortedDirs(join(chartsDir, degreeSlug))) {
          const yearPath = join(chartsDir, degreeSlug, yearName)
          if (!parseYearDirectory(yearName)) {
            problem(
              yearPath,
              `"${yearName}" is not a valid year directory ("1405" or "[1403-1404]")`
            )
            continue
          }
          for (const fileName of listFiles(yearPath)) {
            const chartSemester = parseChartFileName(fileName)
            if (!chartSemester) {
              // Optional PDF twin (<semester>.pdf) is allowed - it is what
              // «دریافت چارت» sends to students. Anything else is an orphan.
              const pdfBase = fileName.replace(/\.pdf$/i, "")
              if (
                /\.pdf$/i.test(fileName) &&
                parseChartFileName(`${pdfBase}.json`)
              ) {
                continue
              }
              problem(
                join(yearPath, fileName),
                `unknown chart file "${fileName}" (expected mehr/bahman/summer/both.json[.pdf])`
              )
              continue
            }
            // both.json replaces mehr+bahman - the individual files must not
            // coexist with it or one silently shadows the other.
            if (chartSemester === "BOTH") {
              for (const dup of ["mehr.json", "bahman.json"]) {
                if (existsSync(join(yearPath, dup))) {
                  problem(
                    join(yearPath, dup),
                    `"${dup}" conflicts with both.json - delete the duplicate`
                  )
                }
              }
            }
            filesChecked++
            const chart = tryParse(
              join(yearPath, fileName),
              chartDocSchema,
              `chart ${fileName}`
            )
            if (chart) {
              if (chart.degree != null && chart.degree !== degreeSlug)
                problem(
                  join(yearPath, fileName),
                  `chart.degree "${chart.degree}" != folder "${degreeSlug}"`
                )
              if (chart.semester != null && chart.semester !== chartSemester)
                problem(
                  join(yearPath, fileName),
                  `chart.semester "${chart.semester}" != file "${fileName}"`
                )
            }
          }
        }
      }

      // Courses: courses/<year>/<semester>/{new.json, old.json}
      const coursesDir = join(majorPath, "courses")
      for (const yearName of sortedDirs(coursesDir)) {
        const yearPath = join(coursesDir, yearName)
        if (!/^\d{4}$/.test(yearName)) {
          problem(
            yearPath,
            `courses year folder "${yearName}" must be a plain 4-digit year`
          )
          continue
        }
        // Stray files directly under the year dir are layout violations -
        // offerings live in <year>/<semester>/new.json since the rotation
        // format landed.
        for (const fileName of listFiles(yearPath)) {
          problem(
            join(yearPath, fileName),
            `unexpected file "${fileName}" (offerings live in <year>/<semester>/new.json)`
          )
        }

        for (const semName of sortedDirs(yearPath)) {
          const semPath = join(yearPath, semName)
          const semester = parseSemesterFileName(`${semName}.json`)
          if (!semester) {
            problem(
              semPath,
              `unknown semester folder "${semName}" (expected mehr/bahman/summer)`
            )
            continue
          }
          for (const fileName of listFiles(semPath)) {
            if (
              fileName !== "new.json" &&
              fileName !== "old.json" &&
              fileName !== "diff.json"
            ) {
              problem(
                join(semPath, fileName),
                `unexpected file "${fileName}" (only new.json / old.json / diff.json)`
              )
            }
          }

          const newPath = join(semPath, "new.json")
          if (!existsSync(newPath)) {
            problem(newPath, "missing new.json (latest offering snapshot)")
          } else {
            filesChecked++
            const doc = tryParse(
              newPath,
              offeringDocSchema,
              "offerings new.json"
            )
            if (doc) {
              if (doc.year !== Number(yearName))
                problem(
                  newPath,
                  `doc.year "${doc.year}" != folder "${yearName}"`
                )
              if (doc.semester !== semester)
                problem(
                  newPath,
                  `doc.semester "${doc.semester}" != folder "${semName}"`
                )
            }
          }

          const oldPath = join(semPath, "old.json")
          if (existsSync(oldPath)) {
            filesChecked++
            const prev = tryParse(
              oldPath,
              offeringDocSchema,
              "offerings old.json"
            )
            if (prev) {
              if (prev.year !== Number(yearName))
                problem(
                  oldPath,
                  `doc.year "${prev.year}" != folder "${yearName}"`
                )
              if (prev.semester !== semester)
                problem(
                  oldPath,
                  `doc.semester "${prev.semester}" != folder "${semName}"`
                )
            }
          }

          const diffPath = join(semPath, "diff.json")
          if (existsSync(diffPath)) {
            filesChecked++
            const diff = tryParse(
              diffPath,
              offeringDiffDocSchema,
              "offerings diff.json"
            )
            if (diff) {
              if (diff.year !== Number(yearName))
                problem(
                  diffPath,
                  `diff.year "${diff.year}" != folder "${yearName}"`
                )
              if (diff.semester !== semester)
                problem(
                  diffPath,
                  `diff.semester "${diff.semester}" != folder "${semName}"`
                )
              if (diff.universitySlug !== uniSlug)
                problem(
                  diffPath,
                  `diff.universitySlug "${diff.universitySlug}" != folder "${uniSlug}"`
                )
              if (diff.majorSlug !== majorSlug)
                problem(
                  diffPath,
                  `diff.majorSlug "${diff.majorSlug}" != folder "${majorSlug}"`
                )
            }
          }
        }
      }

      // Optional per-major docs
      if (
        tryParse(
          join(majorPath, "professors.json"),
          professorsDocSchema,
          "professors.json"
        )
      )
        filesChecked++
      if (
        tryParse(
          join(majorPath, "archives.json"),
          archivesDocSchema,
          "archives.json"
        )
      )
        filesChecked++
      if (
        tryParse(join(majorPath, "groups.json"), groupsDocSchema, "groups.json")
      )
        filesChecked++

      // Orphan JSON files directly under the major dir (not one of the known docs)
      const knownDocs = new Set([
        "meta.json",
        "major.json",
        "professors.json",
        "archives.json",
        "groups.json",
      ])
      for (const file of listFiles(majorPath)) {
        if (!knownDocs.has(file))
          problem(
            join(majorPath, file),
            `unexpected file "${file}" in major directory`
          )
      }
    }
  }

  return { ok: problems.length === 0, problems, filesChecked }
}

const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/

function sortedDirs(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
}
