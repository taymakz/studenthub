"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { fetchUniversities } from "@/lib/api"
import { matchesQuery } from "@/lib/search"

const LIST_PAGE_SIZE = 20

export function useUniversityData(uniSearch: string) {
  const unisQuery = useQuery({
    queryKey: ["universities"],
    queryFn: async () => (await fetchUniversities()).data.universities,
  })

  const universities = unisQuery.data ?? []
  const filteredUnis = universities.filter((u) => matchesQuery(uniSearch, [u.name?.fa, u.location?.fa, u.slug]))

  const [uniPage, setUniPage] = React.useState({ query: uniSearch, count: LIST_PAGE_SIZE })
  if (uniPage.query !== uniSearch) {
    setUniPage({ query: uniSearch, count: LIST_PAGE_SIZE })
  }
  const visibleUnis = filteredUnis.slice(0, uniPage.count)

  const loadMoreUnis = () => {
    setUniPage((p) => (p.count < filteredUnis.length ? { ...p, count: p.count + LIST_PAGE_SIZE } : p))
  }

  return { unisQuery, universities, filteredUnis, visibleUnis, loadMoreUnis }
}
