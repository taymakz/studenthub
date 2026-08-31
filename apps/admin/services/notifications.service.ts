import { apiClient } from "@/lib/api/client"

export type BatchType = "COURSE_CHANGES" | "ANNOUNCEMENT"
export type BatchStatus = "DRAFT" | "READY" | "SENDING" | "COMPLETED"

export interface NotificationBatch {
  id: string
  type: BatchType
  status: BatchStatus
  title: string
  universitySlug: string | null
  majorSlug: string | null
  payload: Record<string, unknown> | null
  totalMessages: number
  sentCount: number
  failedCount: number
  createdAt: string
  updatedAt: string
}

export interface DetectInput {
  universitySlug: string
  majorSlug: string
  year?: number
  semester?: "MEHR" | "BAHMAN" | "SUMMER"
  termCode?: string
}

export const notificationsService = {
  async batches(type?: BatchType) {
    const qs = type ? `?type=${type}` : ""
    const res = await apiClient.get<{ batches: NotificationBatch[] }>(
      `/admin/notifications/batches${qs}`
    )
    return res.data.batches
  },
  async detect(input: DetectInput) {
    const res = await apiClient.post<{
      batch: NotificationBatch
      summary: { added: number; removed: number; changed: number }
      recipients: number
      termCode: string
    }>("/admin/notifications/detect", input)
    return res.data
  },
  async detectAll(opts?: {
    includeGreeting?: boolean
    greetingTemplate?: string | null
    includeButton?: boolean
  }) {
    const res = await apiClient.post<{
      total: number
      created: number
      skipped: number
      errors: number
      batches: NotificationBatch[]
    }>("/admin/notifications/detect-all", opts ?? {})
    return res.data
  },
  async sendNext(batchId: string) {
    const res = await apiClient.post<{
      done: boolean
      sentCount?: number
      failedCount?: number
      remaining?: number
      outcome?: string
    }>(`/admin/notifications/batches/${batchId}/send-next`)
    return res.data
  },
  async sendBatch(batchId: string, count = 30) {
    const res = await apiClient.post<{
      sent: number
      failed: number
      remaining: number
      done: boolean
    }>(`/admin/notifications/batches/${batchId}/send-batch`, { count })
    return res.data
  },
  async removeBatch(batchId: string) {
    const res = await apiClient.delete<null>(
      `/admin/notifications/batches/${batchId}`
    )
    return res.data
  },
  async dismissBatch(batchId: string) {
    const res = await apiClient.post<{ diffId?: string }>(
      `/admin/notifications/batches/${batchId}/dismiss`
    )
    return res.data
  },
  async completeDiff(diffId: string) {
    const res = await apiClient.post<{ diffId: string }>(
      `/admin/notifications/diffs/${diffId}/complete`
    )
    return res.data
  },
}
