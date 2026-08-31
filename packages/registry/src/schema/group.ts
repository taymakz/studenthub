import { z } from "zod"

import { persianYearSchema } from "./shared"

/** What a Telegram group is for - drives UI grouping and auto-invites. */
export const groupKindSchema = z.enum([
  "MAJOR", // the main group of this major
  "ENTRY_YEAR", // cohort group, e.g. entrants of [1403-1404]
  "COURSE", // per-course help group
])

export type GroupKind = z.infer<typeof groupKindSchema>

/**
 * File: .../majors/<majorSlug>/groups.json
 */
export const telegramGroupSchema = z.object({
  title: z.string().min(1).max(255),
  url: z.url().refine((u) => u.startsWith("https://t.me/"), {
    message: "must be a t.me invite/link",
  }),
  kind: groupKindSchema,
  /** Required when kind = ENTRY_YEAR (e.g. "[1403-1404]" or "1405"). */
  entryYear: z.string().max(16).optional(),
})

export type TelegramGroup = z.infer<typeof telegramGroupSchema>

export const groupsDocSchema = z
  .object({
    $schema: z.string().optional(),
    type: z.literal("groups").optional(),
    groups: z.array(telegramGroupSchema),
  })
  .refine(
    (doc) =>
      doc.groups.every(
        (g) =>
          g.kind !== "ENTRY_YEAR" ||
          (g.entryYear !== undefined &&
            persianYearSchema.safeParse(
              Number(g.entryYear.replace(/[[\]]/g, "").split("-")[0])
            ).success)
      ),
    {
      message:
        "ENTRY_YEAR groups must declare a valid entryYear directory name",
    }
  )

export type GroupsDoc = z.infer<typeof groupsDocSchema>
