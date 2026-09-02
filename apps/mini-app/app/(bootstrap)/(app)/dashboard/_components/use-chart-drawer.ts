"use client"

import { useMutation, useQuery } from "@tanstack/react-query"

import { toastManager } from "@workspace/ui/components/toast"

import { fetchChartFile, fetchMe } from "@/lib/api"
import { apiClient } from "@/lib/request"

export function useChartProfile() {
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
  })
  const profile = meQuery.data?.data?.profile ?? null
  return { profile }
}

export function useChartStatus(profile: ReturnType<typeof useChartProfile>["profile"]) {
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
      (await apiClient.get<{ available: boolean }>("/me/chart-file/status")).data,
    enabled: Boolean(
      profile?.universitySlug &&
        profile?.majorSlug &&
        profile?.degree &&
        profile?.entryYearRange &&
        profile?.entrySemester
    ),
  })
  return {
    isAvailable: statusQuery.data?.available ?? null,
    isLoading: statusQuery.isLoading,
    isUnavailable: statusQuery.data != null && statusQuery.data?.available === false,
  }
}

export function useChartRequest(onSuccessClose: () => void) {
  return useMutation({
    mutationFn: async () => (await fetchChartFile()).data,
    onSuccess: () => {
      toastManager.add({
        type: "success",
        title: "چارت ارسال شد",
        description: "فایل PDF در تلگرام برای شما ارسال شد",
        data: { variant: "x" },
      })
      onSuccessClose()
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
}

export function useChartDrawerHandlers(
  isUnavailable: boolean,
  requestMutate: () => void
) {
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
    requestMutate()
  }

  return { handleGetFile }
}
