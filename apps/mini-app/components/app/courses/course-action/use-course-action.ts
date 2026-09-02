"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/lib/request"
import { useProfileStore } from "@/stores/profile-store"

export function useCourseActionTerm() {
  const profile = useProfileStore((s) => s.profile)
  const qc = useQueryClient()
  const patchMut = useMutation({
    mutationFn: async (input: { termNumber: number }) =>
      (await apiClient.patch<{ profile: unknown }>("/me/profile", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      import("@/stores/profile-store").then(({ useProfileStore }) =>
        useProfileStore.getState().refresh()
      )
    },
  })
  return { profile, patchMut }
}
