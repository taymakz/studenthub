"use client"

import { CheckCheck, Play, Square, Trash2 } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"

import type { NotificationBatch } from "@/services/notifications.service"

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  READY: "آماده",
  SENDING: "در حال ارسال",
  COMPLETED: "تکمیل شده",
}

const FA_LOCALE = "fa-IR" as const
const TEHRAN_TZ = "Asia/Tehran" as const

function formatDateFaIR(dateString: string) {
  return new Date(dateString).toLocaleDateString(FA_LOCALE, {
    timeZone: TEHRAN_TZ,
  })
}

function formatNumberFaIR(n: number) {
  return n.toLocaleString(FA_LOCALE)
}

type BatchPayload = {
  diffId?: string
  added?: number
  removed?: number
  changed?: number
} | null

function useBatchDerived(batch: NotificationBatch) {
  const attempted = batch.sentCount + batch.failedCount
  const progress =
    batch.totalMessages > 0 ? (attempted / batch.totalMessages) * 100 : 0
  const isReady = batch.status === "READY"
  const isSending = batch.status === "SENDING"
  const isCompleted = batch.status === "COMPLETED"
  const payload = batch.payload as BatchPayload
  const hasDiff = Boolean(payload?.diffId)
  const showPayloadSummary =
    hasDiff &&
    payload != null &&
    (payload.added !== undefined || payload.changed !== undefined)
  return {
    attempted,
    progress,
    isReady,
    isSending,
    isCompleted,
    payload,
    hasDiff,
    showPayloadSummary,
  }
}

function BatchStatusBadge({
  status,
  isCompleted,
  isSending,
}: {
  status: string
  isCompleted: boolean
  isSending: boolean
}) {
  return (
    <Badge
      variant="outline"
      className={
        isCompleted
          ? "border-success/20 bg-success/10 text-success"
          : isSending
            ? "border-amber-200 bg-amber-100 text-amber-700"
            : "bg-muted"
      }
    >
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

function BatchMeta({
  batch,
  payload,
  showPayloadSummary,
}: {
  batch: NotificationBatch
  payload: BatchPayload
  showPayloadSummary: boolean
}) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {batch.type === "COURSE_CHANGES" ? "تغییرات دروس" : "همگانی"} •{" "}
      {formatDateFaIR(batch.createdAt)} • {formatNumberFaIR(batch.totalMessages)}{" "}
      گیرنده
      {showPayloadSummary && (
        <span className="ms-1">
          • {payload?.added ?? 0} جدید، {payload?.removed ?? 0} حذف،{" "}
          {payload?.changed ?? 0} تغییر
        </span>
      )}
    </p>
  )
}

function BatchProgress({
  attempted,
  totalMessages,
  failedCount,
  sentCount,
  isCompleted,
  progress,
}: {
  attempted: number
  totalMessages: number
  failedCount: number
  sentCount: number
  isCompleted: boolean
  progress: number
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">پیشرفت</span>
        <span className="flex items-center gap-1.5 font-mono">
          <span>
            {attempted}/{totalMessages}
          </span>
          {failedCount > 0 && (
            <span className="font-sans text-[11px] text-destructive">
              • {formatNumberFaIR(failedCount)} ناموفق
            </span>
          )}
          {isCompleted && attempted > 0 && (
            <span className="font-sans text-[11px] text-muted-foreground">
              • {formatNumberFaIR(sentCount)} موفق
            </span>
          )}
        </span>
      </div>
      <Progress value={progress} className="h-1.5" />
    </div>
  )
}

function BatchActions({
  batchId,
  isReady,
  isSending,
  isCompleted,
  hasDiff,
  isLoading,
  onSendNext,
  onDelete,
  onDismiss,
  onStop,
}: {
  batchId: string
  isReady: boolean
  isSending: boolean
  isCompleted: boolean
  hasDiff: boolean
  isLoading: boolean
  onSendNext: (id: string) => void
  onDelete: (id: string) => void
  onDismiss: (id: string) => void
  onStop: (id: string) => void
}) {
  const showSend = isReady || isSending
  const showDelete = isReady || isSending
  const showDismiss = hasDiff || isCompleted
  const showCompletedTag = isCompleted && !hasDiff

  return (
    <div className="flex flex-wrap gap-2">
      {showSend && (
        <>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => onSendNext(batchId)}
            disabled={isLoading}
            loading={isLoading}
          >
            {!isLoading && <Play className="size-3.5" />}
            {isLoading ? "در حال ارسال..." : isSending ? "ادامه" : "شروع ارسال"}
          </Button>
          {isLoading && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onStop(batchId)}
            >
              <Square className="size-3.5" /> توقف
            </Button>
          )}
        </>
      )}
      {showDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-destructive hover:text-destructive"
          onClick={() => onDelete(batchId)}
        >
          <Trash2 className="size-3.5" /> حذف
        </Button>
      )}
      {showDismiss && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onDismiss(batchId)}
        >
          <CheckCheck className="size-3.5" /> مخفی کردن
        </Button>
      )}
      {showCompletedTag && (
        <span className="hidden py-1 text-xs text-muted-foreground">
          تکمیل شده
        </span>
      )}
    </div>
  )
}

export function BatchCard({
  batch,
  onSendNext,
  onDelete,
  onDismiss,
  onStop,
  isLoading,
}: {
  batch: NotificationBatch
  onSendNext: (id: string) => void
  onDelete: (id: string) => void
  onDismiss: (id: string) => void
  onStop: (id: string) => void
  isLoading: boolean
}) {
  const derived = useBatchDerived(batch)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm leading-tight">
              {batch.title}
            </CardTitle>
            <BatchMeta
              batch={batch}
              payload={derived.payload}
              showPayloadSummary={derived.showPayloadSummary}
            />
            {derived.hasDiff && (
              <p
                className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70"
                dir="ltr"
              >
                {derived.payload?.diffId?.slice(0, 8)}
              </p>
            )}
          </div>
          <BatchStatusBadge
            status={batch.status}
            isCompleted={derived.isCompleted}
            isSending={derived.isSending}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <BatchProgress
          attempted={derived.attempted}
          totalMessages={batch.totalMessages}
          failedCount={batch.failedCount}
          sentCount={batch.sentCount}
          isCompleted={derived.isCompleted}
          progress={derived.progress}
        />
        <BatchActions
          batchId={batch.id}
          isReady={derived.isReady}
          isSending={derived.isSending}
          isCompleted={derived.isCompleted}
          hasDiff={derived.hasDiff}
          isLoading={isLoading}
          onSendNext={onSendNext}
          onDelete={onDelete}
          onDismiss={onDismiss}
          onStop={onStop}
        />
      </CardContent>
    </Card>
  )
}
