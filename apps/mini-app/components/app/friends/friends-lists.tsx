"use client"

import { useState } from "react"
import { Virtuoso } from "react-virtuoso"

import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

import type { FriendRequestItem } from "@/lib/api"
import { ConfirmDrawer } from "./confirm-drawer"
import {
  AcceptAction,
  BlockAction,
  DeclineAction,
  FriendsEmpty,
  FriendsError,
  FriendsLoading,
  LoadMoreButton,
  PersonRow,
  userSubtitle,
} from "./friend-rows"
import { FriendDetailDrawer } from "./friend-detail-drawer"
import {
  useAcceptRequest,
  useBlockUser,
  useCancelRequest,
  useDeclineRequest,
  useFriendsList,
  useIncomingRequests,
  useOutgoingRequests,
} from "./use-friends-data"

type RequestConfirm =
  | { kind: "accept"; request: FriendRequestItem }
  | { kind: "decline"; request: FriendRequestItem }
  | { kind: "block"; request: FriendRequestItem }

function requestFullName(r: FriendRequestItem) {
  return `${r.user.firstName} ${r.user.lastName ?? ""}`.trim()
}

/** Pending tab: incoming requests (accept / decline / block) + outgoing (cancel). */
export function PendingTab() {
  const incoming = useIncomingRequests(true)
  const outgoing = useOutgoingRequests(true)

  const accept = useAcceptRequest()
  const decline = useDeclineRequest()
  const cancel = useCancelRequest()
  const block = useBlockUser()

  const [confirm, setConfirm] = useState<RequestConfirm | null>(null)

  const incomingItems =
    incoming.data?.pages.flatMap((p) => p.requests) ?? []
  const outgoingItems =
    outgoing.data?.pages.flatMap((p) => p.requests) ?? []

  const confirmPending =
    confirm?.kind === "accept"
      ? accept.isPending
      : confirm?.kind === "decline"
        ? decline.isPending
        : block.isPending

  const runConfirm = () => {
    if (!confirm) return
    const done = { onSuccess: () => setConfirm(null) }
    if (confirm.kind === "accept") accept.mutate(confirm.request.id, done)
    else if (confirm.kind === "decline") decline.mutate(confirm.request.id, done)
    else block.mutate(confirm.request.user.id, done)
  }

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
          درخواست‌های دریافتی
        </h3>
        {incoming.isLoading ? (
          <FriendsLoading />
        ) : incoming.isError ? (
          <FriendsError
            message={(incoming.error as Error)?.message ?? "خطا در دریافت لیست"}
          />
        ) : incomingItems.length === 0 ? (
          <FriendsEmpty message="درخواست دریافتی ندارید." />
        ) : (
          <div className="space-y-2">
            {incomingItems.map((r) => (
              <PersonRow
                key={r.id}
                user={r.user}
                subtitle={userSubtitle(r.user)}
              >
                <AcceptAction onClick={() => setConfirm({ kind: "accept", request: r })} />
                <DeclineAction onClick={() => setConfirm({ kind: "decline", request: r })} />
                <BlockAction onClick={() => setConfirm({ kind: "block", request: r })} />
              </PersonRow>
            ))}
            {incoming.hasNextPage && (
              <LoadMoreButton
                isFetching={incoming.isFetchingNextPage}
                onLoadMore={() => void incoming.fetchNextPage()}
              />
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
          درخواست‌های ارسالی
        </h3>
        {outgoing.isLoading ? (
          <FriendsLoading />
        ) : outgoing.isError ? (
          <FriendsError
            message={(outgoing.error as Error)?.message ?? "خطا در دریافت لیست"}
          />
        ) : outgoingItems.length === 0 ? (
          <FriendsEmpty message="درخواست ارسالی در انتظاری ندارید." />
        ) : (
          <div className="space-y-2">
            {outgoingItems.map((r) => (
              <PersonRow
                key={r.id}
                user={r.user}
                subtitle={userSubtitle(r.user)}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(r.id)}
                >
                  لغو
                </Button>
              </PersonRow>
            ))}
            {outgoing.hasNextPage && (
              <LoadMoreButton
                isFetching={outgoing.isFetchingNextPage}
                onLoadMore={() => void outgoing.fetchNextPage()}
              />
            )}
          </div>
        )}
      </section>

      <ConfirmDrawer
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "accept"
            ? "پذیرش درخواست دوستی"
            : confirm?.kind === "decline"
              ? "رد درخواست دوستی"
              : "مسدود کردن کاربر"
        }
        description={
          confirm
            ? confirm.kind === "block"
              ? `${requestFullName(confirm.request)} مسدود می‌شود و دوستی یا درخواست‌های دوطرفه حذف می‌گردد.`
              : confirm.kind === "decline"
                ? `${requestFullName(confirm.request)} تا یک ماه نمی‌تواند دوباره درخواست بفرستد.`
                : `با ${requestFullName(confirm.request)} دوست می‌شوید.`
            : undefined
        }
        confirmLabel={
          confirm?.kind === "accept"
            ? "پذیرش"
            : confirm?.kind === "decline"
              ? "رد درخواست"
              : "مسدود کردن"
        }
        danger={confirm?.kind !== "accept"}
        pending={confirmPending}
        onConfirm={runConfirm}
      />
    </div>
  )
}

/** Friends tab: big avatars, tap a friend to open their detail drawer. */
export function FriendsTab() {
  const list = useFriendsList(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const items = list.data?.pages.flatMap((p) => p.friends) ?? []

  const handleLoadMore = () => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage()
  }

  if (list.isLoading) return <FriendsLoading />
  if (list.isError)
    return (
      <FriendsError
        message={(list.error as Error)?.message ?? "خطا در دریافت لیست"}
      />
    )
  if (items.length === 0)
    return <FriendsEmpty message="هنوز دوستی ندارید. با شناسه دوستی، دوست‌هایتان را اضافه کنید." />

  return (
    <div>
      <Virtuoso
        useWindowScroll
        data={items}
        overscan={6}
        endReached={handleLoadMore}
        itemContent={(_, f) => (
          <div className="pb-2">
            <PersonRow
              user={f}
              subtitle={f.username ? `@${f.username}` : undefined}
              subtitleLtr
              hint={f.profile ?? undefined}
              avatarSize="xl"
              onClick={() => setSelectedId(f.id)}
            />
          </div>
        )}
      />
      {list.isFetchingNextPage && (
        <div className="flex justify-center py-2">
          <Spinner />
        </div>
      )}

      <FriendDetailDrawer
        friendId={selectedId}
        open={selectedId !== null}
        onOpenChange={(o) => !o && setSelectedId(null)}
      />
    </div>
  )
}
