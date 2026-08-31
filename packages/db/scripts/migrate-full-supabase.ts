import postgres from "postgres"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { sql } from "drizzle-orm"

import { createSeedClient, chunkArray } from "./seed-utils.js"
import {
  feedback,
  notedCourses,
  passedCourses,
  professorVotes,
  universityProfiles,
  users,
} from "../src/schema"

const REGISTRY_ROOT = fileURLToPath(
  new URL("../../registry/registry/", import.meta.url)
)

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

function entryYearNumber(nameEn: string): number | null {
  const match = nameEn.match(/\d{3,4}/)
  if (!match) return null
  const n = Number.parseInt(match[0]!, 10)
  return n < 900 ? 1000 + n : n
}

function termFromExam(examSchedule: string | null): {
  year: number
  semester: "MEHR" | "BAHMAN" | "SUMMER"
} | null {
  const match = examSchedule?.match(/(\d{4})\s*\/\s*(\d{1,2})/)
  if (!match) return null
  const year = Number.parseInt(match[1]!, 10)
  const month = Number.parseInt(match[2]!, 10)
  let semester: "MEHR" | "BAHMAN" | "SUMMER"
  if (month >= 9 || month === 1) semester = "MEHR"
  else if (month >= 2 && month <= 5) semester = "BAHMAN"
  else semester = "SUMMER"
  return { year, semester }
}

