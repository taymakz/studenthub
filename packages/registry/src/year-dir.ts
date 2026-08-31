import { z } from "zod"

/**
 * Smart year-directory detector.
 *
 * Registry directories that scope data by cohort/term year accept two shapes:
 *
 *   "[1403-1404]"   a RANGE - students entering in 1403 or 1404 share the
 *                   same curriculum chart (common when two cohorts are merged)
 *   "1405"          a SINGLE year
 *
 * Everything downstream (sorting, lookup, formatting) works on the parsed
 * form so callers never string-compare directory names.
 */
export type YearDirectory =
  { kind: "single"; year: number } | { kind: "range"; from: number; to: number }

const YEAR_MIN = 1300
const YEAR_MAX = 1500

/** Range span — no hard cap (e.g. [1399-1500] is valid); kept for backwards compat only. */
export const MAX_RANGE_SPAN = 200

export function isPersianYear(value: number): boolean {
  return Number.isInteger(value) && value >= YEAR_MIN && value <= YEAR_MAX
}

/**
 * Parse a directory name into a YearDirectory. Returns null for names that
 * are not valid year directories (lets callers skip unrelated folders).
 */
export function parseYearDirectory(name: string): YearDirectory | null {
  const trimmed = name.trim()

  // Range: [a-b]
  const rangeMatch = /^\[(\d{4})-(\d{4})\]$/.exec(trimmed)
  if (rangeMatch) {
    const from = Number(rangeMatch[1])
    const to = Number(rangeMatch[2])
    if (!isPersianYear(from) || !isPersianYear(to)) return null
    if (from > to) return null
    if (to - from + 1 > MAX_RANGE_SPAN) return null
    return { kind: "range", from, to }
  }

  // Single: 1405
  if (/^\d{4}$/.test(trimmed)) {
    const year = Number(trimmed)
    if (!isPersianYear(year)) return null
    return { kind: "single", year }
  }

  return null
}

export function formatYearDirectory(dir: YearDirectory): string {
  return dir.kind === "single" ? String(dir.year) : `[${dir.from}-${dir.to}]`
}

/** First (earliest) year covered by the directory - used for sorting. */
export function yearDirectoryStart(dir: YearDirectory): number {
  return dir.kind === "single" ? dir.year : dir.from
}

/** Last (latest) year covered by the directory. */
export function yearDirectoryEnd(dir: YearDirectory): number {
  return dir.kind === "single" ? dir.year : dir.to
}

/** Ascending by start year; ranges sharing a start sort before singles. */
export function compareYearDirectories(
  a: YearDirectory,
  b: YearDirectory
): number {
  const start = yearDirectoryStart(a) - yearDirectoryStart(b)
  if (start !== 0) return start
  return yearDirectoryEnd(a) - yearDirectoryEnd(b)
}

export function sortYearDirectories(
  dirs: YearDirectory[],
  order: "asc" | "desc" = "desc"
): YearDirectory[] {
  return [...dirs].sort((a, b) =>
    order === "asc"
      ? compareYearDirectories(a, b)
      : compareYearDirectories(b, a)
  )
}

/**
 * Does this directory cover the given year? A single covers only itself,
 * a range covers every year inside it (inclusive).
 */
export function yearDirectoryCovers(dir: YearDirectory, year: number): boolean {
  return year >= yearDirectoryStart(dir) && year <= yearDirectoryEnd(dir)
}

/** Zod schema for accepting a raw year-directory string at API boundaries. */
export const yearDirectorySchema = z
  .string()
  .max(16)
  .refine((v) => parseYearDirectory(v) !== null, {
    message: 'must be a year like "1405" or a range like "[1403-1404]"',
  })
  .transform((v) => parseYearDirectory(v) as YearDirectory)
