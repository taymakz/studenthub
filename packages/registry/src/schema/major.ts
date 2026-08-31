import { z } from "zod"

import { localizedTextSchema, slugSchema } from "./shared"

/**
 * Degree offered by a major. The slug keys the `charts/<degreeSlug>/` folder
 * and is referenced by DB rows; `name` is the display label (e.g. کارشناسی).
 */
export const degreeSchema = z.object({
  slug: slugSchema,
  name: localizedTextSchema,
  /** Number of terms in the standard curriculum (8 for a B.Sc., typically). */
  termCount: z.number().int().min(1).max(20),
})

export type Degree = z.infer<typeof degreeSchema>

/**
 * File: universities/<universitySlug>/majors/<majorSlug>/major.json
 */
export const majorDocSchema = z.object({
  $schema: z.string().optional(),
  type: z.literal("major").optional(),
  slug: slugSchema,
  name: localizedTextSchema,
  /** @deprecated degrees now live per-degree as charts/<degree>/meta.json — kept for backwards compat */
  degrees: z.array(degreeSchema).min(1).optional(),
})

export type MajorDoc = z.infer<typeof majorDocSchema>
