"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchOfferingTerms } from "@/lib/api"
import { findNewerSemesterCode } from "@/lib/term"
import { useProfileStore } from "@/stores/profile-store"

export function useSemesterData(open: boolean) {
  const profile = useProfileStore((s) => s.profile)
  const termsQuery = useQuery({
    queryKey: ["offering-terms", profile?.universitySlug, profile?.majorSlug],
    queryFn: async () => (await fetchOfferingTerms(profile!.universitySlug!, profile!.majorSlug!)).data.terms,
    enabled: Boolean(profile?.universitySlug && profile?.majorSlug) && open,
  })
  const terms = (termsQuery.data ?? []).toSorted((a, b) => a.termCode.localeCompare(b.termCode))
  const newerCode = findNewerSemesterCode(profile?.currentSemesterCode, terms.map((t) => t.termCode))
  return { profile, termsQuery, terms, newerCode }
}
