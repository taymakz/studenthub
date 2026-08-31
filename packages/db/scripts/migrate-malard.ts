import { sql } from "drizzle-orm"
import postgres from "postgres"
import { readFileSync } from "node:fs"
import { createSeedClient, chunkArray } from "./seed-utils.js"
import {
  users,
  universityProfiles,
  notedCourses,
  passedCourses,
  professorVotes,
} from "../src/schema/index.js"

const SUPERADMIN_ID = 5725800953

function legacyUrl(): string {
  const envPath = new URL(
    "../../../_ignore/studenthub/src/backend/.env",
    import.meta.url
  )
  const env = readFileSync(envPath, "utf8")
  const line = env.split("\n").find((l) => l.startsWith("DB_URL="))
  if (!line) throw new Error("DB_URL not found")
  return line.slice("DB_URL=".length).trim()
}

function entryYearToRange(junctionId: number | null): string | null {
  if (junctionId === null) return null
  // Junction ids for Malard Computer: 9->400,10->401,11->402,12->403,16->404
  // Map per user instruction: 400/401 => [1400-1401], 402 => 1402, 403+ => [1403-1405]
  if (junctionId === 9 || junctionId === 10) return "[1400-1401]"
  if (junctionId === 11) return "1402"
  return "[1403-1405]"
}

function slugifyPersian(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `prof-${Math.random().toString(36).slice(2, 6)}`
  )
}

