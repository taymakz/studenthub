import { sql } from "drizzle-orm"

import {
  feedback,
  notedCourses,
  notificationBatches,
  notificationMessages,
  passedCourses,
  professorVotes,
  universityProfiles,
  uploads,
  users,
  type NewNotificationMessage,
} from "../src/schema"
import {
  chunkArray,
  createSeedClient,
  makeFakeChatId,
  pickFrom,
  randomDateWithinDays,
} from "./seed-utils.js"

/**
 * Wipes and reseeds development data. Chat ids live in the 700,000,000+ range
 * so mock rows are always distinguishable from real Telegram ids.
 *
 * University/major slugs below assume the sample registry tree
 * (`packages/registry/universities/azad-malard/...`) - adjust once real registry data
 * lands.
 */

const FIRST_NAMES = [
  "علی",
  "محمد",
  "رضا",
  "امیرحسین",
  "فاطمه",
  "زهرا",
  "سارا",
  "نگار",
  "مهدی",
  "حسین",
]

const LAST_NAMES = [
  "احمدی",
  "محمدی",
  "کریمی",
  "موسوی",
  "رحیمی",
  "حسینی",
  "قاسمی",
  "صادقی",
]

const UNIS = [
  { universitySlug: "azad-malard", majorSlug: "computer-engineering" },
  { universitySlug: "azad-malard", majorSlug: "electrical-engineering" },
  { universitySlug: "azad-karaj", majorSlug: "computer-engineering" },
] as const

const DEGREES = ["کارشناسی", "کارشناسی ارشد"] as const
const YEAR_RANGES = ["[1403-1404]", "[1402-1403]", "1404"] as const
const SEMESTERS = ["MEHR", "BAHMAN", "SUMMER"] as const

const COURSE_NAMES = [
  "برنامه‌سازی پیشرفته",
  "ساختمان داده‌ها",
  "الگوریتم‌ها",
  "پایگاه داده",
  "سیستم عامل",
  "شبکه‌های کامپیوتری",
  "مهندسی نرم‌افزار",
  "ریزپردازنده",
] as const

const PROFESSORS = [
  "mohseni",
  "taheri-fard",
  "karimi",
  "rabiee",
  "saboori",
] as const

const USER_COUNT = 24

function pickSemester(index: number) {
  return pickFrom(SEMESTERS, index)
}

