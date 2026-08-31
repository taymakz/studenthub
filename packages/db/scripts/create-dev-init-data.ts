import { createHmac } from "node:crypto"

import { config } from "dotenv"

// Works both from the package dir (pnpm scripts) and the repo root.
// apps/api/.env is the source of truth for TELEGRAM_BOT_TOKEN; loaded with
// override because the root .env may declare it empty (dotenv skips empty
// strings without override).
config()
config({ path: "../../.env" })
config({ path: "../../apps/api/.env", override: true })

/**
 * Generates a VALID Telegram initData string for local mini-app development.
 *
 * The API validates initData with HMAC-SHA256 exactly per the official
 * algorithm (apps/api/src/lib/auth/init-data.ts):
 *
 *   secret_key = HMAC_SHA256(bot_token, key="WebAppData")
 *   hash       = hex(HMAC_SHA256(data_check_string, key=secret_key))
 *
 * So signing locally with TELEGRAM_BOT_TOKEN produces a string that passes
 * validation UNCHANGED - no dev bypass in the API. auth_date is now, so the
 * 24h replay window applies: re-run after a day.
 *
 *   pnpm --filter @workspace/db dev:initdata <chatId> [firstName] [lastName]
 *
 * Output is written to apps/mini-app/.env as NEXT_PUBLIC_DEV_INIT_DATA so
 * `pnpm --filter @workspace/mini-app dev` picks it up automatically.
 */

async function main() {
  const chatId = Number.parseInt(process.argv[2] ?? "", 10)
  if (!Number.isSafeInteger(chatId) || chatId <= 0) {
    console.error(
      "Usage: pnpm --filter @workspace/db dev:initdata <chatId> [firstName] [lastName]"
    )
    process.exit(1)
  }
  const firstName = process.argv[3] ?? "DevStudent"
  const lastName = process.argv[4]
  const username = process.argv[5] ?? "devstudent"
  // Optional photo_url (argv[6]). Only included when provided - a fabricated
  // avatar would be "wrong" for a real account and the /me upsert would store
  // it over the user's real Telegram photo.
  const photoUrl = process.argv[6]

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    console.error(
      "TELEGRAM_BOT_TOKEN not set - put it in .env or apps/api/.env first."
    )
    process.exit(1)
  }

  // Auth payload - field order does not matter here (check-string sorts),
  // but keep names/encoding identical to what Telegram sends.
  const userPayload: Record<string, unknown> = {
    id: chatId,
    first_name: firstName,
    username,
    language_code: "fa",
    allows_write_to_pm: true,
  }
  if (lastName) {
    userPayload.last_name = lastName
  }
  if (photoUrl) {
    userPayload.photo_url = photoUrl
  }

  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `AAH${randomHex(16)}`,
    user: JSON.stringify(userPayload),
  })

  // data_check_string: every field except hash/signature, sorted by key,
  // joined by "\n" - byte-exact with the validator.
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex")

  const initData = `${params.toString()}&hash=${hash}`

  console.log("\n✅ Dev initData generated (validates like real Telegram):")
  console.log(
    `   user : ${firstName}${lastName ? " " + lastName : ""} (${chatId})`
  )
  console.log(`   ttl  : 24h (re-run to refresh)\n`)
  console.log(initData)
  console.log()

  // Write apps/mini-app/.env (append or update) so next dev picks it up.
  try {
    const { writeFileSync, readFileSync, existsSync } = await import("node:fs")
    const { join } = await import("node:path")
    const envPath = join(process.cwd(), "..", "..", "apps", "mini-app", ".env")
    const line = `NEXT_PUBLIC_DEV_INIT_DATA=${initData}\n`
    let content = ""
    if (existsSync(envPath)) {
      content = readFileSync(envPath, "utf-8")
      const re = /^NEXT_PUBLIC_DEV_INIT_DATA=.*$/m
      if (re.test(content)) {
        content = content.replace(re, line.trim())
      } else {
        content += `\n${line}`
      }
    } else {
      content = line
    }
    writeFileSync(envPath, content, "utf-8")
    console.log(`📝 Written to apps/mini-app/.env (NEXT_PUBLIC_DEV_INIT_DATA)`)
  } catch {
    console.log(
      "(could not auto-write apps/mini-app/.env - copy the value above manually)"
    )
  }
}

function randomHex(length: number): string {
  const chars = "abcdef0123456789"
  let out = ""
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out.toUpperCase()
}

main()
