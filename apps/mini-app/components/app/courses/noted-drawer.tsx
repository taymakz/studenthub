"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, Check, Eye, PencilLine, Trash2 } from "lucide-react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { toastManager } from "@workspace/ui/components/toast"
import { cn } from "@workspace/ui/lib/utils"

import type { Offering } from "@/lib/api"
import { CourseCard } from "./course-card"
import { CourseActionDrawer } from "./course-action-drawer"
import { extractWeekday } from "@/components/app/profile/schedule-util"
import { courseLine, escapeHtml } from "./sections"
import {
  GptDrawer,
  loadGpt,
  gptToUnits,
  gptToLabel,
} from "@/components/app/profile/gpt-drawer"

export function NotedDrawer({
  open,
  onOpenChange,
  notedOfferings,
  totalUnits,
  viewMode,
  onViewModeChange,
  onToggleNote,
  onAddAllToPassed,
  onClearNoted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  notedOfferings: Offering[]
  totalUnits: number
  viewMode: "full" | "simple"
  onViewModeChange: (mode: "full" | "simple") => void
  onToggleNote: (courseIndex: string) => void
  onAddAllToPassed: () => void
  onClearNoted: () => void
}) {
  const [actionsOpen, setActionsOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [addPassedOpen, setAddPassedOpen] = useState(false)
  const [clearListOpen, setClearListOpen] = useState(false)
  const [selected, setSelected] = useState<Offering | null>(null)
  const [gptOpen, setGptOpen] = useState(false)
  const [gpt, setGpt] = useState<10 | 12 | 20 | null>(null)

  useEffect(() => {
    if (!open) return
    setGpt(loadGpt())
  }, [open])

  const availableUnits = gptToUnits(gpt)
  const overLimit = availableUnits != null && totalUnits > availableUnits
  const gptLabel = gptToLabel(gpt)

  const sorted = useMemo(() => {
    const order = [
      "شنبه",
      "یکشنبه",
      "دوشنبه",
      "سه‌شنبه",
      "چهارشنبه",
      "پنجشنبه",
      "جمعه",
    ]
    return [...notedOfferings].sort((a, b) => {
      const da = order.indexOf(extractWeekday(a.classSchedule) ?? "")
      const db = order.indexOf(extractWeekday(b.classSchedule) ?? "")
      return (
        (da < 0 ? 99 : da) - (db < 0 ? 99 : db) ||
        (a.classSchedule ?? "").localeCompare(b.classSchedule ?? "")
      )
    })
  }, [notedOfferings])

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup variant="default" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>یادداشت های من</DrawerTitle>
            {sorted.length > 0 && (
              <DrawerDescription>
                جمع واحد های انتخابی: {totalUnits} واحد
              </DrawerDescription>
            )}
          </DrawerHeader>
          <DrawerPanel className="p-4">
            {sorted.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                هنوز درسی نشان نکرده‌اید
              </div>
            ) : (
              <>
                {gptLabel && (
                  <div
                    onClick={() => setGptOpen(true)}
                    className={cn(
                      "mb-4 flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:opacity-80",
                      overLimit
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-success/30 bg-success/5 text-success"
                    )}
                  >
                    <span>معدل ثبت شده: {gptLabel}</span>
                    <span className="text-muted-foreground">|</span>
                    <span
                      className={cn(
                        "font-bold",
                        overLimit && "text-destructive"
                      )}
                    >
                      {totalUnits}/{availableUnits} واحد
                    </span>
                  </div>
                )}
                <div className="mb-6 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setActionsOpen(true)}
                  >
                    عملیات
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="تغییر نمای لیست"
                    onClick={() =>
                      onViewModeChange(viewMode === "full" ? "simple" : "full")
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="7" height="7" x="3" y="3" rx="1" />
                      <rect width="7" height="7" x="14" y="3" rx="1" />
                      <rect width="7" height="7" x="14" y="14" rx="1" />
                      <rect width="7" height="7" x="3" y="14" rx="1" />
                    </svg>
                  </Button>
                </div>

                <div className="space-y-4">
                  {sorted.map((o) => (
                    <div key={o.index} onClick={(e) => e.stopPropagation()}>
                      <CourseCard
                        offering={o}
                        isNoted
                        isPassed={false}
                        isNew={false}
                        viewMode={viewMode}
                        onSelect={setSelected}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* ثبت معدل نیم‌سال (sibling drawer, like عملیات) */}
      <GptDrawer
        open={gptOpen}
        onOpenChange={(o) => {
          setGptOpen(o)
          if (!o) setGpt(loadGpt())
        }}
      />

      {/* single-course management (nested inset) */}
      <CourseActionDrawer
        offering={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onDelete={(index) => {
          onToggleNote(index)
          setSelected(null)
        }}
      />

      {/* عملیات (nested inset) */}
      <Drawer open={actionsOpen} onOpenChange={setActionsOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>عملیات</DrawerTitle>
            <DrawerDescription>
              عملیات های مدیریت لیست یادداشت ها
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-2 p-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setActionsOpen(false)
                setExportOpen(true)
              }}
            >
              خروجی
            </Button>
            <Button
              variant="success"
              className="w-full"
              onClick={() => {
                setActionsOpen(false)
                setAddPassedOpen(true)
              }}
            >
              افزودن به دروس پاس شده
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                setActionsOpen(false)
                setClearListOpen(true)
              }}
            >
              حذف همه
            </Button>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Export Drawer */}
      <ExportDrawer
        open={exportOpen}
        onOpenChange={setExportOpen}
        offerings={sorted}
      />

      {/* Add All to Passed Confirmation */}
      <Drawer open={addPassedOpen} onOpenChange={setAddPassedOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>افزودن به دروس پاس شده</DrawerTitle>
            <DrawerDescription>
              {sorted.length} درس به لیست دروس پاس شده اضافه می‌شود
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="p-4">
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAddPassedOpen(false)}
              >
                انصراف
              </Button>
              <Button
                variant="success"
                className="flex-1"
                onClick={() => {
                  onAddAllToPassed()
                  setAddPassedOpen(false)
                  toastManager.add({
                    type: "success",
                    title: "افزوده شد به دروس پاس شده",
                    data: { variant: "x" },
                  })
                }}
              >
                افزودن
              </Button>
            </div>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Clear List Confirmation */}
      <Drawer open={clearListOpen} onOpenChange={setClearListOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>پاک کردن لیست یادداشت</DrawerTitle>
            <DrawerDescription>
              آیا می‌خواهید همه دروس از لیست یادداشت حذف شوند؟
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="p-4">
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setClearListOpen(false)}
              >
                انصراف
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => {
                  onClearNoted()
                  setClearListOpen(false)
                  toastManager.add({
                    type: "success",
                    title: "لیست یادداشت پاک شد",
                    data: { variant: "x" },
                  })
                }}
              >
                حذف شود
              </Button>
            </div>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>
    </>
  )
}