function convertChartCourse(item: any) {
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
  console.log("Connecting to legacy Supabase (read-only)...")
  const remote = postgres(legacyUrl(), {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    ssl: "require",
  })

  console.log("Connecting to local Postgres...")
  const seed = createSeedClient()
  const db = seed.db

  // ── Fetch all legacy data (read-only) ──
  console.log("Fetching legacy tables...")
  const [
    legacyUsers,
    legacyProfiles,
    legacyUniversities,
    legacyMajors,
    legacyDegrees,
    legacyEntryYears,
    legacyMajorDegrees,
    legacyChartRows,
    legacyCourses,
    legacyProfessors,
    legacyVotes,
    legacyNoted,
    legacyPassed,
    legacyArchives,
    legacyMedias,
    legacyGroups,
    legacyLocations,
  ] = await Promise.all([
    remote`SELECT id, telegram_username, first_name, last_name, language_code, is_premium, allows_write_to_pm, photo_url, date_joined, last_online, banned, banned_reason, visible_in_course_lists, visible_in_course_lists_last_updated, is_superuser, is_staff, email, is_active FROM users`,
    remote`SELECT id, gender, entry_year_semester, term_number, degree_id, entry_year_id, major_id, university_id, user_id FROM universities_user_profile`,
    remote`SELECT id, name_fa, name_en, location_id FROM universities`,
    remote`SELECT id, name_fa, name_en, university_id FROM universities_major`,
    remote`SELECT id, name_fa, name_en FROM degrees`,
    remote`SELECT id, name_fa, name_en FROM entry_years`,
    remote`SELECT id, major_id, degree_id, term_count FROM universities_major_degree`,
    remote`SELECT id, university_id, major_id, degree_id, entry_year_id, entry_year_semester, chart_data FROM universities_chart_course`,
    remote`SELECT id, university_id, major_id, index, course_code, course_name, course_type, theoretical_units, practical_units, class_code, degree, presentation_type, min_capacity, max_capacity, current_enrollment, class_schedule, exam_schedule, professor, location, is_new, is_old, updated_at FROM courses`,
    remote`SELECT id, name, university_id, major_id FROM professors`,
    remote`SELECT id, professor_id, user_id, proficiency, exam_difficulty, leniency, session_intensity, question_similarity, provides_sample_questions, provides_notes, mandatory_attendance, confirmed, created_at FROM professors_vote`,
    remote`SELECT id, course_index, is_deleted, major_id, university_id, user_id FROM users_noted_course`,
    remote`SELECT id, course_name, year, semester, major_id, university_id, user_id FROM users_passed_course`,
    remote`SELECT id, course_name, title, description, shared_in_universities, shared_in_majors, confirmed, priority, major_id, university_id, professor_id, user_id, media_id, created_at FROM archives`,
    remote`SELECT id, file_id, caption, type FROM medias`,
    remote`SELECT id, title, category, group_type, social_platform, link, description, priority, major_id, university_id, shared_in_majors, shared_in_universities FROM community_social_groups`,
    remote`SELECT id, name_fa, name_en FROM universities_locations`,
  ])

  console.log(
    `Fetched: ${legacyUsers.length} users, ${legacyProfiles.length} profiles, ${legacyUniversities.length} universities, ${legacyMajors.length} majors, ${legacyChartRows.length} charts, ${legacyCourses.length} courses, ${legacyProfessors.length} professors, ${legacyNoted.length} noted, ${legacyPassed.length} passed`
  )

  // ── Lookups ──
  const uniById = new Map(legacyUniversities.map((u: any) => [String(u.id), u]))
  const majorById = new Map(legacyMajors.map((m: any) => [String(m.id), m]))
  const degreeById = new Map(legacyDegrees.map((d: any) => [String(d.id), d]))
  const entryYearNameById = new Map(
    legacyEntryYears.map((e: any) => [String(e.id), e.name_en])
  )
  const locById = new Map(legacyLocations.map((l: any) => [String(l.id), l]))
  const mediaById = new Map(legacyMedias.map((m: any) => [String(m.id), m]))

  const uniSlug = (u: any) => slugify(u.name_en)
  const majorSlug = (m: any) => slugify(m.name_en)
  const degreeSlug = (d: any) => slugify(d.name_en)

  // ── Registry FS helpers ──
  const { mkdirSync, writeFileSync, rmSync } = await import("node:fs")
  const { join } = await import("node:path")
  const root = (p: string) => join(REGISTRY_ROOT, p)
  const writeJson = (relPath: string, data: unknown) => {
    const abs = root(relPath)
    mkdirSync(join(abs, ".."), { recursive: true })
    writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
  }

  // Clean registry universities (keep index, but wipe universities)
  try {
    rmSync(join(REGISTRY_ROOT, "universities"), {
      recursive: true,
      force: true,
    })
  } catch {}
  mkdirSync(join(REGISTRY_ROOT, "universities"), { recursive: true })

  let files = 0

  // ── Universities ──
  for (const u of legacyUniversities) {
    const slug = uniSlug(u)
    const loc = locById.get(String(u.location_id))
    writeJson(`universities/${slug}/university.json`, {
      slug,
      name: { fa: u.name_fa, en: u.name_en },
      location: {
        fa: loc?.name_fa ?? u.name_fa,
        en: loc?.name_en ?? u.name_en,
      },
    })
    files++
  }

  // ── Majors ──
  for (const m of legacyMajors) {
    const uni = uniById.get(String(m.university_id))
    if (!uni) continue
    const uSlug = uniSlug(uni)
    const mSlug = majorSlug(m)
    const degrees = legacyMajorDegrees
      .filter((md: any) => String(md.major_id) === String(m.id))
      .map((md: any) => {
        const d = degreeById.get(String(md.degree_id))
        if (!d) return null
        return {
          slug: degreeSlug(d),
          name: { fa: d.name_fa, en: d.name_en },
          termCount: md.term_count ?? 8,
        }
      })
      .filter(Boolean)
    if (degrees.length === 0) continue
    writeJson(`universities/${uSlug}/majors/${mSlug}/major.json`, {
      slug: mSlug,
      name: { fa: m.name_fa, en: m.name_en },
      degrees,
    })
    files++
  }

  // ── Charts ──
  let chartsWritten = 0
  let chartsSkipped = 0
  const seenChartTarget = new Set<string>()
  for (const row of legacyChartRows) {
    const uni = uniById.get(String(row.university_id))
    const major = majorById.get(String(row.major_id))
    if (!uni || !major) {
      chartsSkipped++
      continue
    }
    const uSlug = uniSlug(uni)
    const mSlug = majorSlug(major)
    const md = legacyMajorDegrees.find(
      (x: any) => String(x.id) === String(row.degree_id)
    )
    if (!md) {
      chartsSkipped++
      continue
    }
    const deg = degreeById.get(String(md.degree_id))
    if (!deg) {
      chartsSkipped++
      continue
    }
    const dSlug = degreeSlug(deg)
    const rawEy = entryYearNameById.get(String(row.entry_year_id)) ?? ""
    const yearNum = entryYearNumber(rawEy)
    if (!yearNum) {
      chartsSkipped++
      continue
    }
    const yearDir = String(yearNum)
    const semFile =
      row.entry_year_semester === "BAHMAN"
        ? "bahman"
        : row.entry_year_semester === "SUMMER"
          ? "summer"
          : "mehr"
    const targetKey = `${uSlug}/${mSlug}/${dSlug}/${yearDir}/${semFile}`
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
      chartsSkipped++
      continue
    }
    const terms: Record<string, unknown[]> = {}
    for (const [key, value] of Object.entries(legacy)) {
      if (/^[1-9][0-9]*$/.test(key) && Array.isArray(value)) {
        terms[key] = (value as any[]).map(convertChartCourse)
      }
    }
    const doc = {
      degree: dSlug,
      semester: semFile.toUpperCase(),
      terms,
      moaref: Array.isArray((legacy as any).moaref)
        ? (legacy as any).moaref.map(convertChartCourse)
        : [],
      unknown: Array.isArray((legacy as any).unknown)
        ? (legacy as any).unknown.map(convertChartCourse)
        : [],
      electives: {},
    }
    writeJson(
      `universities/${uSlug}/majors/${mSlug}/charts/${dSlug}/${yearDir}/${semFile}.json`,
      doc
    )
    files++
    chartsWritten++
  }

  // ── Courses snapshots ──
  const groups = new Map<string, any[]>()
  for (const c of legacyCourses) {
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
    const uSlug = uniSlug(uni)
    const mSlug = majorSlug(major)
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
        best = { year: Number.parseInt(y!, 10), semester: s as any }
        bestCount = count
      }
    }
    const mapOffering = (r: any) => ({
      index: String(r.index),
      courseCode: String(r.course_code),
      courseName: String(r.course_name),
      ...(r.course_type ? { courseType: r.course_type } : {}),
      theoreticalUnits: Number.parseInt(r.theoretical_units ?? "0", 10) || 0,
      practicalUnits: Number.parseInt(r.practical_units ?? "0", 10) || 0,
      classCode: String(r.class_code),
      degree: String(r.degree ?? ""),
      ...(r.presentation_type ? { presentationType: r.presentation_type } : {}),
      ...(r.min_capacity
        ? { minCapacity: Number.parseInt(r.min_capacity, 10) || 0 }
        : {}),
      ...(r.max_capacity
        ? { maxCapacity: Number.parseInt(r.max_capacity, 10) || 0 }
        : {}),
      ...(r.current_enrollment
        ? { currentEnrollment: Number.parseInt(r.current_enrollment, 10) || 0 }
        : {}),
      classSchedule: r.class_schedule ?? null,
      examSchedule: r.exam_schedule ?? null,
      ...(r.professor ? { professor: { fa: r.professor } } : {}),
      location: r.location || null,
    })
    const scrapedAt = new Date(
      Math.max(...rows.map((r: any) => new Date(r.updated_at).getTime()))
    ).toISOString()
    const current = rows.filter((r: any) => !r.is_old)
    const previous = rows.filter((r: any) => r.is_old)
    if (current.length > 0) {
      writeJson(
        `universities/${uSlug}/majors/${mSlug}/courses/${best.year}/${best.semester.toLowerCase()}/new.json`,
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
        `universities/${uSlug}/majors/${mSlug}/courses/${best.year}/${best.semester.toLowerCase()}/old.json`,
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

  // ── Professors ──
  const profGroups = new Map<string, any[]>()
  for (const p of legacyProfessors) {
    const key = `${p.university_id}:${p.major_id}`
    const list = profGroups.get(key) ?? []
    list.push(p)
    profGroups.set(key, list)
  }
  let profFiles = 0
  for (const [key, rows] of profGroups) {
    const [uniId, majorId] = key.split(":")
    const uni = uniById.get(String(uniId))
    const major = majorById.get(String(majorId))
    if (!uni || !major) continue
    const uSlug = uniSlug(uni)
    const mSlug = majorSlug(major)
    const professors = rows.map((r: any) => {
      let s = slugify(r.name)
      if (!s || s.length < 2) s = `prof-${r.id}`
      // Ensure slug is valid kebab-case and not duplicate within this major
      return {
        slug: s,
        name: { fa: r.name, en: r.name },
        sharedInMajors: Boolean(r.shared_in_majors),
        ...(r.specialization ? { department: r.specialization } : {}),
      }
    })
    // Deduplicate slugs within this file
    const seen = new Set<string>()
    const deduped = professors.filter((p) => {
      if (seen.has(p.slug)) return false
      seen.add(p.slug)
      return true
    })
    writeJson(`universities/${uSlug}/majors/${mSlug}/professors.json`, {
      professors: deduped,
    })
    files++
    profFiles++
  }

  // ── Archives ──
  const archGroups = new Map<string, any[]>()
  for (const a of legacyArchives) {
    const key = `${a.university_id}:${a.major_id}`
    const list = archGroups.get(key) ?? []
    list.push(a)
    archGroups.set(key, list)
  }
  for (const [key, rows] of archGroups) {
    const [uniId, majorId] = key.split(":")
    const uni = uniById.get(String(uniId))
    const major = majorById.get(String(majorId))
    if (!uni || !major) continue
    const uSlug = uniSlug(uni)
    const mSlug = majorSlug(major)
    const items = rows
      .map((r: any) => {
        const media = mediaById.get(String(r.media_id))
        if (!media?.file_id) return null
        let slug = slugify(r.title)
        if (!slug || slug.length < 2) slug = `archive-${r.id}`
        // fileName from caption or title
        const rawName = media.caption || r.title || `archive-${r.id}`
        const fileName =
          String(rawName).replace(/[^a-zA-Z0-9\u0600-\u06FF._-]/g, "_") +
          (media.type === "DOCUMENT" ? ".pdf" : "")
        const mimeType =
          media.type === "DOCUMENT"
            ? "application/pdf"
            : media.type === "PHOTO"
              ? "image/jpeg"
              : "application/octet-stream"
        return {
          slug,
          title: r.title,
          ...(r.description ? { description: r.description } : {}),
          ...(r.course_name ? { courseName: r.course_name } : {}),
          fileId: media.file_id,
          fileName,
          mimeType,
          sizeBytes: Number(media.size) || 0,
          uploadedByChatId: Number(r.user_id),
          addedAt: new Date(r.created_at).toISOString(),
        }
      })
      .filter(Boolean)
    if (items.length === 0) continue
    writeJson(`universities/${uSlug}/majors/${mSlug}/archives.json`, {
      items,
    })
    files++
  }

  // ── Groups ──
  const groupGroups = new Map<string, any[]>()
  for (const g of legacyGroups) {
    const key = `${g.university_id}:${g.major_id ?? "null"}`
    const list = groupGroups.get(key) ?? []
    list.push(g)
    groupGroups.set(key, list)
  }
  for (const [key, rows] of groupGroups) {
    const [uniId, majorId] = key.split(":")
    const uni = uniById.get(String(uniId))
    if (!uni) continue
    const uSlug = uniSlug(uni)
    const major = majorId !== "null" ? majorById.get(String(majorId)) : null
    const mSlug = major ? majorSlug(major) : null
    const base = mSlug
      ? `universities/${uSlug}/majors/${mSlug}/groups.json`
      : `universities/${uSlug}/groups.json`
    const groups = rows.map((r: any) => {
      // Map old category/group_type to new kind
      let kind: "MAJOR" | "ENTRY_YEAR" | "COURSE" = "MAJOR"
      const cat = String(r.category || "").toUpperCase()
      if (cat.includes("COURSE") || r.group_type === "COURSE") kind = "COURSE"
      else if (cat.includes("ENTRY") || r.title.includes("ورودی"))
        kind = "ENTRY_YEAR"
      // Ensure url is https://t.me/...
      let url = r.link || "https://t.me/itmalard"
      if (!url.startsWith("https://t.me/")) {
        // Try to make it valid, fallback
        url = "https://t.me/itmalard"
      }
      return {
        title: r.title,
        url,
        kind,
        ...(kind === "ENTRY_YEAR" ? { entryYear: "1403" } : {}),
      }
    })
    writeJson(base, { groups })
    files++
  }

  console.log(
    `Registry files written: ${files} (charts ${chartsWritten} skipped ${chartsSkipped}, snapshots ${snapshotFiles}, profs ${profFiles})`
  )

  // ── Build index ──
  console.log("Building registry index...")
  const { execSync } = await import("node:child_process")
  execSync("pnpm --filter @workspace/registry build-index", {
    stdio: "inherit",
  })

  // ── Migrate users to local Postgres ──
  console.log(`Migrating ${legacyUsers.length} users to local DB...`)
  // Roles: is_superuser -> SUPERADMIN, is_staff -> ADMIN, else USER. Preserve banned.
  let inserted = 0
  for (const batch of chunkArray(legacyUsers, 500)) {
    const values = batch.map((u: any) => {
      let role: "USER" | "ADMIN" | "SUPERADMIN" | "NOTIFICATIONER" = "USER"
      if (u.is_superuser) role = "SUPERADMIN"
      else if (u.is_staff) role = "ADMIN"
      return {
        id: Number(u.id),
        telegramUsername: u.telegram_username || null,
        firstName: u.first_name || "",
        lastName: u.last_name || null,
        languageCode: u.language_code || null,
        photoUrl: u.photo_url || null,
        isPremium: u.is_premium ?? false,
        allowsWriteToPm: u.allows_write_to_pm ?? false,
        role,
        isContributor: false,
        visibleInCourseLists: u.visible_in_course_lists ?? true,
        visibleInCourseListsLastUpdated: u.visible_in_course_lists_last_updated
          ? new Date(u.visible_in_course_lists_last_updated)
          : null,
        banned: u.banned ?? false,
        bannedReason: u.banned_reason || null,
        lastOnlineAt: u.last_online ? new Date(u.last_online) : null,
        createdAt: new Date(u.date_joined),
        updatedAt: new Date(),
      }
    })
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          telegramUsername: sql`excluded.telegram_username`,
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          photoUrl: sql`excluded.photo_url`,
          role: sql`excluded.role`,
          banned: sql`excluded.banned`,
          bannedReason: sql`excluded.banned_reason`,
          lastOnlineAt: sql`excluded.last_online_at`,
          updatedAt: new Date(),
        },
      })
    inserted += batch.length
    process.stdout.write(`\r users ${inserted}/${legacyUsers.length}`)
  }
  console.log("")

  // ── University profiles ──
  console.log(`Migrating ${legacyProfiles.length} university profiles...`)
  // Build slug maps for university/major/degree/entryYear
  const degreeSlugByLegacyId = new Map<string, string>()
  for (const d of legacyDegrees) {
    degreeSlugByLegacyId.set(String(d.id), slugify((d as any).name_en))
  }
  // For entryYearRange, we need to map entry_year_id to representative year string; use entryYearNumber and make "[year]" or handle 400 case
  const entryYearRangeById = new Map<string, string>()
  for (const e of legacyEntryYears) {
    const n = entryYearNumber(e.name_en)
    if (!n) continue
    // Use single year dir for simplicity; original migrate uses yearDir logic
    entryYearRangeById.set(String(e.id), String(n))
  }

  let profInserted = 0
  for (const batch of chunkArray(legacyProfiles, 500)) {
    const values = batch
      .filter(
        (p: any) =>
          p.university_id ||
          p.major_id ||
          p.degree_id ||
          p.entry_year_id ||
          p.gender ||
          p.term_number
      )
      .map((p: any) => {
        const uni = uniById.get(String(p.university_id))
        const major = majorById.get(String(p.major_id))
        const uSlug = uni ? uniSlug(uni) : null
        const mSlug = major ? majorSlug(major) : null
        const deg = p.degree_id
          ? (degreeSlugByLegacyId.get(String(p.degree_id)) ?? null)
          : null
        const eyRange = p.entry_year_id
          ? (entryYearRangeById.get(String(p.entry_year_id)) ?? null)
          : null
        const entrySem = p.entry_year_semester
          ? p.entry_year_semester.toUpperCase()
          : null
        const gender = p.gender ? p.gender.toUpperCase() : null
        const validGender =
          gender === "MALE" || gender === "FEMALE" ? gender : null
        const validSem =
          entrySem === "MEHR" || entrySem === "BAHMAN" || entrySem === "SUMMER"
            ? entrySem
            : null
        return {
          userId: Number(p.user_id),
          universitySlug: uSlug,
          majorSlug: mSlug,
          degree: deg,
          entryYearRange: eyRange,
          entrySemester: validSem as any,
          gender: validGender as any,
          termNumber: p.term_number ?? null,
        }
      })
      .filter((v: any) => v.userId)
    if (values.length === 0) continue
    await db
      .insert(universityProfiles)
      .values(values as any)
      .onConflictDoUpdate({
        target: universityProfiles.userId,
        set: {
          universitySlug: sql`excluded.university_slug`,
          majorSlug: sql`excluded.major_slug`,
          degree: sql`excluded.degree`,
          entryYearRange: sql`excluded.entry_year_range`,
          entrySemester: sql`excluded.entry_semester`,
          gender: sql`excluded.gender`,
          termNumber: sql`excluded.term_number`,
          updatedAt: new Date(),
        },
      })
    profInserted += values.length
  }
  console.log(` university profiles inserted: ${profInserted}`)

  // ── Noted courses ──
  console.log(`Migrating ${legacyNoted.length} noted courses...`)
  let notedInserted = 0
  for (const batch of chunkArray(legacyNoted, 500)) {
    const values = batch.map((r: any) => {
      const uni = uniById.get(String(r.university_id))
      const major = majorById.get(String(r.major_id))
      return {
        userId: Number(r.user_id),
        universitySlug: uni ? uniSlug(uni) : "unknown",
        majorSlug: major ? majorSlug(major) : "unknown",
        courseIndex: String(r.course_index),
        isDeleted: r.is_deleted ?? false,
      }
    })
    await db
      .insert(notedCourses)
      .values(values as any)
      .onConflictDoNothing()
    notedInserted += values.length
  }
  console.log(` noted inserted: ${notedInserted}`)

  // ── Passed courses ──
  console.log(`Migrating ${legacyPassed.length} passed courses...`)
  function normalizePassedYear(raw: string): string {
    if (!raw) return "400"
    // Extract first 3-4 digit number
    const m = String(raw).match(/\d{3,4}/)
    if (m) {
      const n = m[0]
      // Map "400" and "1400" etc. Keep as extracted
      return n
    }
    return String(raw).slice(0, 8)
  }
  let passedInserted = 0
  for (const batch of chunkArray(legacyPassed, 500)) {
    const values = batch.map((r: any) => {
      const uni = uniById.get(String(r.university_id))
      const major = majorById.get(String(r.major_id))
      const sem = r.semester ? r.semester.toUpperCase() : "MEHR"
      const validSem =
        sem === "MEHR" || sem === "BAHMAN" || sem === "SUMMER" ? sem : "MEHR"
      return {
        userId: Number(r.user_id),
        universitySlug: uni ? uniSlug(uni) : "unknown",
        majorSlug: major ? majorSlug(major) : "unknown",
        courseName: r.course_name,
        year: normalizePassedYear(String(r.year)),
        semester: validSem as any,
      }
    })
    await db
      .insert(passedCourses)
      .values(values as any)
      .onConflictDoNothing()
    passedInserted += values.length
  }
  console.log(` passed inserted: ${passedInserted}`)

  // ── Professor votes ──
  console.log(`Migrating ${legacyVotes.length} professor votes...`)
  // Need professor id -> university/major slug mapping
  const profByLegacyId = new Map(
    legacyProfessors.map((p: any) => [String(p.id), p])
  )
  let votesInserted = 0
  for (const batch of chunkArray(legacyVotes, 500)) {
    const values = batch.map((v: any) => {
      const prof = profByLegacyId.get(String(v.professor_id))
      const uni = prof ? uniById.get(String(prof.university_id)) : null
      const major = prof ? majorById.get(String(prof.major_id)) : null
      const toScore = (val: any): number => {
        const n = Number(val)
        if (!Number.isFinite(n) || n < 1) return 3
        if (n > 5) return 5
        return Math.round(n)
      }
      return {
        userId: Number(v.user_id),
        universitySlug: uni ? uniSlug(uni) : "unknown",
        majorSlug: major ? majorSlug(major) : "unknown",
        professorSlug: prof ? slugify(prof.name) : String(v.professor_id),
        examDifficulty: toScore(v.exam_difficulty),
        teachingQuality: toScore(v.session_intensity ?? v.proficiency),
        mastery: toScore(v.proficiency),
        leniency: toScore(v.leniency),
        questionSimilarity: toScore(v.question_similarity),
        comment: null,
        createdAt: v.created_at ? new Date(v.created_at) : new Date(),
      }
    })
    // Use onConflictDoNothing to avoid duplicates
    await db
      .insert(professorVotes)
      .values(values as any)
      .onConflictDoNothing()
    votesInserted += values.length
  }
  console.log(` votes inserted: ${votesInserted}`)

  // ── Feedback (if any) ──
  try {
    const bugReports =
      await remote`SELECT id, user_id, title, description, status FROM feedback_bug_reports`
    const suggestions =
      await remote`SELECT id, user_id, title, description, status FROM feedback_suggestions`
    console.log(
      ` feedback: ${bugReports.length} bugs, ${suggestions.length} suggestions`
    )
    // Map to new feedback table (kind: BUG/SUGGESTION)
    const feedbackRows = [
      ...bugReports.map((r: any) => ({
        userId: Number(r.user_id),
        kind: "BUG" as const,
        message: `${r.title}\n${r.description}`,
        status: r.status === "RESOLVED" ? "RESOLVED" : "OPEN",
        createdAt: new Date(),
      })),
      ...suggestions.map((r: any) => ({
        userId: Number(r.user_id),
        kind: "SUGGESTION" as const,
        message: `${r.title}\n${r.description}`,
        status: r.status === "RESOLVED" ? "RESOLVED" : "OPEN",
        createdAt: new Date(),
      })),
    ]
    for (const batch of chunkArray(feedbackRows, 500)) {
      if (batch.length === 0) continue
      await db
        .insert(feedback)
        .values(batch as any)
        .onConflictDoNothing()
    }
    console.log(` feedback inserted: ${feedbackRows.length}`)
  } catch (e) {
    console.log(
      " feedback migration skipped:",
      (e as Error).message.slice(0, 200)
    )
  }

  await remote.end()
  await seed.close()

  console.log("\n✅ Full migration done")
  console.log(` - users: ${inserted}`)
  console.log(` - registry files: ${files}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