async function seed() {
  const { db, close } = createSeedClient()

  try {
    console.log("Clearing seeded tables...")
    await db.execute(
      sql`TRUNCATE TABLE ${notificationMessages}, ${notificationBatches}, ${feedback}, ${uploads}, ${professorVotes}, ${notedCourses}, ${passedCourses}, ${universityProfiles}, ${users} RESTART IDENTITY CASCADE`
    )

    // ── Users ────────────────────────────────────────────────────────────
    console.log(`Inserting ${USER_COUNT} users...`)
    const userRows = Array.from({ length: USER_COUNT }, (_, i) => ({
      id: makeFakeChatId(i),
      telegramUsername: `student_${i + 1}`,
      firstName: pickFrom(FIRST_NAMES, i),
      lastName: pickFrom(LAST_NAMES, i),
      languageCode: "fa",
      isPremium: i % 5 === 0,
      allowsWriteToPm: i % 3 !== 0,
      role:
        i === 0
          ? ("SUPERADMIN" as const)
          : i === 1
            ? ("ADMIN" as const)
            : ("USER" as const),
      banned: i === USER_COUNT - 1,
      bannedReason: i === USER_COUNT - 1 ? "اسپم" : null,
      lastOnlineAt: randomDateWithinDays(14, i),
      createdAt: randomDateWithinDays(120, i),
    }))

    for (const chunk of chunkArray(userRows)) {
      await db.insert(users).values(chunk)
    }

    // ── University profiles ──────────────────────────────────────────────
    console.log("Inserting university profiles...")
    await db.insert(universityProfiles).values(
      userRows.slice(2).map((u, i) => {
        const uni = pickFrom(UNIS, i)
        return {
          userId: u.id,
          universitySlug: uni.universitySlug,
          majorSlug: uni.majorSlug,
          degree: pickFrom(DEGREES, i),
          entryYearRange: pickFrom(YEAR_RANGES, i),
          entrySemester: pickSemester(i),
          gender: i % 3 === 0 ? ("FEMALE" as const) : ("MALE" as const),
          termNumber: ((i % 8) + 1) as number,
        }
      })
    )

    // ── Noted + passed courses (for first uni/major only - matches profiles) ──
    console.log("Inserting noted & passed courses...")
    const targetUni = UNIS[0]!
    const profiledUsers = userRows.slice(2)

    await db.insert(notedCourses).values(
      profiledUsers.flatMap((u, i) => {
        if (i % 3 === 0) return []
        return [
          {
            userId: u.id,
            universitySlug: targetUni.universitySlug,
            majorSlug: targetUni.majorSlug,
            courseIndex: String(40_000_000 + i * 137),
          },
        ]
      })
    )

    await db.insert(passedCourses).values(
      profiledUsers.flatMap((u, i) =>
        [0, 1].map((k) => ({
          userId: u.id,
          universitySlug: targetUni.universitySlug,
          majorSlug: targetUni.majorSlug,
          courseName: COURSE_NAMES[(i + k) % COURSE_NAMES.length]!,
          year: String(1400 + (i % 4)),
          semester: pickSemester(i + k),
        }))
      )
    )

    // ── Professor votes ──────────────────────────────────────────────────
    console.log("Inserting professor votes...")
    await db.insert(professorVotes).values(
      profiledUsers.slice(0, 12).map((u, i) => ({
        userId: u.id,
        universitySlug: targetUni.universitySlug,
        majorSlug: targetUni.majorSlug,
        professorSlug: pickFrom(PROFESSORS, i),
        examDifficulty: (i % 5) + 1,
        teachingQuality: ((i + 2) % 5) + 1,
        mastery: ((i + 1) % 5) + 1,
        leniency: ((i + 3) % 5) + 1,
        questionSimilarity: (i % 5) + 1,
        createdAt: randomDateWithinDays(60, i),
      }))
    )

    // ── Notification batch with mixed-status messages ────────────────────
    console.log("Inserting a READY notification batch...")
    const [batch] = await db
      .insert(notificationBatches)
      .values({
        type: "COURSE_CHANGES",
        status: "READY",
        title: "تغییرات دروس ترم مهر ۱۴۰۳ - مهندسی کامپیوتر",
        universitySlug: targetUni.universitySlug,
        majorSlug: targetUni.majorSlug,
        payload: {
          universitySlug: targetUni.universitySlug,
          majorSlug: targetUni.majorSlug,
          semesterFile: "[1403-1404]/mehr.json",
          added: 3,
          removed: 1,
          changed: 5,
        },
        createdById: userRows[1]!.id,
        totalMessages: 6,
        sentCount: 2,
        failedCount: 1,
      })
      .returning()

    if (!batch) {
      throw new Error("Failed to insert notification batch")
    }

    const messageRows: NewNotificationMessage[] = profiledUsers
      .slice(0, 6)
      .map((u, i) => {
        const base = {
          batchId: batch.id,
          userId: u.id,
          chatId: u.id,
          body: [
            `${u.firstName} عزیز 👋`,
            "",
            "📢 لیست دروس بروز شد:",
            "🆕 دروس جدید: ۱ مورد",
            "🔄 تغییر جزئیات: ۲ مورد",
            "",
            "📝 تغییرات در لیست دروس منتخب شما:",
            `- ساختمان داده‌ها: زمان تشکیل کلاس`,
          ].join("\n"),
        }

        if (i < 2) {
          return {
            ...base,
            status: "SENT" as const,
            attempts: 1,
            sentAt: randomDateWithinDays(2, i),
            lastAttemptAt: randomDateWithinDays(2, i),
          }
        }
        if (i === 2) {
          return {
            ...base,
            status: "FAILED" as const,
            attempts: 3,
            lastError: "Forbidden: bot was blocked by the user",
            lastAttemptAt: randomDateWithinDays(1, i),
          }
        }
        return { ...base, status: "PENDING" as const }
      })

    await db.insert(notificationMessages).values(messageRows)

    // ── Uploads (pending archive intake) ─────────────────────────────────
    console.log("Inserting pending uploads...")
    await db.insert(uploads).values([
      {
        userId: profiledUsers[0]!.id,
        kind: "ARCHIVE",
        telegramFileId: "BQACAgIAAx0CAp.kFakeFileId1",
        fileName: "جزوه-ساختمان-داده.pdf",
        mimeType: "application/pdf",
        sizeBytes: 18_036_224,
        title: "جزوه کامل ساختمان داده دکتر محسنی",
        description: "۱۴۰ صفحه، تایپ شده با حل تمرین",
        universitySlug: targetUni.universitySlug,
        majorSlug: targetUni.majorSlug,
      },
      {
        userId: profiledUsers[1]!.id,
        kind: "ARCHIVE",
        status: "APPROVED",
        telegramFileId: "BQACAgIAAx0CAp.kFakeFileId2",
        fileName: "نمونه-سوال-الگوریتم.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2_401_280,
        title: "نمونه سوالات الگوریتم - سه ترم اخیر",
        universitySlug: targetUni.universitySlug,
        majorSlug: targetUni.majorSlug,
      },
      {
        userId: profiledUsers[2]!.id,
        kind: "ARCHIVE",
        status: "REJECTED",
        telegramFileId: "BQACAgIAAx0CAp.kFakeFileId3",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 512_000,
        title: "بی کیفیت",
        universitySlug: targetUni.universitySlug,
        reviewedById: userRows[1]!.id,
        reviewedAt: randomDateWithinDays(5, 1),
      },
    ])

    // ── Feedback ─────────────────────────────────────────────────────────
    console.log("Inserting feedback...")
    await db.insert(feedback).values([
      {
        userId: profiledUsers[0]!.id,
        kind: "BUG",
        message: "صفحه برنامه هفتگی بعد از تغییر ترم خالی می‌شود.",
      },
      {
        userId: profiledUsers[1]!.id,
        kind: "IDEA",
        status: "RESOLVED",
        message: "امکان خروجی اکسل جدول امتحانات هم اضافه شود.",
        resolvedById: userRows[1]!.id,
        resolvedAt: randomDateWithinDays(10, 2),
      },
    ])

    const counts = await db.execute<{ table_name: string; row_count: string }>(
      sql`SELECT 'users' AS table_name, COUNT(*)::text AS row_count FROM ${users}
          UNION ALL SELECT 'university_profiles', COUNT(*)::text FROM ${universityProfiles}
          UNION ALL SELECT 'noted_courses', COUNT(*)::text FROM ${notedCourses}
          UNION ALL SELECT 'passed_courses', COUNT(*)::text FROM ${passedCourses}
          UNION ALL SELECT 'professor_votes', COUNT(*)::text FROM ${professorVotes}
          UNION ALL SELECT 'notification_batches', COUNT(*)::text FROM ${notificationBatches}
          UNION ALL SELECT 'notification_messages', COUNT(*)::text FROM ${notificationMessages}
          UNION ALL SELECT 'uploads', COUNT(*)::text FROM ${uploads}
          UNION ALL SELECT 'feedback', COUNT(*)::text FROM ${feedback}`
    )

    console.log("\n✅ Mock data ready:")
    for (const row of counts) {
      console.log(`   ${row.table_name.padEnd(24)} ${row.row_count}`)
    }
    console.log(
      "\nSuperadmin chat id:",
      userRows[0]!.id,
      "| Admin:",
      userRows[1]!.id
    )
  } catch (error) {
    console.error("\nError seeding mock data:")
    if (error instanceof Error) {
      console.error(error.message)
    } else {
      console.error(error)
    }
    process.exitCode = 1
  } finally {
    await close()
  }
}

void seed()
