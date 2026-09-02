"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toastManager } from "@workspace/ui/components/toast"
import { notificationsService } from "@/services/notifications.service"

export function useBatchSender() {
  const qc = useQueryClient()
  const [sendingIds, setSendingIds] = React.useState<Set<string>>(new Set())
  const abortRef = React.useRef<Map<string, boolean>>(new Map())

  const handleSend = React.useCallback(
    async (batchId: string) => {
      if (sendingIds.has(batchId)) return
      setSendingIds((prev) => new Set(prev).add(batchId))
      abortRef.current.set(batchId, false)
      let totalSent = 0
      let totalFailed = 0
      try {
        while (!abortRef.current.get(batchId)) {
          const result: unknown = await notificationsService
            .sendBatch(batchId, 30)
            .catch(() => null)
          qc.invalidateQueries({ queryKey: ["admin", "batches"] })
          const r = result as {
            sent?: number
            failed?: number
            remaining?: number
            done?: boolean
          } | null
          if (r) {
            totalSent += r.sent ?? 0
            totalFailed += r.failed ?? 0
          }
          if (!r || r.done) {
            if (r?.done) {
              const failedText =
                totalFailed > 0
                  ? `، ${totalFailed.toLocaleString("fa-IR")} ناموفق`
                  : ""
              toastManager.add({
                title: "ارسال تکمیل شد",
                description: `${totalSent.toLocaleString("fa-IR")} موفق${failedText} — همگانی و تغییرات`,
                type: totalFailed ? "warning" : "success",
              })
            }
            break
          }
          if (r.remaining === 0) break
          await new Promise((res) => setTimeout(res, 1000))
        }
      } catch (e) {
        toastManager.add({
          title: "خطا",
          description: e instanceof Error ? e.message : "ارسال ناموفق",
          type: "error",
        })
      } finally {
        setSendingIds((prev) => {
          const next = new Set(prev)
          next.delete(batchId)
          return next
        })
        abortRef.current.delete(batchId)
        qc.invalidateQueries({ queryKey: ["admin", "batches"] })
      }
    },
    [qc, sendingIds]
  )

  const handleStop = React.useCallback((batchId: string) => {
    abortRef.current.set(batchId, true)
    setSendingIds((prev) => {
      const next = new Set(prev)
      next.delete(batchId)
      return next
    })
  }, [])

  return { sendingIds, handleSend, handleStop }
}

export function useBatchMutations() {
  const qc = useQueryClient()
  const deleteMut = useMutation({
    mutationFn: (batchId: string) => notificationsService.removeBatch(batchId),
    onSuccess: () => {
      toastManager.add({ title: "حذف شد", type: "success" })
      qc.invalidateQueries({ queryKey: ["admin", "batches"] })
    },
    onError: (e: unknown) =>
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "حذف ناموفق",
        type: "error",
      }),
  })

  const dismissMut = useMutation({
    mutationFn: (batchId: string) => notificationsService.dismissBatch(batchId),
    onSuccess: () => {
      toastManager.add({
        title: "انجام شد",
        description: "دیگر نمایش داده نمی‌شود",
        type: "success",
      })
      qc.invalidateQueries({ queryKey: ["admin", "batches"] })
    },
    onError: (e: unknown) =>
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "عملیات ناموفق",
        type: "error",
      }),
  })

  return { deleteMut, dismissMut }
}
