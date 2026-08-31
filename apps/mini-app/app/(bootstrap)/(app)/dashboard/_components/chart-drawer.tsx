"use client"

import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Loader2, Workflow } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { toastManager } from "@workspace/ui/components/toast"

import { fetchChartFile, fetchMe } from "@/lib/api"
import { apiClient } from "@/lib/request"

const triggerClassName = "flex items-center flex-col gap-3.5 text-center w-full"

export default function ChartDrawer() {
  const [open, setOpen] = React.useState(false)

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
  })
  const profile = meQuery.data?.data?.profile ?? null

  const statusQuery = useQuery({
    queryKey: [
      "chart-status",
      profile?.universitySlug,
      profile?.majorSlug,
      profile?.degree,
      profile?.entryYearRange,
      profile?.entrySemester,
    ],
    queryFn: async () =>
      (await apiClient.get<{ available: boolean }>("/me/chart-file/status"))
        .data,
    enabled: Boolean(
      profile?.universitySlug &&
      profile?.majorSlug &&
      profile?.degree &&
      profile?.entryYearRange &&
      profile?.entrySemester
    ),
  })
  const isAvailable = statusQuery.data?.available ?? null
  const isStatusLoading = statusQuery.isLoading
  const isUnavailable = statusQuery.data != null && isAvailable === false

  const requestChart = useMutation({
    mutationFn: async () => (await fetchChartFile()).data,
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: "چارت ارسال شد",
        description: "فایل PDF در تلگرام برای شما ارسال شد",
        data: { variant: "x" },
      })
      setOpen(false)
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "چارت در دسترس نیست"
      toastManager.add({
        type: "error",
        title:
          msg.includes("هنوز") || msg.includes("دسترس نیست")
            ? "چارت در دسترس نیست"
            : "خطا در ارسال",
        description: msg,
        data: { variant: "x" },
      })
    },
  })

  const handleGetFile = () => {
    if (isUnavailable) {
      toastManager.add({
        type: "error",
        title: "چارت در دسترس نیست",
        description: "فایل PDF این چارت در رجیستری یافت نشد",
        data: { variant: "x" },
      })
      return
    }
    requestChart.mutate()
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <button className={triggerClassName}>
            <div className="relative mx-auto flex aspect-square max-h-32 w-full max-w-32 items-center justify-center rounded-lg border bg-card">
              <Workflow className="size-8 text-lime-500" />
              {!isStatusLoading && isUnavailable && (
                <Badge
                  variant={"destructive"}
                  className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-1.5 py-0 text-[10px]"
                >
                  در دسترس نیست
                </Badge>
              )}
            </div>
            <div className="w-full text-sm">چارت درسی</div>
          </button>
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>دریافت چارت درسی</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          {isStatusLoading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> در حال بررسی...
            </div>
          ) : isUnavailable ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-sm text-destructive">
                چارت در دسترس نیست — فایل PDF این چارت در رجیستری یافت نشد
              </p>
              <Button className="w-full" disabled>
                در دسترس نیست
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              disabled={requestChart.isPending || !profile}
              onClick={handleGetFile}
            >
              {requestChart.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              دریافت فایل
            </Button>
          )}
          {requestChart.isError && (
            <p className="mt-2 text-center text-xs text-destructive">
              {(requestChart.error as Error)?.message ?? "خطا در ارسال"}
            </p>
          )}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
