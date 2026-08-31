import { apiClient } from "@/lib/api/client"

export type FeedbackKind = "BUG" | "SUGGESTION" | "THANKS" | "SOURCE"
export type FeedbackStatus = "OPEN" | "RESOLVED"

export interface FeedbackUser {
  id: number
  firstName: string
  lastName: string | null
  telegramUsername: string | null
  photoUrl: string | null
  profile: {
    universitySlug: string | null
    majorSlug: string | null
    universityName: string | null
    majorName: string | null
    degree: string | null
    entryYearRange: string | null
    entrySemester: string | null
    gender: string | null
    termNumber: number | null
  } | null
}

export interface Feedback {
  id: string
  userId: number
  kind: FeedbackKind
  status: FeedbackStatus
  message: string
  attachments: unknown[]
  resolvedById: number | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  user: FeedbackUser | null
}

export interface Pagination {
  page: number
  limit: number
  total: number
}

export interface FeedbackListParams {
  page?: number
  limit?: number
  q?: string
  kind?: FeedbackKind
  status?: FeedbackStatus
  sort?: "newest" | "oldest"
}

export const feedbackService = {
  async list(params: FeedbackListParams = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set("page", String(params.page))
    if (params.limit) qs.set("limit", String(params.limit))
    if (params.q) qs.set("q", params.q)
    if (params.kind) qs.set("kind", params.kind)
    if (params.status) qs.set("status", params.status)
    if (params.sort) qs.set("sort", params.sort)
    const query = qs.toString()
    const res = await apiClient.get<{
      feedback: Feedback[]
      pagination: Pagination
    }>(`/admin/feedback${query ? `?${query}` : ""}`)
    return res.data
  },

  async resolve(id: string) {
    return apiClient.post<{ feedback: Feedback }>(
      `/admin/feedback/${id}/resolve`
    )
  },

  async reopen(id: string) {
    return apiClient.post<{ feedback: Feedback }>(
      `/admin/feedback/${id}/reopen`
    )
  },

  async remove(id: string) {
    return apiClient.delete<null>(`/admin/feedback/${id}`)
  },
}
