"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toastManager } from "@workspace/ui/components/toast"
import { telegramService } from "@/services/telegram.service"
import { ALL } from "./filter-select"
import type { ComposerValue } from "../telegram/telegram-composer"

function toArrayOrUndefined(arr: string[]) {
  return arr.includes(ALL) || arr.length === 0 ? undefined : arr
}

function validateFilters(args: {
  uniVals?: string[]
  majorVals?: string[]
  genderVals?: string[]
  semesterVals?: string[]
  yearVals?: number[]
}): string | null {
  if (args.uniVals && args.uniVals.length > 10) return "حداکثر ۱۰ دانشگاه"
  if (args.majorVals && args.majorVals.length > 10) return "حداکثر ۱۰ رشته"
  if (args.genderVals && args.genderVals.length > 2) return "حداکثر ۲ جنسیت"
  if (args.semesterVals && args.semesterVals.length > 3) return "حداکثر ۳ ترم ورود"
  if (args.yearVals && args.yearVals.length > 10) return "حداکثر ۱۰ سال ورود"
  return null
}

export function useBroadcastState() {
  const [composer, setComposer] = React.useState<ComposerValue>({
    text: "",
    parseMode: "MarkdownV2",
    photoUrl: "",
    photoFile: null,
    photoFileId: "",
    videoUrl: "",
    videoFile: null,
    videoFileId: "",
    documentFile: null,
    documentFileId: "",
    buttons: [],
    disablePreview: true,
  })
  const [broadcastSending, setBroadcastSending] = React.useState(false)
  const [filterUni, setFilterUni] = React.useState<string[]>([ALL])
  const [filterMajor, setFilterMajor] = React.useState<string[]>([ALL])
  const [filterGender, setFilterGender] = React.useState<string[]>([ALL])
  const [filterEntrySemester, setFilterEntrySemester] = React.useState<string[]>([
    ALL,
  ])
  const [filterEntryYears, setFilterEntryYears] = React.useState<string[]>([ALL])
  const [broadcastIncludeGreeting, setBroadcastIncludeGreeting] = React.useState(true)
  const [broadcastGreetingTemplate, setBroadcastGreetingTemplate] =
    React.useState("سلام {name} عزیز")
  const [broadcastIncludeButton, setBroadcastIncludeButton] = React.useState(true)

  const yearOptions = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => String(1400 + i)),
    []
  )

  return {
    composer,
    setComposer,
    broadcastSending,
    setBroadcastSending,
    filterUni,
    setFilterUni,
    filterMajor,
    setFilterMajor,
    filterGender,
    setFilterGender,
    filterEntrySemester,
    setFilterEntrySemester,
    filterEntryYears,
    setFilterEntryYears,
    broadcastIncludeGreeting,
    setBroadcastIncludeGreeting,
    broadcastGreetingTemplate,
    setBroadcastGreetingTemplate,
    broadcastIncludeButton,
    setBroadcastIncludeButton,
    yearOptions,
  }
}

export function useBroadcastHandler(state: ReturnType<typeof useBroadcastState>, onSuccess: () => void) {
  const qc = useQueryClient()

  const handleBroadcast = async () => {
    if (!state.composer.text.trim()) {
      toastManager.add({ title: "خطا", description: "متن الزامی است", type: "error" })
      return
    }
    state.setBroadcastSending(true)
    try {
      const buttons = state.composer.buttons
        .map((r) =>
          r
            .filter((b) => b.text.trim() && b.url.trim())
            .map((b) => ({ text: b.text.trim(), url: b.url.trim() }))
        )
        .filter((r) => r.length > 0)

      const uniVals = toArrayOrUndefined(state.filterUni)
      const majorVals = toArrayOrUndefined(state.filterMajor)
      const genderVals = toArrayOrUndefined(state.filterGender)
      const semesterVals = toArrayOrUndefined(state.filterEntrySemester)
      const yearVals = toArrayOrUndefined(state.filterEntryYears)
        ?.map(Number)
        .filter((n) => Number.isFinite(n))

      const validationError = validateFilters({
        uniVals,
        majorVals,
        genderVals,
        semesterVals,
        yearVals,
      })
      if (validationError) {
        toastManager.add({ title: validationError, type: "error" })
        return
      }

      await telegramService.sendBroadcast({
        text: state.composer.text.trim(),
        parseMode:
          state.composer.parseMode === "plain"
            ? undefined
            : (state.composer.parseMode as "HTML" | "Markdown" | "MarkdownV2"),
        photoUrl: state.composer.photoUrl.trim() || undefined,
        photoFile: state.composer.photoFile ?? undefined,
        photoFileId: state.composer.photoFileId.trim() || undefined,
        videoUrl: state.composer.videoUrl.trim() || undefined,
        videoFile: state.composer.videoFile ?? undefined,
        videoFileId: state.composer.videoFileId.trim() || undefined,
        documentFile: state.composer.documentFile ?? undefined,
        documentFileId: state.composer.documentFileId.trim() || undefined,
        buttons: buttons.length ? buttons : undefined,
        disablePreview: state.composer.disablePreview,
        includeGreeting: state.broadcastIncludeGreeting,
        greetingTemplate: state.broadcastIncludeGreeting
          ? state.broadcastGreetingTemplate
          : undefined,
        includeButton: state.broadcastIncludeButton,
        universitySlug: uniVals?.[0],
        majorSlug: majorVals?.[0],
        gender: (genderVals?.[0] as unknown as string) ?? undefined,
        entrySemester: (semesterVals?.[0] as unknown as string) ?? undefined,
        entryYears: yearVals?.length ? yearVals : undefined,
        universitySlugs: uniVals as unknown as string[],
        majorSlugs: majorVals as unknown as string[],
        genders: genderVals as unknown as string[],
        entrySemesters: semesterVals as unknown as string[],
      } as unknown as Parameters<typeof telegramService.sendBroadcast>[0])

      toastManager.add({
        title: "اعلان ساخته شد",
        description: "با «شروع ارسال» به صورت مرحله‌ای ارسال می‌شود",
        type: "success",
      })
      state.setComposer({
        text: "",
        parseMode: "MarkdownV2",
        photoUrl: "",
        photoFile: null,
        photoFileId: "",
        videoUrl: "",
        videoFile: null,
        videoFileId: "",
        documentFile: null,
        documentFileId: "",
        buttons: [],
        disablePreview: true,
      })
      qc.invalidateQueries({ queryKey: ["admin", "batches"] })
      onSuccess()
    } catch (e: unknown) {
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "ایجاد ناموفق",
        type: "error",
      })
    } finally {
      state.setBroadcastSending(false)
    }
  }

  return handleBroadcast
}
