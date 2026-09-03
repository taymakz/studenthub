"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query"
import { toastManager } from "@workspace/ui/components/toast"

import {
  acceptFriendRequest,
  blockFriend,
  cancelFriendRequest,
  declineFriendRequest,
  fetchBlocks,
  fetchCourseMates,
  fetchFriendDetail,
  fetchFriendRequests,
  fetchFriends,
  fetchFriendsCourses,
  fetchFriendsSummary,
  fetchFriendSettings,
  patchFriendSettings,
  sendFriendRequest,
  unblockFriend,
  unfriend,
  type BlockedItem,
  type FriendItem,
  type FriendRequestItem,
} from "@/lib/api"

const PAGE_LIMIT = 25

/**
 * Friends data is social and changes from both sides — always show cache
 * instantly but renew it silently in the background (mount + focus).
 */
const LIVE_QUERY = {
  staleTime: 0,
  refetchOnWindowFocus: true,
} as const

function notifySuccess(title: string) {
  toastManager.add({ type: "success", title, data: { variant: "x" } })
}

function notifyError(title: string) {
  toastManager.add({ type: "error", title, data: { variant: "x" } })
}

const ALL_FRIEND_KEYS = [
  ["friends-summary"],
  ["friends"],
  ["friend-detail"],
  ["friend-requests"],
  ["friend-blocks"],
  ["friend-settings"],
  ["friends-courses"],
]

type RequestPage = {
  requests: FriendRequestItem[]
  page: number
  limit: number
  hasMore: boolean
}
type FriendsPage = {
  friends: FriendItem[]
  page: number
  limit: number
  hasMore: boolean
}
type BlocksPage = {
  blocked: BlockedItem[]
  page: number
  limit: number
  hasMore: boolean
}

type Rollback = () => void

function snapshotKeys(
  qc: QueryClient,
  keys: ReadonlyArray<readonly string[]>
): Array<[readonly string[], unknown]> {
  return keys.map((key) => [key, qc.getQueryData(key)])
}

function restoreSnapshots(
  qc: QueryClient,
  snapshots: Array<[readonly string[], unknown]>
) {
  for (const [key, data] of snapshots) qc.setQueryData(key, data)
}

/** Instantly drop a request row from both pending caches (rollback on error). */
function removeRequestOptimistic(qc: QueryClient, id: string): Rollback {
  const keys = [
    ["friend-requests", "incoming"],
    ["friend-requests", "outgoing"],
  ] as const
  const prev = snapshotKeys(qc, keys)
  for (const key of keys) {
    qc.setQueryData<InfiniteData<RequestPage>>(key, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              requests: p.requests.filter((r) => r.id !== id),
            })),
          }
        : old
    )
  }
  return () => restoreSnapshots(qc, prev)
}

/** Instantly drop a friend row from the friends cache (rollback on error). */
function removeFriendOptimistic(qc: QueryClient, friendId: number): Rollback {
  const key = ["friends"] as const
  const prev = snapshotKeys(qc, [key])
  qc.setQueryData<InfiniteData<FriendsPage>>(key, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            friends: p.friends.filter((f) => f.id !== friendId),
          })),
        }
      : old
  )
  return () => restoreSnapshots(qc, prev)
}

/** Instantly drop a blocked row from the blocks cache (rollback on error). */
function removeBlockedOptimistic(qc: QueryClient, friendId: number): Rollback {
  const key = ["friend-blocks"] as const
  const prev = snapshotKeys(qc, [key])
  qc.setQueryData<InfiniteData<BlocksPage>>(key, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            blocked: p.blocked.filter((b) => b.user.id !== friendId),
          })),
        }
      : old
  )
  return () => restoreSnapshots(qc, prev)
}

/** Instantly prepend a sent request to the outgoing cache (dedupe by id). */
function insertOutgoingOptimistic(qc: QueryClient, item: FriendRequestItem) {
  const key = ["friend-requests", "outgoing"] as const
  qc.setQueryData<InfiniteData<RequestPage>>(
    key,
    (old) => {
      if (old?.pages.some((p) => p.requests.some((r) => r.id === item.id))) {
        return old
      }
      if (!old) {
        return {
          pages: [{ requests: [item], page: 1, limit: PAGE_LIMIT, hasMore: false }],
          pageParams: [1],
        }
      }
      const [first, ...rest] = old.pages
      if (!first) return old
      return {
        ...old,
        pages: [
          { ...first, requests: [item, ...first.requests] },
          ...rest,
        ],
      }
    }
  )
}

/**
 * Mutation that refreshes every friends query and toasts the server message.
 * Supports optimistic cache surgery with automatic rollback on error.
 */
function useFriendAction<TArgs, TRes extends { message: string }>(
  fn: (args: TArgs) => Promise<TRes>,
  fallbackError: string,
  opts?: {
    onMutate?: (qc: QueryClient, args: TArgs) => Rollback | void
    onSuccess?: (qc: QueryClient, res: TRes, args: TArgs) => void
  }
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onMutate: opts?.onMutate
      ? (args) => opts.onMutate!(qc, args)
      : undefined,
    onError: (e: Error, _args, context) => {
      if (typeof context === "function") {
        ;(context as Rollback)()
      }
      notifyError(e.message || fallbackError)
    },
    onSuccess: (res, args) => {
      for (const key of ALL_FRIEND_KEYS) {
        void qc.invalidateQueries({ queryKey: key })
      }
      notifySuccess(res.message || "انجام شد")
      opts?.onSuccess?.(qc, res, args)
    },
  })
}

