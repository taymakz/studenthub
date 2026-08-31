import { sql } from "drizzle-orm"
import postgres from "postgres"
import { readFileSync } from "node:fs"

import { createSeedClient, chunkArray } from "./seed-utils.js"
import { users } from "../src/schema"

/**
 * One-time TEST migration: copies users from the legacy Supabase database
 * (_ignore/studenthub backend) into the new local database. READ-ONLY on the
 * remote side; local inserts are upserts so the script is idempotent.
 *
 *   pnpm --filter @workspace/db migrate:old-users
 *
 * Maps `date_joined` -> createdAt (real signup dates power the dashboard
 * trend) and carries the course-list visibility flags over.
 */

interface LegacyUser {
  id: string | number
  telegram_username: string | null
  first_name: string
  last_name: string | null
  language_code: string | null
  is_premium: boolean
  allows_write_to_pm: boolean
  photo_url: string | null
  date_joined: string | Date
  last_online: string | Date | null
  banned: boolean
  banned_reason: string | null
  visible_in_course_lists: boolean
  visible_in_course_lists_last_updated: string | Date | null
}

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

async function main() {
  const remote = postgres(legacyUrl(), {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  })
  const seed = createSeedClient()
  const db = seed.db

  const legacy: LegacyUser[] = await remote`
    select id, telegram_username, first_name, last_name, language_code,
           is_premium, allows_write_to_pm, photo_url, date_joined,
           last_online, banned, banned_reason,
           visible_in_course_lists, visible_in_course_lists_last_updated
    from users
  `
  console.log(`legacy users fetched: ${legacy.length}`)

  let upserted = 0
  for (const batch of chunkArray(legacy, 500)) {
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
          // Real signup date - powers the dashboard membership trend.
          createdAt: new Date(u.date_joined),
          visibleInCourseLists: u.visible_in_course_lists ?? true,
          visibleInCourseListsLastUpdated:
            u.visible_in_course_lists_last_updated
              ? new Date(u.visible_in_course_lists_last_updated)
              : null,
          banned: u.banned ?? false,
          bannedReason: u.banned_reason || null,
          lastOnlineAt: u.last_online ? new Date(u.last_online) : null,
        }))
      )
      .onConflictDoUpdate({
        target: users.id,
        set: {
          telegramUsername: sqlExcluded("telegram_username"),
          firstName: sqlExcluded("first_name"),
          lastName: sqlExcluded("last_name"),
          photoUrl: sqlExcluded("photo_url"),
          isPremium: sqlExcluded("is_premium"),
          banned: sqlExcluded("banned"),
          bannedReason: sqlExcluded("banned_reason"),
          visibleInCourseLists: sqlExcluded("visible_in_course_lists"),
          visibleInCourseListsLastUpdated: sqlExcluded(
            "visible_in_course_lists_last_updated"
          ),
          lastOnlineAt: sqlExcluded("last_online_at"),
          updatedAt: new Date(),
        },
      })
    upserted += batch.length
    process.stdout.write(`\rupserted ${upserted}/${legacy.length}`)
  }
  console.log("")

  // NOTE: createdAt is intentionally NOT in the conflict update - a user's
  // signup date never changes. Roles are untouched here too (USER default);
  // promotion happens via db:create-superuser <chatId>.

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
  console.log(`done - local users now: ${countRow?.total ?? 0}`)

  await remote.end()
  await seed.close()
}

/** `excluded.<col>` reference for ON CONFLICT DO UPDATE. */
function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
