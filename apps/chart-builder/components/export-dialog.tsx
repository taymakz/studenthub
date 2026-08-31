"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Label } from "@workspace/ui/components/label"
import { StatusButton } from "@workspace/ui/components/status-button"
import { Copy, Download } from "lucide-react"

import { useChartStore } from "./chart-store"
import { exportFileName, exportJson, exportTargets } from "@/lib/export-chart"
import { Button } from "@workspace/ui/components/button"

/**
 * Export options - opened from the sidebar's "خروجی چارت" action. No schema
 * validation step by design (the extension already validates its own output;
 * CI re-validates the registry PR).
 */
export function ExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { chart, scope, setIsCompleted } = useChartStore()
  const targets = exportTargets(chart, scope)

  const copy = async () => {
    await navigator.clipboard.writeText(exportJson(chart, scope))
  }

  const download = () => {
    const blob = new Blob([exportJson(chart, scope)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${exportFileName(chart, scope)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>خروجی چارت</DialogTitle>
          <DialogDescription>
            فایل JSON چارت را دریافت کنید یا محتوای آن را کپی کنید - مسیر مقصد
            در رجیستری:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-1 rounded-lg bg-muted/60 px-3 py-2.5">
            {targets.map((target) => (
              <p
                key={target.path}
                dir="ltr"
                className="truncate text-left font-mono text-[11px] text-muted-foreground"
              >
                {target.path}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">برای کدوم ماه؟</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "MEHR" as const, label: "مهر" },
                { value: "BAHMAN" as const, label: "بهمن" },
                { value: "BOTH" as const, label: "جفت" },
              ].map((opt) => {
                const isActive =
                  opt.value === "BOTH"
                    ? scope.semesters.includes("MEHR") &&
                      scope.semesters.includes("BAHMAN")
                    : scope.semesters.length === 1 &&
                      scope.semesters[0] === opt.value
                return (
                  <Button
                    key={opt.value}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const sems =
                        opt.value === "BOTH"
                          ? (["MEHR", "BAHMAN"] as const)
                          : ([opt.value] as const)
                      useChartStore.setState((s) => ({
                        scope: { ...s.scope, semesters: [...sems] },
                      }))
                    }}
                    className="h-9 text-sm"
                  >
                    {opt.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card px-3 py-3">
            <label
              htmlFor="chart-completed"
              className="flex cursor-pointer items-center gap-2.5"
            >
              <Checkbox
                id="chart-completed"
                checked={chart.isCompleted ?? true}
                onCheckedChange={(checked) => setIsCompleted(checked === true)}
              />
              <Label
                htmlFor="chart-completed"
                className="flex-1 cursor-pointer text-sm font-medium"
              >
                چارت تکمیله؟
              </Label>
              <span className="text-xs font-medium text-muted-foreground">
                {(chart.isCompleted ?? true) ? "کامل" : "ناقص"}
              </span>
            </label>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              اگه همه‌ی دروس کامل نشده و هنوز در حال تکمیله، تیک رو نزنید.
            </p>
          </div>

          <div className="grid gap-2">
            <StatusButton
              variant="secondary"
              onClick={download}
              successLabel="ذخیره شد"
            >
              <Download /> دانلود JSON
            </StatusButton>
            <StatusButton onClick={copy} successLabel="کپی شد">
              <Copy /> کپی در کلیپ‌بورد
            </StatusButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
