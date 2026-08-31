export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024

export function validateFileSize(file: { size: number }): {
  ok: boolean
  error?: string
} {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "فایل بزرگتر از 4MB است (محدودیت Vercel)" }
  }
  return { ok: true }
}
