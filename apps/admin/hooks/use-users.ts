"use client"

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query"

import type { UsersListParams } from "@/services/users.service"
import { usersService } from "@/services/users.service"

export function useUsers(params: UsersListParams) {
  const query = useQuery({
    queryKey: ["admin", "users", params],
    queryFn: () => usersService.list(params),
    staleTime: 15_000,
  })

  return {
    users: query.data?.users ?? [],
    pagination: query.data?.pagination ?? { page: 1, limit: 20, total: 0 },
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  }
}

export function useUsersInfinite(
  params: Omit<UsersListParams, "page" | "limit"> & { limit?: number },
  opts?: { live?: boolean }
) {
  const limit = params.limit ?? 40
  const query = useInfiniteQuery({
    queryKey: ["admin", "users", "infinite", params],
    queryFn: ({ pageParam = 1 }) =>
      usersService.list({ ...params, page: pageParam as number, limit }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, total } = lastPage.pagination
      const totalPages = Math.ceil(total / limit)
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 15_000,
    gcTime: 300_000,
    placeholderData: keepPreviousData,
    refetchInterval: opts?.live ? 60_000 : false,
    refetchIntervalInBackground: false,
  })

  const users = query.data?.pages.flatMap((p) => p.users) ?? []
  const total = query.data?.pages[0]?.pagination.total ?? 0

  return {
    users,
    total,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error instanceof Error ? query.error.message : null,
  }
}

export function useUniversities() {
  return useQuery({
    queryKey: ["admin", "meta", "universities"],
    queryFn: () => usersService.universities(),
    staleTime: 300_000,
  })
}

export function useMajors(uni?: string) {
  return useQuery({
    queryKey: ["admin", "meta", "majors", uni ?? "all"],
    queryFn: () => usersService.majors(uni),
    staleTime: 300_000,
    enabled: true,
  })
}
