import type { ChartState } from "./chart"
import { semesterLabel } from "./chart"
import { toFaDigits } from "./jalali"
import type { BuilderScope } from "./scope"
import { groupYearDirs } from "./scope"

/**
 * Serializes the builder state into registry `chartDoc` JSON. No schema
 * validation here by design - the extension already validates its own output
 * and CI re-validates on the registry PR.
 */

export interface ChartDocPayload {
  type: "chart"
  degree: string
  semester: string
  isCompleted: boolean
  terms: Record<string, unknown>
  moaref: unknown[]
  unknown: unknown[]
  electives: Record<string, unknown>
}

export interface ExportTarget {
  /** Registry-relative destination: charts/<degree>/<yearDir>/<semester>.json */
  path: string
  fileName: string
  yearDir: string
  semester: string
}

export function exportTargets(
  chart: ChartState,
  scope: BuilderScope
): ExportTarget[] {
  const targets: ExportTarget[] = []
  const both =
    scope.semesters.includes("MEHR") && scope.semesters.includes("BAHMAN")
  for (const yearDir of groupYearDirs(scope.years)) {
    if (both) {
      // Both semesters → single both.json with semester: "BOTH"
      targets.push({
        path: `charts/${chart.degree}/${yearDir}/both.json`,
        fileName: `charts-${chart.degree}-${yearDir}-both.json`,
        yearDir,
        semester: "BOTH",
      })
    } else {
      for (const semester of scope.semesters) {
        const sem = semester.toLowerCase()
        targets.push({
          path: `charts/${chart.degree}/${yearDir}/${sem}.json`,
          fileName: `charts-${chart.degree}-${yearDir}-${sem}.json`,
          yearDir,
          semester,
        })
      }
    }
  }
  return targets
}

function buildDoc(chart: ChartState, semester?: string): ChartDocPayload {
  const terms: Record<string, unknown> = {}
  for (const [term, courses] of Object.entries(chart.terms)) {
    if (courses.length > 0) terms[term] = courses
  }

  const electives: Record<string, unknown> = {}
  for (const group of chart.electives) {
    electives[group.slug] = {
      title: group.title,
      requiredUnits: group.requiredUnits,
      allowedTerms: group.allowedTerms,
      courses: group.courses,
      ...(group.minPracticalUnits !== undefined
        ? { minPracticalUnits: group.minPracticalUnits }
        : {}),
    }
  }

  return {
    type: "chart",
    degree: chart.degree,
    semester: semester ?? "MEHR",
    isCompleted: chart.isCompleted,
    terms,
    moaref: chart.moaref,
    unknown: chart.unknown,
    electives,
  }
}

/** One pretty-printed doc per target, or a single combined JSON when the
    scope spans multiple year-dirs/semesters. */
export function exportJson(chart: ChartState, scope: BuilderScope): string {
  const targets = exportTargets(chart, scope)
  const docs = targets.map((target) => ({
    target,
    doc: buildDoc(chart, target.semester),
  }))

  const [single] = docs
  if (docs.length === 1 && single) {
    return `${JSON.stringify(single.doc, null, 2)}\n`
  }

  const combined: Record<string, ChartDocPayload> = {}
  for (const { target, doc } of docs) {
    combined[target.path] = doc
  }
  return `${JSON.stringify(combined, null, 2)}\n`
}

/** Download name matching the JSON shape above. */
export function exportFileName(chart: ChartState, scope: BuilderScope): string {
  const targets = exportTargets(chart, scope)
  const [single] = targets
  if (targets.length === 1 && single) return single.fileName
  return `charts-${chart.degree}.json`
}

function courseLine(course: {
  name: string
  theoreticalUnits: number
  practicalUnits: number
}): string {
  const units =
    course.theoreticalUnits + course.practicalUnits > 0
      ? ` (${toFaDigits(course.theoreticalUnits + course.practicalUnits)} واحد)`
      : ""
  return `- ${course.name}${units}`
}

/** Human-readable term-by-term summary of the chart content. */
export function exportTxt(chart: ChartState, scope: BuilderScope): string {
  const lines: string[] = []
  const degreeLabel = DEGREE_LABELS[chart.degree] ?? chart.degree

  lines.push(`چارت درسی - مقطع ${degreeLabel}`)
  lines.push(
    `ترم ورود: ${scope.semesters.map(semesterLabel).join("، ")} | سال ورود: ${groupYearDirs(scope.years).join("، ")}`
  )
  lines.push("")

  for (let term = 1; term <= chart.termCount; term++) {
    const courses = chart.terms[term] ?? []
    if (courses.length === 0) continue
    lines.push(`— ترم ${toFaDigits(term)} —`)
    for (const course of courses) lines.push(courseLine(course))
    lines.push("")
  }

  if (chart.moaref.length > 0) {
    lines.push("— معارف —")
    for (const course of chart.moaref) lines.push(courseLine(course))
    lines.push("")
  }

  if (chart.unknown.length > 0) {
    lines.push("— نامشخص —")
    for (const course of chart.unknown) lines.push(courseLine(course))
    lines.push("")
  }

  for (const group of chart.electives) {
    lines.push(
      `— ${group.title} (حداقل ${toFaDigits(group.requiredUnits)} واحد) —`
    )
    for (const course of group.courses) lines.push(courseLine(course))
    lines.push("")
  }

  return lines.join("\n")
}

const DEGREE_LABELS: Record<string, string> = {
  associate: "کاردانی",
  bachelor: "کارشناسی",
  master: "کارشناسی ارشد",
  phd: "دکتری",
}
