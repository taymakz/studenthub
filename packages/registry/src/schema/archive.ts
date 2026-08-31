import { z } from "zod"

import { slugSchema, telegramFileIdSchema } from "./shared"

/**
 * File: .../majors/<majorSlug>/archives.json
 *
 * Approved study documents (جزوه، نمونه سوال، ...). Files are stored in
 * Telegram - only the file_id is recorded here. Flow: user upload -> PENDING
 * -> admin reviews in the dashboard -> admin manually appends the entry here
 * via a registry PR and marks the upload approved.
 */
export const archiveItemSchema = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  /** Related course name, when the archive belongs to a specific course. */
  courseName: z.string().max(255).optional(),
  fileId: telegramFileIdSchema,
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(128),
  sizeBytes: z.number().int().nonnegative(),
  /** Telegram chat id of the original uploader. */
  uploadedByChatId: z.number().int().positive(),
  addedAt: z.iso.datetime(),
})

export type ArchiveItem = z.infer<typeof archiveItemSchema>

export const archivesDocSchema = z.object({
  $schema: z.string().optional(),
  type: z.literal("archives").optional(),
  items: z.array(archiveItemSchema),
})

export type ArchivesDoc = z.infer<typeof archivesDocSchema>
