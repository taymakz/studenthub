import { apiClient } from "@/lib/api/client"

/**
 * Dashboard home data - one call feeds every widget (counters, review
 * queues, signup trend, university distribution).
 */

export interface SignupSeries {
  series: Array<{ date: string; value: number }>
  average: number
  trend: number
}

export interface UniversityShare {
  slug: string
  name: string
  count: number
}

export interface DashboardStats {
  users: number
  bannedUsers: number
  admins: number
  contributors: number
  pendingUploads: number
  activeBatches: number
  pendingMessages: number
  openFeedback: number
  professorVotes: number
  activeNotedCourses: number
  signupSeries: SignupSeries
  usersByUniversity: UniversityShare[]
}

export const dashboardService = {
  async stats() {
    const res = await apiClient.get<DashboardStats>("/admin/stats")
    return res.data
  },
}
