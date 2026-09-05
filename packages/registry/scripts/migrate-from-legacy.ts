import postgres from "postgres"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * One-time TEST migration: converts the legacy Supabase data
 * (_ignore/studenthub backend) into registry JSON documents.
 *
 *   pnpm --filter @workspace/registry migrate-from-legacy
 *
 * READ-ONLY on the remote side. Writes under registry/universities/<slug>/:
 *   - university.json / majors/<slug>/major.json (+degrees)
 *   - charts/<degree>/<yearDir>/<mehr|bahman>.json   (chart_data converted
 *     from the old Nuxt builder shape - same rules as the API importer)
 *   - courses/<year>/<term>/{new,old}.json           (is_old flag rotation)
 *
 * Entry-year names are free-text ("401", "Entry 1403 onwards", "400 and
 * before"); a heuristic picks the representative cohort year. Course terms
 * are derived heuristically from exam-date prefixes. Final production
 * migration will replace all of this.
 */

const REGISTRY_ROOT = fileURLToPath(new URL("../registry/", import.meta.url))

function legacyUrl(): string {
  const envPath = new URL(
    "../../../_ignore/studenthub/src/backend/.env",
    import.meta.url
  )
  const env = readFileSync(envPath, "utf8")
  const line = env.split("\n").find((l) => l.startsWith("DB_URL="))
  if (!line) throw new Error("DB_URL not found in legacy .env")
  return line.slice("DB_URL=".length).trim()
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Free-text entry-year -> representative cohort year number. */
function entryYearNumber(nameEn: string): number | null {
  const match = nameEn.match(/\d{3,4}/)
  if (!match) return null
  const n = Number.parseInt(match[0], 10)
  return n < 900 ? 1000 + n : n
}

/** Exam date "1405/10/22 ..." -> term placement heuristic. */
function termFromExam(examSchedule: string | null): {
  year: number
  semester: "MEHR" | "BAHMAN" | "SUMMER"
} | null {
  const match = examSchedule?.match(/(\d{4})\s*\/\s*(\d{1,2})/)
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  let semester: "MEHR" | "BAHMAN" | "SUMMER"
  if (month >= 9 || month === 1) semester = "MEHR"
  else if (month >= 2 && month <= 5) semester = "BAHMAN"
  else semester = "SUMMER"
  return { year, semester }
}

interface LegacyChartItem {
  course_name?: string
  course_code?: string | number
  course_unit?: number | string
  pre_requisites?: Array<string | number>
  co_requisites?: Array<string | number>
}

/** Converts one legacy course item to the current chartCourseSchema. */
function convertChartCourse(item: LegacyChartItem) {
  const unit =
    typeof item.course_unit === "string"
      ? Number.parseFloat(item.course_unit)
      : (item.course_unit ?? 0)
  const num = Number.isFinite(unit) && unit >= 0 ? unit : 0
  const asList = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  return {
    name: String(item.course_name ?? "").trim(),
    ...(item.course_code !== undefined && item.course_code !== ""
      ? { code: String(item.course_code) }
      : {}),
    theoreticalUnits: num,
    practicalUnits: 0,
    prerequisites: asList(item.pre_requisites),
    corequisites: asList(item.co_requisites),
  }
}

async function main() {
  const sql = postgres(legacyUrl(), { prepare: false, max: 1, idle_timeout: 5 })

  const universities = await sql`
    select u.id, u.name_fa, u.name_en,
           l.name_fa as loc_fa, l.name_en as loc_en
    from universities u
    left join universities_locations l on l.id = u.location_id
  `
  const majors = await sql`
    select id, university_id, name_fa, name_en from universities_major
  `
  const majorDegrees = await sql`
    select md.id, md.major_id, md.term_count,
           d.name_fa as deg_fa, d.name_en as deg_en
    from universities_major_degree md
    join degrees d on d.id = md.degree_id
  `
  const chartRows = await sql`
    select university_id, major_id, degree_id, entry_year_id,
           entry_year_semester, chart_data
    from universities_chart_course
  `
  const entryYears = await sql`select id, name_en from entry_years`
  const courses = await sql`
    select university_id, major_id, index, course_code, course_name,
           course_type, theoretical_units, practical_units, class_code,
           degree as degree_label, presentation_type, min_capacity,
           max_capacity, current_enrollment, class_schedule, exam_schedule,
           professor, location, is_old, updated_at
    from courses
  `

  await sql.end()

  const { mkdirSync, writeFileSync } = await import("node:fs")
  const { join } = await import("node:path")

  const root = (p: string) => join(REGISTRY_ROOT, p)
  const writeJson = (relPath: string, data: unknown) => {
    const abs = root(relPath)
    mkdirSync(join(abs, ".."), { recursive: true })
    writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
  }

  // ── lookup maps ──
  const majorById = new Map(majors.map((m) => [String(m.id), m]))
  const uniById = new Map(universities.map((u) => [String(u.id), u]))
  const eyNameById = new Map(entryYears.map((e) => [String(e.id), e.name_en]))

  let files = 0

  // ── universities ──
  for (const u of universities) {
    const slug = slugify(u.name_en)
    writeJson(`universities/${slug}/university.json`, {
      slug,
      name: { fa: u.name_fa, en: u.name_en },
      location: { fa: u.loc_fa ?? u.name_fa, en: u.loc_en ?? u.name_en },
    })
    files++
  }

  // ── majors (+degrees) ──
  for (const m of majors) {
    const uni = uniById.get(String(m.university_id))
    if (!uni) continue
    const uniSlug = slugify(uni.name_en)
    const majorSlug = slugify(m.name_en)
    const degrees = majorDegrees
      .filter((md) => String(md.major_id) === String(m.id))
      .map((md) => ({
        slug: slugify(md.deg_en),
        name: { fa: md.deg_fa, en: md.deg_en },
        termCount: md.term_count ?? 8,
      }))
    if (degrees.length === 0) continue

    writeJson(`universities/${uniSlug}/majors/${majorSlug}/major.json`, {
      slug: majorSlug,
      name: { fa: m.name_fa, en: m.name_en },
      degrees,
    })
    files++
  }

  // ── charts ──
  let chartsWritten = 0
  let chartsSkipped = 0
  const seenChartTarget = new Set<string>()

  for (const row of chartRows) {
    const uni = uniById.get(String(row.university_id))
    const major = majorById.get(String(row.major_id))
    if (!uni || !major) continue

    const uniSlug = slugify(uni.name_en)
    const majorSlug = slugify(major.name_en)

    // charts.degree_id references universities_major_degree.id directly.
    const md = majorDegrees.find((x) => String(x.id) === String(row.degree_id))
    if (!md) continue
    const degreeSlug = slugify(md.deg_en)

    const rawEy = eyNameById.get(String(row.entry_year_id)) ?? ""
    const yearNum = entryYearNumber(rawEy)
    if (!yearNum) continue
    const yearDir = String(yearNum)

    const semFile = row.entry_year_semester === "BAHMAN" ? "bahman" : "mehr"

    const targetKey = `${uniSlug}/${majorSlug}/${degreeSlug}/${yearDir}/${semFile}`
    if (seenChartTarget.has(targetKey)) {
      chartsSkipped++
      continue
    }
    seenChartTarget.add(targetKey)

    let legacy: Record<string, unknown>
    try {
      legacy =
        typeof row.chart_data === "string"
          ? JSON.parse(row.chart_data)
          : row.chart_data
    } catch {
      console.warn(`unparseable chart_data (row ${row.id}) - skipped`)
      chartsSkipped++
      continue
    }

    const terms: Record<string, unknown[]> = {}
    for (const [key, value] of Object.entries(legacy)) {
      if (/^[1-9][0-9]*$/.test(key) && Array.isArray(value)) {
        terms[key] = value.map(convertChartCourse)
      }
    }
    const doc = {
      degree: degreeSlug,
      semester: semFile.toUpperCase(),
      terms,
      moaref: Array.isArray(legacy.moaref)
        ? legacy.moaref.map(convertChartCourse)
        : [],
      unknown: Array.isArray(legacy.unknown)
        ? legacy.unknown.map(convertChartCourse)
        : [],
      electives: {},
    }

    writeJson(
      `universities/${uniSlug}/majors/${majorSlug}/charts/${degreeSlug}/${yearDir}/${semFile}.json`,
      doc
    )
    files++
    chartsWritten++
  }

  // ── offerings snapshots ──
  const groups = new Map<string, typeof courses>()
  for (const c of courses) {
    const key = `${c.university_id}:${c.major_id}`
    const list = groups.get(key) ?? []
    list.push(c)
    groups.set(key, list)
  }

  let snapshotFiles = 0
  for (const [key, rows] of groups) {
    const [uniId, majorId] = key.split(":")
    const uni = uniById.get(String(uniId))
    const major = majorById.get(String(majorId))
    if (!uni || !major) continue
    const uniSlug = slugify(uni.name_en)
    const majorSlug = slugify(major.name_en)

    // Term heuristic: dominant exam-date prefix across the group.
    const tally = new Map<string, number>()
    for (const r of rows) {
      const t = termFromExam(r.exam_schedule)
      if (t) {
        const k = `${t.year}/${t.semester}`
        tally.set(k, (tally.get(k) ?? 0) + 1)
      }
    }
    let best: { year: number; semester: "MEHR" | "BAHMAN" | "SUMMER" } = {
      year: 1404,
      semester: "MEHR",
    }
    let bestCount = -1
    for (const [k, count] of tally) {
      if (count > bestCount) {
        const [y, s] = k.split("/")
        best = {
          year: Number.parseInt(y!, 10),
          semester: s as "MEHR" | "BAHMAN" | "SUMMER",
        }
        bestCount = count
      }
    }

    const mapOffering = (r: (typeof rows)[number]) => ({
      index: String(r.index),
      courseCode: String(r.course_code),
      courseName: String(r.course_name),
      ...(r.course_type ? { courseType: r.course_type } : {}),
      theoreticalUnits: Number.parseInt(r.theoretical_units ?? "0", 10) || 0,
      practicalUnits: Number.parseInt(r.practical_units ?? "0", 10) || 0,
      classCode: String(r.class_code),
      degree: String(r.degree_label ?? ""),
      ...(r.presentation_type ? { presentationType: r.presentation_type } : {}),
      ...(r.min_capacity !== null && r.min_capacity !== ""
        ? { minCapacity: Number.parseInt(r.min_capacity, 10) || 0 }
        : {}),
      ...(r.max_capacity !== null && r.max_capacity !== ""
        ? { maxCapacity: Number.parseInt(r.max_capacity, 10) || 0 }
        : {}),
      ...(r.current_enrollment !== null && r.current_enrollment !== ""
        ? { currentEnrollment: Number.parseInt(r.current_enrollment, 10) || 0 }
        : {}),
      classSchedule: [r.class_schedule].filter(
        (s): s is string => typeof s === "string" && s.trim() !== ""
      ),
      examSchedule: r.exam_schedule ?? null,
      ...(r.professor ? { professor: { fa: r.professor } } : {}),
      location: [r.location].filter(
        (s): s is string => typeof s === "string" && s.trim() !== ""
      ),
    })

    const scrapedAt = new Date(
      Math.max(...rows.map((r) => new Date(r.updated_at).getTime()))
    ).toISOString()

    const current = rows.filter((r) => !r.is_old)
    const previous = rows.filter((r) => r.is_old)

    if (current.length > 0) {
      writeJson(
        `universities/${uniSlug}/majors/${majorSlug}/courses/${best.year}/${best.semester.toLowerCase()}/new.json`,
        {
          year: best.year,
          semester: best.semester,
          scrapedAt,
          offerings: current.map(mapOffering),
        }
      )
      files++
      snapshotFiles++
    }
    if (previous.length > 0) {
      writeJson(
        `universities/${uniSlug}/majors/${majorSlug}/courses/${best.year}/${best.semester.toLowerCase()}/old.json`,
        {
          year: best.year,
          semester: best.semester,
          scrapedAt,
          offerings: previous.map(mapOffering),
        }
      )
      files++
    }
  }

  console.log(
    `\n✅ migration done - ${files} files written ` +
      `(universities+majors: ${files - chartsWritten - snapshotFiles}, ` +
      `charts: ${chartsWritten} (skipped ${chartsSkipped}), ` +
      `snapshot groups: ${snapshotFiles})`
  )

  void seenChartTarget
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
