"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchMe, fetchMajors, fetchOfferingTerms, fetchUniversities } from "@/lib/api"
import { apiClient } from "@/lib/request"
import { findNewerSemesterCode } from "@/lib/term"
import { useProfileStore } from "@/stores/profile-store"

export function useStudentAccountData(open: boolean) {
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe })
  const profile = meQuery.data?.data?.profile ?? null
  const user = meQuery.data?.data?.user ?? null
  const unisQuery = useQuery({ queryKey: ["universities"], queryFn: async () => (await fetchUniversities()).data.universities, enabled: open })
  const majorsQuery = useQuery({ queryKey: ["majors", profile?.universitySlug], queryFn: async () => (await fetchMajors(profile!.universitySlug!)).data.majors, enabled: open && Boolean(profile?.universitySlug) })
  const termsQuery = useQuery({ queryKey: ["offering-terms", profile?.universitySlug, profile?.majorSlug], queryFn: async () => (await fetchOfferingTerms(profile!.universitySlug!, profile!.majorSlug!)).data.terms, enabled: open && Boolean(profile?.universitySlug && profile?.majorSlug) })
  const terms = [...(termsQuery.data ?? [])].sort((a, b) => a.termCode.localeCompare(b.termCode))
  const newerCode = findNewerSemesterCode(profile?.currentSemesterCode, terms.map((t) => t.termCode))
  return { meQuery, profile, user, unisQuery, majorsQuery, termsQuery, terms, newerCode }
}

export function useStudentPatch(onClose: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { termNumber?: number; currentSemesterCode?: string; isLastTerm?: boolean }) => (await apiClient.patch<{ profile: unknown }>("/me/profile", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      void useProfileStore.getState().refresh()
      onClose()
    },
  })
}
