"use client"

import { useQuery } from "@tanstack/react-query"

import { dashboardService } from "@/services/dashboard.service"

/** Single /admin/stats fetch shared by every dashboard widget. */
export function useDashboardStats() {
  const query = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => dashboardService.stats(),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })

  return {
    stats: query.data ?? null,
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
  }
}
