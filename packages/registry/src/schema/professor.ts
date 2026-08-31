import { z } from "zod"

import { slugSchema } from "./shared"

/**
 * File: .../majors/<majorSlug>/professors.json
 *
 * Professor identity lives here; votes live in the database and reference
 * `professorSlug`.
 */
export const professorSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(255),
  department: z.string().max(128).optional(),
})

export type Professor = z.infer<typeof professorSchema>

export const professorsDocSchema = z.object({
  $schema: z.string().optional(),
  type: z.literal("professors").optional(),
  professors: z.array(professorSchema).min(1),
})

export type ProfessorsDoc = z.infer<typeof professorsDocSchema>
