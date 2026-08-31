import { and, eq } from "drizzle-orm"
import readline from "node:readline/promises"

import { config } from "dotenv"

// Works both from the package dir (pnpm scripts) and the repo root.
config()
config({ path: "../../.env" })

import { users } from "../src/schema"
import { createSeedClient } from "./seed-utils.js"

/**
 * Promotes an existing user to SUPERADMIN with full permission.
 *
 *   pnpm --filter @workspace/db seed:create-superuser <chatId>
 *
 * Flow: fetch by chat id -> not found = hard error; found = print identity
 * details (telegram username, names, id, photo) -> explicit y/N confirmation
 * -> promote. SUPERADMIN is implicit-all in the API, so any stale
 * `admin_permissions` rows are cleared for a clean slate.
 */

async function main() {
  const chatId = Number.parseInt(process.argv[2] ?? "", 10)
  if (!Number.isSafeInteger(chatId) || chatId <= 0) {
    console.error("Usage: db:create-superuser <chatId>")
    process.exit(1)
  }

  const seed = createSeedClient()
  const db = seed.db

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, chatId))
    .limit(1)

  if (!user) {
    console.error(`❌ کاربری با شناسه ${chatId} پیدا نشد.`)
    console.error(
      "   اول داده‌ها را منتقل کنید (migrate:old-users) یا شناسه را بررسی کنید."
    )
    await seed.close()
    process.exit(1)
  }

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "—"

  console.log("\nکاربر پیدا شد:")
  console.log(`  Chat ID : ${user.id}`)
  console.log(`  نام     : ${displayName}`)
  console.log(
    `  تلگرام  : ${user.telegramUsername ? "@" + user.telegramUsername : "—"}`
  )
  if (user.photoUrl) console.log(`  عکس     : ${user.photoUrl}`)
  console.log(`  نقش فعلی: ${user.role}${user.banned ? " (مسدود)" : ""}`)
  if (user.role === "SUPERADMIN") {
    console.log("\nاین کاربر هم‌اکنون ابرمدیر است - کاری انجام نشد.")
    await seed.close()
    return
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  const answer = (
    await rl.question("\nاین همان کاربر است؟ ارتقا به ابرمدیر (y/N): ")
  )
    .trim()
    .toLowerCase()
  rl.close()

  if (answer !== "y" && answer !== "yes") {
    console.log("لغو شد - هیچ تغییری اعمال نشد.")
    await seed.close()
    return
  }

  await db
    .update(users)
    .set({
      role: "SUPERADMIN",
      banned: false,
      bannedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, chatId))

  console.log(
    `\n✅ ${displayName} (${chatId}) اکنون ابرمدیر با دسترسی کامل است.`
  )
  await seed.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
