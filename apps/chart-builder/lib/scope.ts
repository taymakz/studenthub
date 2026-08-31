import { detectTerm } from "./jalali"
import type { Semester } from "./chart"

/**
 * Builder scope: the meta that decides where the chart lands in the registry
 * (`charts/<degree>/<yearDir>/<semester>.json`) plus which builder UI is
 * active. Persisted separately from the chart content (sb-scope:<profile>).
 */
export interface BuilderScope {
  /** Builder layout: normal term grid vs advanced elective groups. */
  mode: "normal" | "advanced"
  /** Entry semesters to build/export for (multi-select; تابستان optional). */
  semesters: Semester[]
  /** Entry-cohort years (single years; exported as [a-b] dirs when consecutive). */
  years: number[]
}

export function defaultScope(now: Date = new Date()): BuilderScope {
  const detected = detectTerm(now)
  return {
    mode: "normal",
    semesters: [detected.semester],
    years: [detected.year],
  }
}

/**
 * Group sorted selected years into registry year-directories: consecutive
 * runs collapse into "[a-b]" ranges (max 4 per the smart detector), single
 * years stay plain "1405".
 */
export function groupYearDirs(years: number[]): string[] {
  const sorted = [...new Set(years)].sort((a, b) => a - b)
  const dirs: string[] = []
  let run: number[] = []

  const flush = () => {
    while (run.length > 0) {
      const chunk = run.slice(0, 4)
      run = run.slice(4)
      const first = chunk[0]
      const last = chunk[chunk.length - 1] ?? first
      dirs.push(
        chunk.length === 1 || first === undefined
          ? String(first)
          : `[${first}-${last}]`
      )
    }
  }

  for (const year of sorted) {
    const runTail = run[run.length - 1]
    if (run.length === 0 || year === (runTail ?? -Infinity) + 1) {
      run.push(year)
      continue
    }
    flush()
    run = [year]
  }
  flush()

  return dirs
}
