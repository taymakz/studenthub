"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { fetchOfferingTerms } from "@/lib/api"

export function useCurrentSemesterTerms(universitySlug: string | undefined, majorSlug: string | undefined) {
  const query = useQuery({
    queryKey: ["offering-terms", universitySlug, majorSlug, "currentSemester"],
    queryFn: async () => (await fetchOfferingTerms(universitySlug!, majorSlug!)).data.terms,
    enabled: Boolean(universitySlug && majorSlug),
  })

  const terms = React.useMemo(
    () => [...(query.data ?? [])].sort((a, b) => a.termCode.localeCompare(b.termCode)),
    [query.data]
  )

  return { query, terms }
}
