"use client"

import * as React from "react"

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
import { ExportDialog } from "@/components/export-dialog"
import { useSidebarDialogStore } from "@/components/sidebar-dialog-store"
import { toFaDigits } from "@/lib/jalali"

/** Dialogs triggered by sidebar actions, mounted at shell level (outside
    the sidebar subtree) so they position correctly in every state. */
export function SidebarDialogs() {
  const { chart, clearCourses, resetChart, shrinkTermCount } = useChartStore()
  const exportOpen = useSidebarDialogStore((s) => s.exportOpen)
  const setExportOpen = useSidebarDialogStore((s) => s.setExportOpen)
  const confirmOpen = useSidebarDialogStore((s) => s.confirmOpen)
  const setConfirmOpen = useSidebarDialogStore((s) => s.setConfirmOpen)
  // Last requested action; intentionally NOT cleared on close so the title
  // stays stable while the exit animation plays.
  const confirm = useSidebarDialogStore((s) => s.confirm)
  const pendingTermCount = useSidebarDialogStore((s) => s.pendingTermCount)

  // Which removed terms actually hold courses (drives the description).
  const doomedTerms = React.useMemo(() => {
    if (confirm !== "terms" || pendingTermCount == null) return []
    const list: string[] = []
    for (let term = chart.termCount; term > pendingTermCount; term--) {
      if ((chart.terms[term] ?? []).length > 0) list.push(toFaDigits(term))
    }
    return list
  }, [confirm, pendingTermCount, chart.termCount, chart.terms])

  return (
    <>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      <ResponsiveAlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              {confirm === "clear"
                ? "حذف همه دروس؟"
                : confirm === "terms"
                  ? "کاهش تعداد ترم‌ها؟"
                  : "بازنشانی کامل چارت؟"}
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              {confirm === "clear"
                ? "همه ترم‌ها، معارف، نامشخص‌ها و گروه‌های اختیاری خالی می‌شوند. مشخصات چارت (مقطع و تعداد ترم‌ها) حفظ می‌شود."
                : confirm === "terms"
                  ? doomedTerms.length > 0
                    ? `دروس ترم ${doomedTerms.join("، ")} حذف می‌شوند و قابل بازگشت نیستند.`
                    : "دروس ترم‌های حذف‌شده پاک می‌شوند و قابل بازگشت نیستند."
                  : "چارت به حالت اولیه برمی‌گردد؛ مقطع، ترم‌ها و همه دروس پاک می‌شوند."}
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>انصراف</ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirm === "clear") {
                  clearCourses()
                  toastManager.add({
                    type: "success",
                    title: "همه دروس حذف شدند",
                  })
                } else if (confirm === "terms") {
                  // One atomic update: drops every term beyond the target so
                  // removed courses never persist.
                  if (pendingTermCount != null) {
                    shrinkTermCount(pendingTermCount)
                  }
                  toastManager.add({
                    type: "success",
                    title:
                      pendingTermCount != null
                        ? `تعداد ترم‌ها به ${toFaDigits(pendingTermCount)} کاهش یافت`
                        : "تعداد ترم‌ها کاهش یافت",
                  })
                } else {
                  resetChart()
                  toastManager.add({ type: "success", title: "چارت ریست شد" })
                }
                setConfirmOpen(false)
              }}
            >
              تأیید
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  )
}
