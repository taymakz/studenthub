import { z } from "zod"

import { localizedTextSchema, slugSchema } from "./shared"

/**
 * Institution type - drives the slug prefix AND the logo shown on university
 * cards in the mini app. Each type maps to a logo in `@persianlabs/icons`
 * (mono set):
 *
 *   azad → UniversityAzadMono      (دانشگاه آزاد اسلامی)
 *   gov  → UniversityTehranMono    (دولتی - placeholder mark)
 *   pnu  → UniversityPayamnoorMono (پیام نور)
 *
 * Adding a NEW type requires: a documented slug prefix here, an existing logo
 * in @persianlabs/icons (PR the icon there first if missing), and an entry in
 * the mini app's UniversityTypeIcon map.
 */
export const UNIVERSITY_TYPES = ["azad", "gov", "pnu"] as const
export const universityTypeSchema = z.enum(UNIVERSITY_TYPES)
export type UniversityType = z.infer<typeof universityTypeSchema>

/**
 * File: universities/<universitySlug>/university.json
 *
 * Minimal identity document - everything else about a university lives in its
 * majors. The list of majors is derived from the `majors/` folder, never
 * duplicated here.
 */
export const universityDocSchema = z.object({
  $schema: z.string().optional(),
  slug: slugSchema,
  name: localizedTextSchema,
  /** Institution type (azad | gov | pnu) - must match the slug prefix. */
  type: universityTypeSchema,
  /** City / campus location (fa required, en optional). */
  location: localizedTextSchema,
})

export type UniversityDoc = z.infer<typeof universityDocSchema>
