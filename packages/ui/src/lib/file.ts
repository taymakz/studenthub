/** 20MB — admin media goes browser -> Supabase (presigned PUT), so the
 *  Vercel serverless body limit never applies. Direct multipart uploads
 *  (self-send) are still bound by it server-side. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function validateFileSize(file: { size: number }): {
  ok: boolean
  error?: string
} {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "فایل بزرگتر از 20MB است" }
  }
  return { ok: true }
}
