"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { Import } from "reicon/icons/Import"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@workspace/ui/components/responsive-alert-dialog"

import { toastManager } from "@/components/toast"
import { useChartStore } from "@/components/chart-store"
import { parseChartDoc, type ParsedChartDoc } from "@/lib/import-chart"
import { toFaDigits } from "@/lib/jalali"

/** Which parts of an imported chart-doc this button applies.
    - "terms": only the terms map (term sections)
    - "moaref": only the moaref list
    - "global": terms + moaref (header import) */
export type ChartDocImportScope = "terms" | "moaref" | "global"

const REPLACE_COPY: Record<
  ChartDocImportScope,
  { title: string; description: string }
> = {
  terms: {
    title: "جایگزینی دروس ترم‌ها؟",
    description: "همه دروس فعلی ترم‌ها حذف و با دروس وارد‌شده جایگزین می‌شوند.",
  },
  moaref: {
    title: "جایگزینی معارف؟",
    description: "همه دروس فعلی معارف حذف و با دروس وارد‌شده جایگزین می‌شوند.",
  },
  global: {
    title: "جایگزینی چارت؟",
    description: "دروس ترم‌ها و معارف با محتوای وارد‌شده جایگزین می‌شوند.",
  },
}

function ImportIcon({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex [&_svg]:size-4"
      dangerouslySetInnerHTML={{ __html: Import.toSvg({ size }) }}
    />
  )
}

/** Import dropdown: reads a chart-doc JSON (global export shape) from a
    file or the clipboard and applies the scope's sections to the store.
    When the target sections already hold courses, a replace confirmation
    shows first - importing never silently destroys work. */
export function ChartDocImport({
  scope,
  withLabel = false,
}: {
  scope: ChartDocImportScope
  /** Shows a «ورود» label next to the icon (icon-only when false). */
  withLabel?: boolean
}) {
  const { chart, importTermsDoc, importMoarefDoc } = useChartStore()
  const inputRef = React.useRef<HTMLInputElement>(null)
  // Parsed doc waiting for the replace confirmation.
  const [pending, setPending] = React.useState<ParsedChartDoc | null>(null)

  const hasExistingCourses =
    scope === "moaref"
      ? chart.moaref.length > 0
      : scope === "terms"
        ? Object.values(chart.terms).some((courses) => courses.length > 0)
        : Object.values(chart.terms).some((courses) => courses.length > 0) ||
          chart.moaref.length > 0

  const commitApply = (parsed: ParsedChartDoc): number => {
    let count = 0
    if ((scope === "terms" || scope === "global") && parsed.terms) {
      importTermsDoc(parsed.terms)
      count += Object.values(parsed.terms).reduce(
        (sum, courses) => sum + courses.length,
        0
      )
    }
    if ((scope === "moaref" || scope === "global") && parsed.moaref) {
      importMoarefDoc(parsed.moaref)
      count += parsed.moaref.length
    }
    if (parsed.isCompleted !== undefined) {
      useChartStore.getState().setIsCompleted(parsed.isCompleted)
    }
    return count
  }

  const successToast = (loadingId: string, count: number) => {
    toastManager.update(loadingId, {
      type: "success",
      title:
        count > 0
          ? `${toFaDigits(count)} درس وارد شد`
          : "هیچ درسی در ورودی پیدا نشد",
      timeout: 4000,
    })
  }

  const applyParsed = (text: string) => {
    const loadingId = toastManager.add({
      type: "loading",
      title: "در حال پردازش فایل…",
      timeout: 0,
    })
    const result = parseChartDoc(text)
    if ("error" in result) {
      toastManager.update(loadingId, {
        type: "error",
        title: result.error,
        timeout: 5000,
      })
      return
    }
    if (hasExistingCourses) {
      // Ask before destroying anything; drop the loading toast meanwhile.
      toastManager.close(loadingId)
      setPending(result.parsed)
      return
    }
    successToast(loadingId, commitApply(result.parsed))
  }

  const onPickFile = async (files: FileList | null) => {
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
    applyParsed(await file.text())
    // Allow re-selecting the same file later.
    if (inputRef.current) inputRef.current.value = ""
  }

  const onPickClipboard = async () => {
    // A hard "denied" never recovers by retrying - surface it explicitly.
    // Firefox/Safari can't even query this permission, so ignore failures.
    if (typeof navigator.permissions?.query === "function") {
      try {
        const status = await navigator.permissions.query({
          name: "clipboard-read" as PermissionName,
        })
        if (status.state === "denied") {
          toastManager.add({
            type: "error",
            title: "دسترسی کلیپ‌بورد رد شده؛ از تنظیمات مرورگر اجازه دهید",
          })
          return
        }
      } catch {
        // Unsupported permission name - fall through to readText.
      }
    }
    let text = ""
    try {
      text = await navigator.clipboard.readText()
    } catch {
      toastManager.add({
        type: "error",
        title: "اجازه دسترسی به کلیپ‌بورد داده نشد",
      })
      return
    }
    if (!text.trim()) {
      toastManager.add({ type: "error", title: "کلیپ‌بورد خالی بود" })
      return
    }
    applyParsed(text)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size={withLabel ? "sm" : "icon-sm"}>
              <ImportIcon />
              {withLabel && "ورود"}
              {withLabel && <ChevronDown className="size-3.5 opacity-60" />}
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {/* Native click keeps full user activation so readText can
              actually trigger the browser's permission prompt. */}
          <DropdownMenuItem
            onClick={() => {
              void onPickClipboard()
            }}
          >
            <ImportIcon size={14} /> از کلیپ‌بورد
          </DropdownMenuItem>
          {/* Native click, synchronous - the menu hasn't started dismissing
              yet, so the chooser request carries full user activation (same
              proven pattern as the old Nuxt chart builder). */}
          <DropdownMenuItem
            onClick={() => {
              inputRef.current?.click()
            }}
          >
            <ImportIcon size={14} /> از فایل JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => void onPickFile(e.target.files)}
      />

      {/* Replace confirmation when the target section already has courses. */}
      <ResponsiveAlertDialog
        open={pending != null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              {REPLACE_COPY[scope].title}
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              {REPLACE_COPY[scope].description}
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>انصراف</ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pending) {
                  const count = commitApply(pending)
                  toastManager.add({
                    type: "success",
                    title:
                      count > 0
                        ? `${toFaDigits(count)} درس وارد شد`
                        : "هیچ درسی در ورودی پیدا نشد",
                  })
                }
                setPending(null)
              }}
            >
              جایگزینی
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  )
}
