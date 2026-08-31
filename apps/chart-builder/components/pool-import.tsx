"use client"

import * as React from "react"
import { toastManager } from "@/components/toast"
import { Import } from "reicon/icons/Import"

import { useChartStore } from "@/components/chart-store"
import { parsePoolInput } from "@/lib/pool"
import { toFaDigits } from "@/lib/jalali"

/** Big centered import card shown when no courses exist yet: dashed border
    that highlights to primary on hover/press, click opens a .json file
    picker, and a global Ctrl+V listener pastes the extension output straight
    from the clipboard. */
export function PoolImportEmptyState() {
  const { setPool } = useChartStore()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const importText = React.useCallback(
    (text: string) => {
      const result = parsePoolInput(text)
      if (result.error || result.courses.length === 0) {
        toastManager.add({
          type: "error",
          title: result.error ?? "هیچ درسی در ورودی پیدا نشد",
        })
        return
      }
      setPool({
        courses: result.courses,
        totalOfferings: result.totalOfferings,
      })
      toastManager.add({
        type: "success",
        title: `${toFaDigits(result.courses.length)} درس از ${toFaDigits(result.totalOfferings)} ارائه وارد شد`,
      })
    },
    [setPool]
  )

  // Global Ctrl+V while this state is mounted. Guarded on a JSON-ish
  // payload so normal text copies pass through untouched.
  React.useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const text = event.clipboardData?.getData("text") ?? ""
      const trimmed = text.trim()
      if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return
      event.preventDefault()
      importText(trimmed)
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [importText])

  const onFiles = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    // accept="" is only advisory - enforce .json ourselves too.
    const isJson =
      file.type === "application/json" || /\.json$/i.test(file.name)
    if (!isJson) {
      toastManager.add({ type: "error", title: "فقط فایل JSON پذیرفته می‌شود" })
      if (inputRef.current) inputRef.current.value = ""
      return
    }
    const loadingId = toastManager.add({
      type: "loading",
      title: "در حال پردازش فایل…",
      timeout: 0,
    })
    try {
      const result = parsePoolInput(await file.text())
      if (result.error || result.courses.length === 0) {
        throw new Error(result.error ?? "هیچ درسی در ورودی پیدا نشد")
      }
      setPool({
        courses: result.courses,
        totalOfferings: result.totalOfferings,
      })
      toastManager.update(loadingId, {
        type: "success",
        title: `${toFaDigits(result.courses.length)} درس از ${toFaDigits(result.totalOfferings)} ارائه وارد شد`,
        timeout: 4000,
      })
    } catch (error) {
      toastManager.update(loadingId, {
        type: "error",
        title: error instanceof Error ? error.message : "ورودی نامعتبر بود",
        timeout: 5000,
      })
    } finally {
      // Allow re-selecting the same file later.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex w-full max-w-2xl flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-border px-8 py-24 text-center transition-colors duration-200 ease-out hover:border-primary focus-visible:border-primary focus-visible:outline-none active:border-primary"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary group-focus-visible:bg-primary/10 group-focus-visible:text-primary [&_svg]:size-7"
          dangerouslySetInnerHTML={{ __html: Import.toSvg({ size: 28 }) }}
        />
        <span className="space-y-1.5">
          <span className="block text-base font-semibold">افزودن دروس ترم</span>
          <span className="mx-auto block max-w-sm text-sm leading-relaxed text-muted-foreground">
            ابتدا با افزونهٔ دانشجویار دروس ترم را اسکرپ کنید، سپس فایل JSON
            خروجی را همین‌جا وارد کنید تا استخر چارت ساخته شود.
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md border border-border/60 bg-muted px-2 py-1 transition-colors duration-200 group-hover:border-primary/30 group-focus-visible:border-primary/30">
            انتخاب فایل JSON
          </span>
          <span>یا</span>
          <span className="rounded-md border border-border/60 bg-muted px-2 py-1 font-mono text-[11px] transition-colors duration-200 group-hover:border-primary/30 group-focus-visible:border-primary/30">
            Ctrl+V
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
      />
    </div>
  )
}
