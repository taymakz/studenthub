import type { ChartCourse, RequisiteValue } from "./chart"

/**
 * Parses a chart-doc JSON payload (the exact global export shape:
 * { terms, moaref, unknown, electives }). Only `terms` and `moaref` are
 * meaningful to the builder - callers decide which parts to apply; unknown
 * and electives are always ignored here.
 */

export interface ParsedChartDoc {
  terms?: Record<number, ChartCourse[]>
  moaref?: ChartCourse[]
  isCompleted?: boolean
}

export type ParseChartDocResult = { error: string } | { parsed: ParsedChartDoc }

/* ==========================================================================
   New format parsing
   ========================================================================== */

function toUnits(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function toRequisites(
  value: unknown,
  codeToName?: Map<string, string>
): RequisiteValue {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : []
  }
  const names = toNameList(value, codeToName)
  // If the value was a single string that maps to a name, keep as array
  return names
}

function toNameList(
  value: unknown,
  codeToName?: Map<string, string>
): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const v of value) {
    if (typeof v === "string" && v.trim()) {
      const trimmed = v.trim()
      const mapped = codeToName?.get(trimmed)
      const name = mapped ?? trimmed
      if (!out.includes(name)) out.push(name)
    } else if (typeof v === "number" && Number.isFinite(v)) {
      // Numbers inside array (should not happen for prerequisites, but keep as string for safety)
      const s = String(v)
      if (!out.includes(s)) out.push(s)
    }
  }
  return out
}

function toCourse(
  raw: unknown,
  codeToName?: Map<string, string>
): ChartCourse | null {
  if (!raw || typeof raw !== "object") return null
  const record = raw as Record<string, unknown>
  if (typeof record.name !== "string" || !record.name.trim()) return null
  return {
    name: record.name.trim(),
    theoreticalUnits: toUnits(record.theoreticalUnits),
    practicalUnits: toUnits(record.practicalUnits),
    prerequisites: toRequisites(record.prerequisites, codeToName),
    corequisites: toNameList(record.corequisites, codeToName),
  }
}

function buildCodeToName(source: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>()
  const collect = (rawCourses: unknown) => {
    if (!Array.isArray(rawCourses)) return
    for (const raw of rawCourses) {
      if (!raw || typeof raw !== "object") continue
      const rec = raw as Record<string, unknown>
      const name = typeof rec.name === "string" ? rec.name.trim() : ""
      const code = typeof rec.code === "string" ? rec.code.trim() : ""
      if (name && code && !map.has(code)) map.set(code, name)
    }
  }
  if (source.terms && typeof source.terms === "object") {
    for (const rawCourses of Object.values(
      source.terms as Record<string, unknown>
    )) {
      collect(rawCourses)
    }
  }
  if (Array.isArray(source.moaref)) collect(source.moaref)
  if (Array.isArray(source.unknown)) collect(source.unknown as unknown[])
  if (source.electives && typeof source.electives === "object") {
    for (const group of Object.values(
      source.electives as Record<string, unknown>
    )) {
      if (
        group &&
        typeof group === "object" &&
        Array.isArray((group as Record<string, unknown>).courses)
      ) {
        collect((group as Record<string, unknown>).courses)
      }
    }
  }
  return map
}

export function parseChartDoc(text: string): ParseChartDocResult {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    return { error: "ورودی JSON معتبر نبود" }
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { error: "ساختار ورودی معتبر نبود" }
  }

  const source = doc as Record<string, unknown>

  // Legacy (old Nuxt builder) shape: numeric term keys + "moaref" sit at the
  // root and courses use course_name/course_code/course_unit with requisite
  // CODES instead of names. Convert it; never emit it.
  const looksLegacy =
    !("terms" in source) &&
    Object.entries(source).some(
      ([key, value]) =>
        (key === "moaref" || /^\d+$/.test(key)) && Array.isArray(value)
    )
  if (looksLegacy) {
    return parseLegacyChartDoc(source)
  }

  const codeToName = buildCodeToName(source)
  const parsed: ParsedChartDoc = {}
  if (typeof source.isCompleted === "boolean")
    parsed.isCompleted = source.isCompleted

  if (source.terms && typeof source.terms === "object") {
    const terms: Record<number, ChartCourse[]> = {}
    for (const [key, rawCourses] of Object.entries(
      source.terms as Record<string, unknown>
    )) {
      const term = Number.parseInt(key, 10)
      if (!Number.isFinite(term) || term < 1 || !Array.isArray(rawCourses)) {
        continue
      }
      const courses = rawCourses
        .map((raw) => toCourse(raw, codeToName))
        .filter((c): c is ChartCourse => c !== null)
      if (courses.length > 0) terms[term] = courses
    }
    if (Object.keys(terms).length > 0) parsed.terms = terms
  }

  if (Array.isArray(source.moaref)) {
    const moaref = source.moaref
      .map((raw) => toCourse(raw, codeToName))
      .filter((c): c is ChartCourse => c !== null)
    if (moaref.length > 0) parsed.moaref = moaref
  }

  if (!parsed.terms && !parsed.moaref) {
    return { error: "هیچ درسی در ورودی پیدا نشد" }
  }
  return { parsed }
}