async function main() {
  const remote = postgres(legacyUrl(), {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  })
  const seed = createSeedClient()
  const db = seed.db

  console.log("Fetching legacy users...")
  const legacyUsers: any[] = await remote`
    select id, telegram_username, first_name, last_name, language_code,
           is_premium, allows_write_to_pm, photo_url, date_joined,
           last_online, visible_in_course_lists, visible_in_course_lists_last_updated
    from users
  `
  console.log(`users fetched: ${legacyUsers.length}`)

  console.log("Upserting users (banned=false, role mapping)...")
  let upsertedUsers = 0
  for (const batch of chunkArray(legacyUsers, 500)) {
    await db
      .insert(users)
      .values(
        batch.map((u) => ({
          id: Number(u.id),
          telegramUsername: u.telegram_username || null,
          firstName: u.first_name || "",
          lastName: u.last_name || null,
          languageCode: u.language_code || null,
          photoUrl: u.photo_url || null,
          isPremium: u.is_premium ?? false,
          allowsWriteToPm: u.allows_write_to_pm ?? false,
          role:
            Number(u.id) === SUPERADMIN_ID
              ? ("SUPERADMIN" as const)
              : ("USER" as const),
          banned: false,
          bannedReason: null,
          visibleInCourseLists: u.visible_in_course_lists ?? true,
          visibleInCourseListsLastUpdated:
            u.visible_in_course_lists_last_updated
              ? new Date(u.visible_in_course_lists_last_updated)
              : null,
          lastOnlineAt: u.last_online ? new Date(u.last_online) : null,
          createdAt: new Date(u.date_joined),
          updatedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: users.id,
        set: {
          telegramUsername: sql`excluded.telegram_username`,
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          languageCode: sql`excluded.language_code`,
          photoUrl: sql`excluded.photo_url`,
          isPremium: sql`excluded.is_premium`,
          allowsWriteToPm: sql`excluded.allows_write_to_pm`,
          role: sql`excluded.role`,
          banned: sql`excluded.banned`,
          bannedReason: sql`excluded.banned_reason`,
          visibleInCourseLists: sql`excluded.visible_in_course_lists`,
          visibleInCourseListsLastUpdated: sql`excluded.visible_in_course_lists_last_updated`,
          lastOnlineAt: sql`excluded.last_online_at`,
          updatedAt: new Date(),
        },
      })
    upsertedUsers += batch.length
    process.stdout.write(`\rusers ${upsertedUsers}/${legacyUsers.length}`)
  }
  console.log("")

  console.log("Fetching legacy profiles (uni=1 major=1 only)...")
  const legacyProfiles: any[] = await remote`
    select user_id, university_id, major_id, degree_id, entry_year_id, entry_year_semester, gender, term_number
    from universities_user_profile
    where university_id=1 and major_id=1
  `
  console.log(
    `profiles 1/1 fetched: ${legacyProfiles.length} (other  ${legacyUsers.length - legacyProfiles.length} will have no profile -> goes to setup)`
  )

  // Clear existing profiles first (in case of re-run)
  await db.delete(universityProfiles)
  console.log(
    "Inserting 291 filtered profiles -> azad-malard/computer-engineering/bachelors-degree ..."
  )
  let pCount = 0
  for (const batch of chunkArray(legacyProfiles, 300)) {
    await db
      .insert(universityProfiles)
      .values(
        batch.map((p) => ({
          userId: Number(p.user_id),
          universitySlug: "azad-malard",
          majorSlug: "computer-engineering",
          degree: "bachelors-degree",
          entryYearRange: entryYearToRange(p.entry_year_id),
          entrySemester: p.entry_year_semester as "MEHR" | "BAHMAN" | null,
          gender: p.gender as "MALE" | "FEMALE" | null,
          termNumber: p.term_number ? Number(p.term_number) : null,
          currentSemesterCode: "4051",
          isLastTerm: false,
        }))
      )
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
          currentSemesterCode: sql`excluded.current_semester_code`,
          isLastTerm: sql`excluded.is_last_term`,
          updatedAt: new Date(),
        },
      })
    pCount += batch.length
    process.stdout.write(`\rprofiles ${pCount}/${legacyProfiles.length}`)
  }
  console.log("")

  console.log("Fetching noted 1/1 (330)...")
  const legacyNoted: any[] = await remote`
    select user_id, university_id, major_id, course_index, is_deleted
    from users_noted_course where university_id=1 and major_id=1
  `
  console.log(`noted fetched: ${legacyNoted.length}`)
  await db.delete(notedCourses)
  for (const batch of chunkArray(legacyNoted, 400)) {
    await db
      .insert(notedCourses)
      .values(
        batch.map((n) => ({
          userId: Number(n.user_id),
          universitySlug: "azad-malard",
          majorSlug: "computer-engineering",
          entryYearRange: null,
          entrySemester: null,
          courseIndex: String(n.course_index),
          year: null,
          semester: null,
          isDeleted: n.is_deleted ?? false,
        }))
      )
      .onConflictDoNothing()
  }
  console.log("noted inserted")

  console.log("Fetching passed 1/1 (5800)...")
  const legacyPassed: any[] = await remote`
    select user_id, university_id, major_id, course_name, year, semester
    from users_passed_course where university_id=1 and major_id=1
  `
  console.log(`passed fetched: ${legacyPassed.length}`)
  // Normalize year: old has "400 و ما قبل" (length >8) -> extract digits and map 400->1400
  const normalizeYear = (y: unknown): string | null => {
    if (!y) return null
    const s = String(y).trim()
    if (!s) return null
    const m = s.match(/\d+/)
    if (!m) return null
    let n = Number(m[0])
    if (n < 1000) n = 1000 + n // 400 -> 1400, 401 -> 1401
    return String(n).slice(0, 8)
  }
  await db.delete(passedCourses)
  for (const batch of chunkArray(legacyPassed, 500)) {
    await db
      .insert(passedCourses)
      .values(
        batch.map((r) => ({
          userId: Number(r.user_id),
          universitySlug: "azad-malard",
          majorSlug: "computer-engineering",
          courseName: String(r.course_name),
          year: normalizeYear(r.year),
          semester: r.semester
            ? String(r.semester).toUpperCase().slice(0, 8)
            : null,
        }))
      )
      .onConflictDoNothing()
  }
  console.log("passed inserted")

  console.log("Fetching professor votes for Malard Computer (98)...")
  const legacyVotes: any[] = await remote`
    select pv.id, pv.proficiency, pv.exam_difficulty, pv.leniency, pv.session_intensity, pv.question_similarity,
           pv.provides_sample_questions, pv.provides_notes, pv.mandatory_attendance, pv.user_id, p.name as prof_name, p.university_id, p.major_id
    from professors_vote pv
    join professors p on p.id = pv.professor_id
    where p.university_id=1 and p.major_id=1
  `
  console.log(`votes fetched: ${legacyVotes.length}`)
  await db.delete(professorVotes)
  for (const batch of chunkArray(legacyVotes, 200)) {
    await db
      .insert(professorVotes)
      .values(
        batch.map((v) => ({
          userId: Number(v.user_id),
          universitySlug: "azad-malard",
          majorSlug: "computer-engineering",
          professorSlug: slugifyPersian(String(v.prof_name)),
          examDifficulty: Number(v.exam_difficulty) || 3,
          teachingQuality: Number(v.session_intensity) || 3,
          mastery: Number(v.proficiency) || 3,
          leniency: Number(v.leniency) || 3,
          questionSimilarity: Number(v.question_similarity) || 3,
          providesSampleQuestions: v.provides_sample_questions ?? false,
          providesNotes: v.provides_notes ?? false,
          mandatoryAttendance: v.mandatory_attendance ?? false,
          comment: null,
        }))
      )
      .onConflictDoUpdate({
        target: [professorVotes.userId, professorVotes.professorSlug],
        set: {
          examDifficulty: sql`excluded.exam_difficulty`,
          teachingQuality: sql`excluded.teaching_quality`,
          mastery: sql`excluded.mastery`,
          leniency: sql`excluded.leniency`,
          questionSimilarity: sql`excluded.question_similarity`,
          updatedAt: new Date(),
        },
      })
  }
  console.log("votes inserted")

  const [uCnt] = await db.select({ c: sql<number>`count(*)::int` }).from(users)
  const [pCnt] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(universityProfiles)
  const [nCnt] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(notedCourses)
  const [paCnt] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(passedCourses)
  const [vCnt] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(professorVotes)
  console.log(
    `✅ Done local: users=${uCnt.c} profiles=${pCnt.c} noted=${nCnt.c} passed=${paCnt.c} votes=${vCnt.c}`
  )

  await remote.end()
  await seed.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
