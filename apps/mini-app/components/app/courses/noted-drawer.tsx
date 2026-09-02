"use client"

import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Drawer, DrawerPopup, DrawerHeader, DrawerTitle, DrawerDescription, DrawerPanel } from "@workspace/ui/components/drawer"
import { cn } from "@workspace/ui/lib/utils"

import type { Offering } from "@/lib/api"
import { CourseCard } from "./course-card"
import { CourseActionDrawer } from "./course-action-drawer"
import { GptDrawer } from "@/components/app/profile/gpt-drawer"
import { loadGpt, gptToUnits, gptToLabel } from "@/components/app/profile/gpt"
import { useNotedSort } from "./noted/use-noted-sort"
import { NotedExportDrawer } from "./noted/noted-export"
import { ActionsDrawer, ConfirmAddPassed, ConfirmClear } from "./noted/noted-panels"

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

  // Re-read the stored GPT whenever the drawer opens — render-phase
  // adjustment (react.dev "you might not need an effect") instead of a
  // setState-in-effect that causes an extra render after paint.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setGpt(loadGpt())
  }

  const availableUnits = gptToUnits(gpt)
  const overLimit = availableUnits != null && totalUnits > availableUnits
  const gptLabel = gptToLabel(gpt)
  const sorted = useNotedSort(notedOfferings)

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
                  <button
                    type="button"
                    onClick={() => setGptOpen(true)}
                    className={cn(
                      "mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:opacity-80",
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
                  </button>
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
                        viewMode={viewMode}
                        onSelect={setSelected}
                        flags={{ noted: true, passed: false, new: false }}
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

      <ActionsDrawer open={actionsOpen} onOpenChange={setActionsOpen} onExport={()=>setExportOpen(true)} onAddPassed={()=>setAddPassedOpen(true)} onClear={()=>setClearListOpen(true)} />
      <NotedExportDrawer open={exportOpen} onOpenChange={setExportOpen} offerings={sorted} />
      <ConfirmAddPassed open={addPassedOpen} onOpenChange={setAddPassedOpen} count={sorted.length} onConfirm={onAddAllToPassed} />
      <ConfirmClear open={clearListOpen} onOpenChange={setClearListOpen} onConfirm={onClearNoted} />
    </>
  )
}
