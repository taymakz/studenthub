import { apiClient } from "@/lib/api/client"

/**
 * Users management API client — backed by GET /admin/users (paginated,
 * filterable, sortable) and mutation endpoints for ban/unban/role.
 */
export type AdminRole = "USER" | "ADMIN" | "SUPERADMIN" | "NOTIFICATIONER"

export type Gender = "MALE" | "FEMALE"

export interface UniversityProfile {
  universitySlug: string | null
  majorSlug: string | null
  universityName: string | null
  majorName: string | null
  degree: string | null
  degreeName: string | null
  entryYearRange: string | null
  entrySemester: string | null
  gender: Gender | null
  termNumber: number | null
}

export interface PublicUser {
  id: number
  telegramUsername: string | null
  firstName: string
  lastName: string | null
  photoUrl: string | null
  role: AdminRole
  isContributor: boolean
  banned: boolean
  bannedReason: string | null
  lastOnlineAt: string | null
  createdAt: string
  profile?: UniversityProfile | null
}

export interface Pagination {
  page: number
  limit: number
  total: number
}

export interface UsersListParams {
  page?: number
  limit?: number
  q?: string
  role?: AdminRole
  banned?: boolean
  gender?: Gender
  university?: string | string[]
  major?: string | string[]
  sort?: "lastActivity" | "createdAt"
}

export const usersService = {
  async list(params: UsersListParams = {}) {
    const qs = new URLSearchParams()
    if (params.page) qs.set("page", String(params.page))
    if (params.limit) qs.set("limit", String(params.limit))
    if (params.q) qs.set("q", params.q)
    if (params.role) qs.set("role", params.role)
    if (params.banned !== undefined) qs.set("banned", String(params.banned))
    if (params.gender) qs.set("gender", params.gender)
    const toCsv = (v: string | string[]) => (Array.isArray(v) ? v.join(",") : v)
    if (params.university) {
      const csv = toCsv(params.university)
      if (csv) qs.set("university", csv)
    }
    if (params.major) {
      const csv = toCsv(params.major)
      if (csv) qs.set("major", csv)
    }
    if (params.sort) qs.set("sort", params.sort)
    const query = qs.toString()
    const res = await apiClient.get<{
      users: PublicUser[]
      pagination: Pagination
    }>(`/admin/users${query ? `?${query}` : ""}`)
    return res.data
  },

  async detail(id: number) {
    const res = await apiClient.get<{
      user: PublicUser
      profile: Record<string, unknown> | null
    }>(`/admin/users/${id}`)
    return res.data
  },

  async ban(id: number, reason?: string) {
    const qs = reason ? `?reason=${encodeURIComponent(reason)}` : ""
    return apiClient.post<null>(`/admin/users/${id}/ban${qs}`)
  },

  async unban(id: number) {
    return apiClient.post<null>(`/admin/users/${id}/unban`)
  },

  async setRole(id: number, role: AdminRole) {
    return apiClient.put<{ id: number; role: AdminRole }>(
      `/admin/users/${id}/role`,
      { role }
    )
  },

  async toggleContributor(id: number) {
    return apiClient.patch<{ id: number; isContributor: boolean }>(
      `/admin/users/${id}/contributor`
    )
  },

  async universities() {
    const res = await apiClient.get<{
      universities: Array<{ slug: string; name: { fa: string; en: string } }>
    }>("/admin/meta/universities")
    return res.data.universities
  },

  async majors(uni?: string) {
    const qs = uni ? `?uni=${encodeURIComponent(uni)}` : ""
    const res = await apiClient.get<{
      majors: Array<{
        slug: string
        uniSlug: string
        name: { fa: string; en: string }
      }>
    }>(`/admin/meta/majors${qs}`)
    return res.data.majors
  },

  async chart(id: number) {
    const res = await apiClient.get<{
      chart: unknown | null
      courses: Array<{
        course_name: string
        course_unit: number | string
        course_code?: string
      }>
    }>(`/admin/users/${id}/chart`)
    return res.data
  },

  /** Build a proxied avatar URL that goes through /api/avatar. */
  avatarUrl(photoUrl: string | null): string | null {
    if (!photoUrl) return null
    return `/api/avatar?url=${encodeURIComponent(photoUrl)}`
  },
}
