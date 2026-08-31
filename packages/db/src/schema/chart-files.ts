import {
  char,
  index,
  pgTable,
  smallint,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

/**
 * Telegram file_id cache for registry chart PDFs.
 *
 * PDFs live IN THE REGISTRY beside their chart JSON
 * (charts/<degree>/<yearDir>/<semester>.pdf) - pure git content. When a user
 * taps «دریافت چارت» we sendDocument the file to their PV: first time uploads
 * the bytes and caches the returned file_id here; later requests reuse it
 * (instant). `contentHash` is the sha256 of the pdf bytes - a new commit
 * changes the hash, which invalidates the cached file_id and forces a fresh
 * upload so users always get the latest version.
 */
export const chartFiles = pgTable(
  "chart_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    universitySlug: varchar("university_slug", { length: 128 }).notNull(),
    majorSlug: varchar("major_slug", { length: 128 }).notNull(),
    degree: varchar("degree", { length: 128 }).notNull(),
    /** Chart directory name: "[1403-1404]" or "1405". */
    yearDir: varchar("year_dir", { length: 16 }).notNull(),
    /** Semester FILE base: mehr | bahman | summer | both. */
    semester: varchar("semester", { length: 16 }).notNull(),

    telegramFileId: varchar("telegram_file_id", { length: 255 }).notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),

    sentCount: smallint("sent_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("chart_files_unique").on(
      table.universitySlug,
      table.majorSlug,
      table.degree,
      table.yearDir,
      table.semester
    ),
    index("chart_files_lookup_idx").on(
      table.universitySlug,
      table.majorSlug,
      table.degree
    ),
  ]
)