/* ==========================================================================
   Legacy conversion (old Nuxt builder exports)
   ========================================================================== */

/** Converts one legacy requisite value: a bare number is a passed-units
    threshold (e.g. پروژه نرم افزار → 100); an array holds course CODES that
    get mapped to their course NAMES via the doc-wide index. Unmatched codes
    survive as raw strings so nothing disappears silently. */
function legacyRequisites(
  value: unknown,
  codeToName: Map<string, string>
): RequisiteValue {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : []
  }
  if (!Array.isArray(value)) return []
  const names: string[] = []
  for (const entry of value) {
    const name = codeToName.get(String(entry))
    if (name) {
      if (!names.includes(name)) names.push(name)
    } else if (typeof entry === "string" && entry.trim()) {
      names.push(entry.trim())
    } else if (typeof entry === "number" && Number.isFinite(entry)) {
      names.push(String(entry))
    }
  }
  return names
}

function legacyUnits(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** Legacy همنیاز is always a code list - never a unit threshold. */
function legacyNameList(
  value: unknown,
  codeToName: Map<string, string>
): string[] {
  const resolved = legacyRequisites(value, codeToName)
  return Array.isArray(resolved) ? resolved : []
}

function parseLegacyChartDoc(
  source: Record<string, unknown>
): ParseChartDocResult {
  const groups: Array<{ term?: number; moaref?: boolean; raw: unknown[] }> = []
  for (const [key, value] of Object.entries(source)) {
    if (!Array.isArray(value) || value.length === 0) continue
    if (key === "moaref") {
      groups.push({ moaref: true, raw: value })
    } else {
      const term = Number.parseInt(key, 10)
      if (Number.isFinite(term) && term >= 1) groups.push({ term, raw: value })
    }
  }

  // Doc-wide course_code → course_name index so requisites in ANY group can
  // resolve against courses defined anywhere (terms or moaref).
  const codeToName = new Map<string, string>()
  for (const group of groups) {
    for (const raw of group.raw) {
      if (!raw || typeof raw !== "object") continue
      const record = raw as Record<string, unknown>
      const name =
        typeof record.course_name === "string" ? record.course_name.trim() : ""
      const code =
        typeof record.course_code === "string" ||
        typeof record.course_code === "number"
          ? String(record.course_code)
          : ""
      if (name && code && !codeToName.has(code)) codeToName.set(code, name)
    }
  }

  const convertLegacyCourse = (raw: unknown): ChartCourse | null => {
    if (!raw || typeof raw !== "object") return null
    const record = raw as Record<string, unknown>
    const name =
      typeof record.course_name === "string" ? record.course_name.trim() : ""
    if (!name) return null
    return {
      name,
      // Legacy stores ONE total; the badge/totals only use the sum.
      theoreticalUnits: legacyUnits(record.course_unit),
      practicalUnits: 0,
      prerequisites: legacyRequisites(record.pre_requisites, codeToName),
      corequisites: legacyNameList(record.co_requisites, codeToName),
    }
  }

  const parsed: ParsedChartDoc = {}
  const terms: Record<number, ChartCourse[]> = {}
  for (const group of groups) {
    const courses = group.raw
      .map(convertLegacyCourse)
      .filter((c): c is ChartCourse => c !== null)
    if (courses.length === 0) continue
    if (group.moaref) parsed.moaref = courses
    else if (group.term != null) terms[group.term] = courses
  }
  if (Object.keys(terms).length > 0) parsed.terms = terms

  if (!parsed.terms && !parsed.moaref) {
    return { error: "هیچ درسی در ورودی پیدا نشد" }
  }
  return { parsed }
}
