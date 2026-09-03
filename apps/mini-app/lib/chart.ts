import type { MyChart } from "@/lib/api"

/**
 * One flattened curriculum line that the profile widgets work with. Term index
 * comes from the chart's term key (e.g. "7"), معارف / ناشناس are flagged so a
 * course can be grouped and excluded from the graduation unit total where the
 * old widgets did.
 */
export interface ChartCourseItem {
  name: string
  code: string
  /** theoreticalUnits + practicalUnits. */
  units: number
  termNumber?: number
  isMoaref: boolean
  isUnknown: boolean
}

export interface PoolCourse {
  name: string
  code?: string
  theoreticalUnits?: number
  practicalUnits?: number
}

/**
 * Minimal chart shape the pool builder needs - a full MyChart satisfies it,
 * and so does a friend chart served by the API (terms/moaref/unknown only).
 */
export interface ChartPoolSource {
  terms?: Record<string, PoolCourse[]> | null
  moaref?: PoolCourse[] | null
  unknown?: PoolCourse[] | null
}

function toItem(
  c: PoolCourse,
  termNumber: number | undefined,
  isMoaref: boolean,
  isUnknown: boolean
): ChartCourseItem {
  return {
    name: c.name,
    code: c.code ?? "",
    units: (c.theoreticalUnits ?? 0) + (c.practicalUnits ?? 0),
    termNumber,
    isMoaref,
    isUnknown,
  }
}

/**
 * Flattens the graduation chart into one pool. Like the old
 * `getUserEntryDataCourseListDetail`, electives are deliberately kept OUT -
 * they are selection pools and counting them would double-count the required
 * units (the old widget counted terms + معارف + ناشناس only).
 */
export function flattenChart(
  chart: ChartPoolSource | MyChart | null | undefined
): ChartCourseItem[] {
  if (!chart) return []
  const out: ChartCourseItem[] = []
  for (const [termKey, courses] of Object.entries(chart.terms ?? {})) {
    for (const c of courses) out.push(toItem(c, Number(termKey), false, false))
  }
  for (const c of chart.moaref ?? [])
    out.push(toItem(c, undefined, true, false))
  for (const c of chart.unknown ?? [])
    out.push(toItem(c, undefined, false, true))
  return out
}

/** Total graduation units - counts terms + معارف, skips ناشناس. */
export function totalRequiredUnits(pool: ChartCourseItem[]): number {
  return pool.reduce((sum, c) => (c.isUnknown ? sum : sum + c.units), 0)
}

/** Sum of units for a set of passed names, deduped, that exist in the pool and aren't ناشناس. */
export function passedUnits(
  pool: ChartCourseItem[],
  passedNames: Iterable<string>
): {
  units: number
  names: string[]
  tracked: Set<string>
} {
  const names = new Set(passedNames)
  const tracked = new Set<string>()
  let units = 0
  for (const c of pool) {
    if (c.isUnknown) continue
    if (names.has(c.name) && !tracked.has(c.name)) {
      tracked.add(c.name)
      units += c.units
    }
  }
  return { units, names: [...tracked], tracked }
}

/** Unique term numbers that hold at least one course (sorted ascending). */
export function uniqueTerms(pool: ChartCourseItem[]): number[] {
  const set = new Set<number>()
  for (const c of pool) {
    if (!c.isMoaref && !c.isUnknown && typeof c.termNumber === "number") {
      set.add(c.termNumber)
    }
  }
  return [...set].sort((a, b) => a - b)
}