export function useFriendsSummary(enabled = true) {
  return useQuery({
    queryKey: ["friends-summary"],
    queryFn: async () => (await fetchFriendsSummary()).data,
    enabled,
    ...LIVE_QUERY,
  })
}

function useInfinitePager<TPage extends { hasMore: boolean; page: number }>(
  queryKey: string[],
  fetchPage: (page: number) => Promise<TPage>,
  enabled: boolean
) {
  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.hasMore ? last.page + 1 : undefined,
    enabled,
    ...LIVE_QUERY,
  })
}

export function useFriendsList(enabled = true) {
  return useInfinitePager(["friends"], async (page) => {
    return (await fetchFriends({ page, limit: PAGE_LIMIT })).data
  }, enabled)
}

export function useIncomingRequests(enabled = true) {
  return useInfinitePager(["friend-requests", "incoming"], async (page) => {
    return (
      await fetchFriendRequests({ direction: "incoming", page, limit: PAGE_LIMIT })
    ).data
  }, enabled)
}

export function useOutgoingRequests(enabled = true) {
  return useInfinitePager(["friend-requests", "outgoing"], async (page) => {
    return (
      await fetchFriendRequests({ direction: "outgoing", page, limit: PAGE_LIMIT })
    ).data
  }, enabled)
}

export function useBlockList(enabled = true) {
  return useInfinitePager(["friend-blocks"], async (page) => {
    return (await fetchBlocks({ page, limit: PAGE_LIMIT })).data
  }, enabled)
}

export function useFriendSettings(enabled = true) {
  return useQuery({
    queryKey: ["friend-settings"],
    queryFn: async () => (await fetchFriendSettings()).data,
    enabled,
    ...LIVE_QUERY,
  })
}

export function useFriendDetail(friendId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["friend-detail", friendId],
    queryFn: async () => (await fetchFriendDetail(friendId!)).data,
    enabled: enabled && friendId !== null,
    ...LIVE_QUERY,
  })
}

/** Per-course friend counts + avatar samples for a whole term (one query). */
export function useFriendsCoursesMap(
  uni: string | null | undefined,
  major: string | null | undefined,
  termCode: string | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: ["friends-courses", uni, major, termCode],
    queryFn: async () =>
      (
        await fetchFriendsCourses({
          uni: uni!,
          major: major!,
          termCode: termCode!,
        })
      ).data.courses,
    enabled: enabled && !!uni && !!major && !!termCode,
    ...LIVE_QUERY,
  })
}

export function useCourseMates(
  courseIndex: string | null,
  uni: string | null | undefined,
  major: string | null | undefined,
  termCode: string | null | undefined,
  enabled = true
) {
  return useInfinitePager(
    ["friends-course-mates", courseIndex ?? "", uni ?? "", major ?? "", termCode ?? ""],
    async (page) => {
      return (
        await fetchCourseMates(courseIndex!, {
          uni: uni!,
          major: major!,
          termCode: termCode!,
          page,
          limit: PAGE_LIMIT,
        })
      ).data
    },
    enabled && !!courseIndex && !!uni && !!major && !!termCode
  )
}

export function useSendRequest() {
  return useFriendAction(
    async (friendId: number) => sendFriendRequest(friendId),
    "خطا در ارسال درخواست",
    {
      onSuccess: (qc, res) => {
        // Instantly visible in the pending tab — no wait for refetch.
        const item = res.data?.request
        if (item?.status === "PENDING") insertOutgoingOptimistic(qc, item)
      },
    }
  )
}

export function useAcceptRequest() {
  return useFriendAction(
    async (id: string) => acceptFriendRequest(id),
    "خطا در پذیرش درخواست",
    {
      onMutate: (qc, id) => removeRequestOptimistic(qc, id),
    }
  )
}

export function useDeclineRequest() {
  return useFriendAction(
    async (id: string) => declineFriendRequest(id),
    "خطا در رد درخواست",
    {
      onMutate: (qc, id) => removeRequestOptimistic(qc, id),
    }
  )
}

export function useCancelRequest() {
  return useFriendAction(
    async (id: string) => cancelFriendRequest(id),
    "خطا در لغو درخواست",
    {
      onMutate: (qc, id) => removeRequestOptimistic(qc, id),
    }
  )
}

export function useUnfriend() {
  return useFriendAction(
    async (friendId: number) => unfriend(friendId),
    "خطا در حذف دوست",
    {
      onMutate: (qc, friendId) => removeFriendOptimistic(qc, friendId),
    }
  )
}

export function useBlockUser() {
  return useFriendAction(async (friendId: number) => blockFriend(friendId), "خطا در مسدود کردن")
}

export function useUnblockUser() {
  return useFriendAction(
    async (friendId: number) => unblockFriend(friendId),
    "خطا در رفع مسدودیت",
    {
      onMutate: (qc, friendId) => removeBlockedOptimistic(qc, friendId),
    }
  )
}

export function usePatchFriendSettings() {
  return useFriendAction(
    async (autoDecline: boolean) => patchFriendSettings(autoDecline),
    "خطا در ذخیره تنظیمات"
  )
}
