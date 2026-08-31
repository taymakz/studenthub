import { z } from "zod"

/** Bilingual label. Persian is required, English optional. */
export const localizedTextSchema = z.object({
  fa: z.string().min(1).max(255),
  en: z.string().min(1).max(255).optional(),
})

export type LocalizedText = z.infer<typeof localizedTextSchema>

/** The semester a chart/offering belongs to - matches the JSON file name. */
export const semesterSchema = z.enum(["MEHR", "BAHMAN", "SUMMER"])

export type Semester = z.infer<typeof semesterSchema>

/**
 * Persian academic year, e.g. 1403. Kept as a constrained integer (not a
 * string) so sorting/comparison never depends on locale formatting.
 */
export const persianYearSchema = z.number().int().min(1300).max(1500)

/** Stable identifier used in folder names, DB rows and URLs. */
export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "slugs must be lowercase kebab-case (a-z, 0-9, dashes)"
  )

/** Telegram message/file identifiers are numeric strings of arbitrary length. */
export const telegramFileIdSchema = z.string().min(10).max(255)
