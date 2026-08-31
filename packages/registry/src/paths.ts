import { join } from "node:path"
import { fileURLToPath } from "node:url"

import type { ChartSemester } from "./schema/chart"
import type { Semester } from "./schema/shared"

/**
 * Central definition of the registry folder layout. Keep every path in the
 * codebase derived from here - never hand-build registry paths elsewhere.
 *
 * <root>/universities/<uni>/university.json
 * <root>/universities/<uni>/majors/<major>/major.json
 * <root>/universities/<uni>/majors/<major>/charts/<degree>/<yearDir>/<semester>.json  (semester = mehr|bahman|both)
 * <root>/universities/<uni>/majors/<major>/courses/<year>/<SEMESTER>/new.json
 * <root>/universities/<uni>/majors/<major>/courses/<year>/<SEMESTER>/old.json
 * <root>/universities/<uni>/majors/<major>/professors.json
 * <root>/universities/<uni>/majors/<major>/archives.json
 * <root>/universities/<uni>/majors/<major>/groups.json
 * <root>/index/*.json (generated search layer - never hand-edited)
 */
export const SEMESTER_FILE_NAMES: Record<Semester, string> = {
  MEHR: "mehr",
  BAHMAN: "bahman",
  SUMMER: "summer",
}

/** Chart files: mehr / bahman / both (shared MEHR+BAHMAN). No summer — charts only for MEHR/BAHMAN. */
export const CHART_SEMESTER_FILE_NAMES: Record<ChartSemester, string> = {
  MEHR: "mehr",
  BAHMAN: "bahman",
  BOTH: "both",
}

const SEMESTER_BY_FILE_NAME = new Map(
  Object.entries(SEMESTER_FILE_NAMES).map(([semester, file]) => [
    `${file}.json`,
    semester as Semester,
  ])
)

const CHART_SEMESTER_BY_FILE_NAME = new Map(
  Object.entries(CHART_SEMESTER_FILE_NAMES).map(([semester, file]) => [
    `${file}.json`,
    semester as ChartSemester,
  ])
)

export function semesterFileName(semester: Semester): string {
  return `${SEMESTER_FILE_NAMES[semester]}.json`
}

export function chartFileName(semester: ChartSemester): string {
  return `${CHART_SEMESTER_FILE_NAMES[semester]}.json`
}

/** "mehr.json" -> "MEHR"; null for unknown names. */
export function parseSemesterFileName(name: string): Semester | null {
  return SEMESTER_BY_FILE_NAME.get(name.toLowerCase()) ?? null
}

/** Chart variant of the above: also accepts "both.json" -> "BOTH". */
export function parseChartFileName(name: string): ChartSemester | null {
  return CHART_SEMESTER_BY_FILE_NAME.get(name.toLowerCase()) ?? null
}

/**
 * Resolved at runtime so it works from any cwd (scripts, tests, serverless).
 * On Vercel, set REGISTRY_ROOT env var to the absolute path of the registry
 * directory (e.g. /var/task/packages/registry/registry).
 */
export function registryRoot(): string {
  const envRoot = process.env.REGISTRY_ROOT
  if (envRoot) return envRoot
  return fileURLToPath(new URL("../registry", import.meta.url))
}

export const universityDocPath = (uni: string) =>
  join("universities", uni, "meta.json")

/** @deprecated old path before meta.json rename — kept for backwards compat */
export const universityDocPathLegacy = (uni: string) =>
  join("universities", uni, "university.json")

export const majorsDir = (uni: string) => join("universities", uni, "majors")

export const majorDir = (uni: string, major: string) =>
  join(majorsDir(uni), major)

export const majorDocPath = (uni: string, major: string) =>
  join(majorDir(uni, major), "meta.json")

/** @deprecated */
export const majorDocPathLegacy = (uni: string, major: string) =>
  join(majorDir(uni, major), "major.json")

export const chartsDir = (uni: string, major: string) =>
  join(majorDir(uni, major), "charts")

export const chartDegreeMetaPath = (
  uni: string,
  major: string,
  degree: string
) => join(chartsDir(uni, major), degree, "meta.json")

export const chartPath = (
  uni: string,
  major: string,
  degree: string,
  yearDir: string,
  semester: ChartSemester
) => join(chartsDir(uni, major), degree, yearDir, chartFileName(semester))

export const coursesDir = (uni: string, major: string) =>
  join(majorDir(uni, major), "courses")

/** courses/<year>/<semester>/ - holds new.json (+ rotated old.json). */
export const offeringTermDir = (
  uni: string,
  major: string,
  year: number,
  semester: Semester
) => join(coursesDir(uni, major), String(year), SEMESTER_FILE_NAMES[semester])

export const OFFERING_CURRENT_FILE = "new.json"
export const OFFERING_PREVIOUS_FILE = "old.json"
export const OFFERING_DIFF_FILE = "diff.json"

/** Latest snapshot of a term - the only file contributors ever edit. */
export const offeringPath = (
  uni: string,
  major: string,
  year: number,
  semester: Semester
) => join(offeringTermDir(uni, major, year, semester), OFFERING_CURRENT_FILE)

/** Previous snapshot of a term - written by CI when a new new.json merges;
     absent for a term's very first snapshot. */
export const offeringOldPath = (
  uni: string,
  major: string,
  year: number,
  semester: Semester
) => join(offeringTermDir(uni, major, year, semester), OFFERING_PREVIOUS_FILE)

/** Diff of a term - written by sync script (old vs new); absent until first change. */
export const offeringDiffPath = (
  uni: string,
  major: string,
  year: number,
  semester: Semester
) => join(offeringTermDir(uni, major, year, semester), OFFERING_DIFF_FILE)

export const professorsDocPath = (uni: string, major: string) =>
  join(majorDir(uni, major), "professors.json")

export const archivesDocPath = (uni: string, major: string) =>
  join(majorDir(uni, major), "archives.json")

export const groupsDocPath = (uni: string, major: string) =>
  join(majorDir(uni, major), "groups.json")
