"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchProfessorVotes, fetchProfessors, fetchVote } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"

export function useProfessorSlug(uni: string, major: string, professorName: string, open: boolean) {
  const slugQuery = useQuery({
    queryKey: ["professors", uni, major],
    queryFn: async () => (await fetchProfessors(uni, major)).data.professors,
    enabled: open,
  })
  const slug = slugQuery.data?.find((p) => p.name === professorName)?.slug ?? null
  return { slugQuery, slug }
}

export function useProfessorVotes(uni: string, major: string, slug: string | null, open: boolean) {
  return useQuery({
    queryKey: ["professor-votes", uni, major, slug],
    queryFn: async () => (await fetchProfessorVotes(uni, major, slug!)).data,
    enabled: open && !!slug,
  })
}

export function useOwnVote(slug: string | null, open: boolean) {
  return useQuery({
    queryKey: ["my-vote", slug],
    queryFn: async () => (await fetchVote(slug!)).data.vote,
    enabled: open && !!slug,
    retry: false,
  })
}

export function useProfessorCourses(professorName: string, currentCourseIndex?: string | null) {
  const otherOfferings = useProfileStore((s) => s.offerings)
  return otherOfferings.filter((o) => {
    const name =
      typeof o.professor === "string"
        ? o.professor
        : (o.professor as { fa?: string } | null)?.fa
    return name === professorName && o.index !== currentCourseIndex
  })
}
