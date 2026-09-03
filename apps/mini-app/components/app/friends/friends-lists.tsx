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
} from "./friend-rows"
import { userSubtitle } from "./friends-text"
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

function IncomingSection({
  query,
  onAccept,
  onDecline,
  onBlock,
}: {
  query: ReturnType<typeof useIncomingRequests>
  onAccept: (r: FriendRequestItem) => void
  onDecline: (r: FriendRequestItem) => void
  onBlock: (r: FriendRequestItem) => void
}) {
  const items = query.data?.pages.flatMap((p) => p.requests) ?? []
  if (query.isLoading) return <FriendsLoading />
  if (query.isError)
    return (
      <FriendsError
        message={(query.error as Error)?.message ?? "خطا در دریافت لیست"}
      />
    )
  if (items.length === 0)
    return <FriendsEmpty message="درخواست دریافتی ندارید." />
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <PersonRow key={r.id} user={r.user} subtitle={userSubtitle(r.user)}>
          <AcceptAction onClick={() => onAccept(r)} />
          <DeclineAction onClick={() => onDecline(r)} />
          <BlockAction onClick={() => onBlock(r)} />
        </PersonRow>
      ))}
      {query.hasNextPage && (
        <LoadMoreButton
          isFetching={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      )}
    </div>
  )
}

function OutgoingSection({
  query,
  onCancel,
  cancelPending,
}: {
  query: ReturnType<typeof useOutgoingRequests>
  onCancel: (id: string) => void
  cancelPending: boolean
}) {
  const items = query.data?.pages.flatMap((p) => p.requests) ?? []
  if (query.isLoading) return <FriendsLoading />
  if (query.isError)
    return (
      <FriendsError
        message={(query.error as Error)?.message ?? "خطا در دریافت لیست"}
      />
    )
  if (items.length === 0)
    return <FriendsEmpty message="درخواست ارسالی در انتظاری ندارید." />
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <PersonRow key={r.id} user={r.user} subtitle={userSubtitle(r.user)}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={cancelPending}
            onClick={() => onCancel(r.id)}
          >
            لغو
          </Button>
        </PersonRow>
      ))}
      {query.hasNextPage && (
        <LoadMoreButton
          isFetching={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      )}
    </div>
  )
}

function RequestConfirmDialog({
  confirm,
  pending,
  onClose,
  onConfirm,
}: {
  confirm: RequestConfirm | null
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ConfirmDrawer
      open={confirm !== null}
      onOpenChange={(o) => !o && onClose()}
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
      pending={pending}
      onConfirm={onConfirm}
    />
  )
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
  const closeConfirm = () => setConfirm(null)

  const confirmPending =
    confirm?.kind === "accept"
      ? accept.isPending
      : confirm?.kind === "decline"
        ? decline.isPending
        : block.isPending

  const runConfirm = () => {
    if (!confirm) return
    const done = { onSuccess: closeConfirm }
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
        <IncomingSection
          query={incoming}
          onAccept={(r) => setConfirm({ kind: "accept", request: r })}
          onDecline={(r) => setConfirm({ kind: "decline", request: r })}
          onBlock={(r) => setConfirm({ kind: "block", request: r })}
        />
      </section>

      <section>
        <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
          درخواست‌های ارسالی
        </h3>
        <OutgoingSection
          query={outgoing}
          onCancel={(id) => cancel.mutate(id)}
          cancelPending={cancel.isPending}
        />
      </section>

      <RequestConfirmDialog
        confirm={confirm}
        pending={confirmPending}
        onClose={closeConfirm}
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
