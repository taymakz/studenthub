import { faker } from "@faker-js/faker"
import { sql } from "drizzle-orm"

import { createSeedClient } from "./seed-utils.js"
import { feedback, users } from "../src/schema"

const KINDS = ["BUG", "SUGGESTION", "THANKS", "SOURCE"] as const
const STATUSES = ["OPEN", "RESOLVED"] as const

const MESSAGES: Record<string, string[]> = {
  BUG: [
    "برنامه در صفحه چارت هنگ می‌کند و بالا نمی‌آید.",
    "هنگام ذخیره دروس انتخابی خطای ۵۰۰ دریافت می‌کنم.",
    "عکس پروفایل تلگرام من نمایش داده نمی‌شود.",
    "نوتیفیکیشن‌ها برای من ارسال نمی‌شود.",
    "در بخش انتخاب واحد ظرفیت دروس اشتباه نمایش داده می‌شود.",
  ],
  SUGGESTION: [
    "کاش امکان جستجو بر اساس نام استاد در چارت وجود داشت.",
    "پیشنهاد می‌کنم فیلتر ترم به صفحه اصلی اضافه شود.",
    "بهتر است امکان خروجی PDF از برنامه ترم وجود داشته باشد.",
    "کاش اعلان‌ها قابلیت بی‌صدا کردن داشتند.",
    "پیشنهاد افزودن تقویم امتحانات به داشبورد.",
  ],
  THANKS: [
    "خیلی ممنون بابت اپلیکیشن عالی‌تون، واقعا کاربردی بود!",
    "از تیم پشتیبانی بابت پاسخگویی سریع تشکر می‌کنم.",
    "چارت تحصیلی خیلی دقیق و به‌روز بود، ممنون.",
    "ممنون بابت اطلاع‌رسانی به‌موقع تغییرات ظرفیت.",
  ],
  SOURCE: [
    "منبع پیشنهادی: جزوه کامل ریاضی عمومی ۲ - دکتر حسینی (PDF)",
    "معرفی منبع: ویدیوهای آموزشی مدار منطقی - کانال یوتیوب فلان",
    "کتاب پیشنهادی: مبانی کامپیوتر - نویسنده فلان، برای ترم ۱ عالیه.",
    "جزوه دست‌نویس فیزیک ۱ - کیفیت عالی، پیشنهاد می‌کنم اضافه کنید.",
  ],
}

async function main() {
  const seed = createSeedClient()
  const db = seed.db

  const allUsers = await db.select({ id: users.id }).from(users).limit(200)
  if (allUsers.length === 0) {
    console.log("no users found")
    await seed.close()
    return
  }

  // Clear existing feedback for clean seed
  await db.delete(feedback)

  const rows: any[] = []
  const now = Date.now()
  for (let i = 0; i < 68; i++) {
    const kind = KINDS[Math.floor(Math.random() * KINDS.length)]!
    const status = Math.random() < 0.7 ? "OPEN" : "RESOLVED"
    const user = allUsers[Math.floor(Math.random() * allUsers.length)]!
    const msgList = MESSAGES[kind]!
    const message =
      msgList[Math.floor(Math.random() * msgList.length)]! + ` #${i + 1}`
    // Random date within last 90 days
    const createdAt = new Date(
      now - Math.floor(Math.random() * 90 * 86_400_000)
    )
    rows.push({
      userId: user.id,
      kind,
      status,
      message,
      attachments: [],
      createdAt,
      updatedAt: createdAt,
      ...(status === "RESOLVED"
        ? {
            resolvedById: allUsers[0]!.id,
            resolvedAt: new Date(createdAt.getTime() + 86_400_000),
          }
        : {}),
    })
  }

  // Insert in chunks
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50)
    await db.insert(feedback).values(chunk)
  }

  const [cnt] = await db
    .select({ v: sql<number>`count(*)::int` })
    .from(feedback)
  console.log(`seeded feedback: ${cnt?.v ?? rows.length}`)

  await seed.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