// Export Drawer Component
function ExportDrawer({
  open,
  onOpenChange,
  offerings,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  offerings: Offering[]
}) {
  const [copiedFull, setCopiedFull] = useState(false)
  const [copiedNameUnit, setCopiedNameUnit] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [previewType, setPreviewType] = useState<
    "full" | "nameUnit" | "code" | null
  >(null)

  const getFullText = () =>
    offerings.map((o) => courseLine(o, "full")).join("\n\n")
  const getNameUnitText = () =>
    offerings.map((o) => courseLine(o, "nameUnit")).join("\n")
  const getCodeText = () =>
    offerings.map((o) => courseLine(o, "code")).join(", ")

  const getPreviewContent = (type: "full" | "nameUnit" | "code") => {
    let content = ""
    switch (type) {
      case "full":
        content = getFullText()
        break
      case "nameUnit":
        content = getNameUnitText()
        break
      case "code":
        content = getCodeText()
        break
    }
    return escapeHtml(content).replace(/\n/g, "<br>")
  }

  return (
    <>
      <Drawer open={open && !previewType} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>عملیات خروجی</DrawerTitle>
            <DrawerDescription>
              از این بخش می‌توانید تمامی اطلاعات لیست خود را با فرمت دلخواه
              خروجی بگیرید
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-2 p-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(getFullText())
                  setCopiedFull(true)
                  setTimeout(() => setCopiedFull(false), 2000)
                }}
              >
                {copiedFull ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copiedFull ? "کپی شد!" : "کل جزئیات همه"}</span>
              </Button>
              <Button
                variant="blue-subtle"
                className="text-sm"
                onClick={() => setPreviewType("full")}
              >
                <Eye className="size-4" />
                پیش نمایش
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(getNameUnitText())
                  setCopiedNameUnit(true)
                  setTimeout(() => setCopiedNameUnit(false), 2000)
                }}
              >
                {copiedNameUnit ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>
                  {copiedNameUnit ? "کپی شد!" : "اسم همه + واحد + کد درس"}
                </span>
              </Button>
              <Button
                variant="blue-subtle"
                className="text-sm"
                onClick={() => setPreviewType("nameUnit")}
              >
                <Eye className="size-4" />
                پیش نمایش
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard.writeText(getCodeText())
                  setCopiedCode(true)
                  setTimeout(() => setCopiedCode(false), 2000)
                }}
              >
                {copiedCode ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copiedCode ? "کپی شد!" : "کد درس همه"}</span>
              </Button>
              <Button
                variant="blue-subtle"
                className="text-sm"
                onClick={() => setPreviewType("code")}
              >
                <Eye className="size-4" />
                پیش نمایش
              </Button>
            </div>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Preview Drawer */}
      <Drawer open={!!previewType} onOpenChange={() => setPreviewType(null)}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>
              پیش نمایش{" "}
              {previewType === "full"
                ? "کل جزئیات"
                : previewType === "nameUnit"
                  ? "اسم واحد و کد درس"
                  : "کد دروس"}
            </DrawerTitle>
            <DrawerDescription>متن زیر کپی میشود</DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="p-4">
            <div className="rounded-md bg-card p-4">
              <div
                dangerouslySetInnerHTML={{
                  __html: previewType ? getPreviewContent(previewType) : "",
                }}
              />
            </div>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>
    </>
  )
}
