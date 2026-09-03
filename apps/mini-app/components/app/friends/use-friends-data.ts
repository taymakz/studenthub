"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { toastManager } from "@workspace/ui/components/toast"

import {
  acceptFriendRequest,
  blockFriend,
  cancelFriendRequest,
  declineFriendRequest,
  fetchBlocks,
  fetchFriendRequests,
  fetchFriends,
  fetchFriendsSummary,
  fetchFriendSettings,
  patchFriendSettings,
  sendFriendRequest,
  unblockFriend,
  unfriend,
} from "@/lib/api"

const PAGE_LIMIT = 25

function notifySuccess(title: string) {
  toastManager.add({ type: "success", title, data: { variant: "x" } })
}

function notifyError(title: string) {
  toastManager.add({ type: "error", title, data: { variant: "x" } })
}

const ALL_FRIEND_KEYS = [
  ["friends-summary"],
  ["friends"],
  ["friend-requests"],
  ["friend-blocks"],
  ["friend-settings"],
]

/** Mutation that refreshes every friends query and toasts the server message. */
function useFriendAction<TArgs>(
  fn: (args: TArgs) => Promise<{ message: string }>,
  fallbackError: string
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      for (const key of ALL_FRIEND_KEYS) {
        void qc.invalidateQueries({ queryKey: key })
      }
      notifySuccess(res.message || "انجام شد")
    },
    onError: (e: Error) => notifyError(e.message || fallbackError),
  })
}

export function useFriendsSummary(enabled = true) {
  return useQuery({
    queryKey: ["friends-summary"],
    queryFn: async () => (await fetchFriendsSummary()).data,
    enabled,
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
  })
}

export function useSendRequest() {
  return useFriendAction(
    async (friendId: number) => sendFriendRequest(friendId),
    "خطا در ارسال درخواست"
  )
}

export function useAcceptRequest() {
  return useFriendAction(
    async (id: string) => acceptFriendRequest(id),
    "خطا در پذیرش درخواست"
  )
}

export function useDeclineRequest() {
  return useFriendAction(
    async (id: string) => declineFriendRequest(id),
    "خطا در رد درخواست"
  )
}

export function useCancelRequest() {
  return useFriendAction(
    async (id: string) => cancelFriendRequest(id),
    "خطا در لغو درخواست"
  )
}

export function useUnfriend() {
  return useFriendAction(
    async (friendId: number) => unfriend(friendId),
    "خطا در حذف دوست"
  )
}

export function useBlockUser() {
  return useFriendAction(
    async (friendId: number) => blockFriend(friendId),
    "خطا در مسدود کردن"
  )
}

export function useUnblockUser() {
  return useFriendAction(
    async (friendId: number) => unblockFriend(friendId),
    "خطا در رفع مسدودیت"
  )
}

export function usePatchFriendSettings() {
  return useFriendAction(
    async (autoDecline: boolean) => patchFriendSettings(autoDecline),
    "خطا در ذخیره تنظیمات"
  )
}
