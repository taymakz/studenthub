import { apiClient } from "@/lib/request"

/**
 * One-time export-image flow (برنامه هفتگی / برنامه امتحانی):
 *   1. presign  – API returns a short-lived presigned PUT for a per-user key
 *   2. upload   – XHR PUT the PNG blob straight to Supabase S3 (progress)
 *   3. send     – API hands Telegram a short-lived presigned GET, sends the
 *                 photo to the user's PV and deletes the object.
 *
 * If Supabase is not configured the API 400s and callers fall back to a local
 * download (same UX as the old project).
 */

export interface ExportProgress {
  percent: number
}

export class ExportUploadCanceled extends Error {
  constructor() {
    super("canceled")
    this.name = "ExportUploadCanceled"
  }
}

/** Supabase bucket cap (user-configured). */
const MAX_EXPORT_MB = 20

export async function exportImage(
  blob: Blob,
  kind: "weekly" | "exam",
  onProgress?: (p: ExportProgress) => void,
  cancelRef?: { current: (() => void) | null }
): Promise<{ sent: true }> {
  if (blob.size > MAX_EXPORT_MB * 1024 * 1024) {
    throw new Error(`حجم فایل بیشتر از ${MAX_EXPORT_MB} مگابایت است`)
  }
  // NOTE: the PNG body goes browser → Supabase DIRECTLY via the presigned PUT.
  // Only tiny JSON calls (presign/send) touch the Vercel serverless functions,
  // so the 5MB serverless body limit never applies.
  const presign = await apiClient
    .post<{ uploadUrl: string; key: string }>("/me/export-image/presign", {
      kind,
    })
    .then((r) => r.data)
    .catch((e: unknown) => {
      throw new Error(
        e instanceof Error && e.message ? e.message : "خطا در آماده‌سازی آپلود"
      )
    })

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    if (cancelRef) cancelRef.current = () => xhr.abort()
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({ percent: Math.round((event.loaded / event.total) * 100) })
      }
    })
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`خطا در آپلود (${xhr.status})`))
    })
    xhr.addEventListener("error", () => reject(new Error("خطای شبکه در آپلود")))
    xhr.addEventListener("abort", () => reject(new ExportUploadCanceled()))
    xhr.open("PUT", presign.uploadUrl, true)
    xhr.setRequestHeader("Content-Type", "image/png")
    xhr.send(blob)
  })

  await apiClient.post("/me/export-image/send", { key: presign.key })
  return { sent: true }
}
