"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"

import { fetchCourseStudents, fetchMe } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"

export function useStudentsVisibility(open: boolean) {
  const storeUser = useProfileStore((s) => s.user)
  const storeProfile = useProfileStore((s) => s.profile)
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: open,
  })
  const freshUser = meQuery.data?.data?.user
  const freshProfile = meQuery.data?.data?.profile
  const visible = freshUser?.visibleInCourseLists ?? storeUser?.visibleInCourseLists ?? true
  const effectiveProfile = freshProfile ?? storeProfile
  const hasProfile = Boolean(effectiveProfile?.universitySlug)
  return { visible, hasProfile, isMeLoading: meQuery.isLoading, meQuery }
}

export function useStudentsList(
  open: boolean,
  visible: boolean,
  hasProfile: boolean,
  courseIndex: string | null,
  friendsOnly = false
) {
  return useInfiniteQuery({
    queryKey: ["course-students", courseIndex, friendsOnly ? "friends" : "all"],
    queryFn: async ({ pageParam }) => {
      const res = await fetchCourseStudents({ courseIndex: courseIndex!, page: pageParam as number, limit: 25, friendsOnly })
      return res.data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    enabled: open && visible && hasProfile && Boolean(courseIndex),
  })
}
