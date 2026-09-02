"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { fetchMajors, type MajorIndexEntry } from "@/lib/api"
import { matchesQuery } from "@/lib/search"

const LIST_PAGE_SIZE = 20

function dedupeMajors(majors: MajorIndexEntry[]): MajorIndexEntry[] {
  const bySlug = new Map<string, MajorIndexEntry>()
  for (const m of majors) if (!bySlug.has(m.slug)) bySlug.set(m.slug, m)
  return [...bySlug.values()]
}

export function useMajorData(universitySlug: string | undefined, majorSearch: string) {
  const majorsQuery = useQuery({
    queryKey: ["majors", universitySlug],
    queryFn: async () => (await fetchMajors(universitySlug!)).data.majors,
    enabled: Boolean(universitySlug),
  })

  const allMajors = dedupeMajors(majorsQuery.data ?? [])
  const filteredMajors = allMajors.filter((m) => matchesQuery(majorSearch, [m.name?.fa, m.slug]))

  const [majorPage, setMajorPage] = React.useState({
    query: majorSearch,
    uni: universitySlug ?? "",
    count: LIST_PAGE_SIZE,
  })
  if (majorPage.query !== majorSearch || majorPage.uni !== (universitySlug ?? "")) {
    setMajorPage({ query: majorSearch, uni: universitySlug ?? "", count: LIST_PAGE_SIZE })
  }
  const visibleMajors = filteredMajors.slice(0, majorPage.count)

  const loadMoreMajors = () => {
    setMajorPage((p) => (p.count < filteredMajors.length ? { ...p, count: p.count + LIST_PAGE_SIZE } : p))
  }

  return { majorsQuery, allMajors, filteredMajors, visibleMajors, loadMoreMajors }
}

export function useSelectedMajor(majors: MajorIndexEntry[] | undefined, majorSlug: string | undefined) {
  return majors?.find((m) => m.slug === majorSlug)
}
