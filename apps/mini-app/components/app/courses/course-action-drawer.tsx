"use client"

import { useState } from "react"
import { Copy, Trash2 } from "lucide-react"

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

import type { Offering } from "@/lib/api"
import { useCourseActionTerm } from "./course-action/use-course-action"
import { ConflictGroupCard } from "./course-action/conflict-actions"
import {
  ExportPanel,
  MainActions,
} from "./course-action/course-action-panels"
import { TermPickerDrawer } from "./course-action/term-picker-drawer"

function CourseActionMainContent({
  offering,
  relatedGroups,
  isLastTerm,
  profileTerm,
  onExport,
  onDelete,
  onTermPicker,
}: {
  offering: Offering
  relatedGroups: import("./conflict-detect").CourseConflict[]
  isLastTerm?: boolean
  profileTerm?: number | null
  onExport: () => void
  onDelete: (idx: string) => void
  onTermPicker: () => void
}) {
  if (relatedGroups.length > 0) {
    return <ConflictContent offering={offering} groups={relatedGroups} isLastTerm={isLastTerm} profileTerm={profileTerm} onExport={onExport} onDelete={onDelete} onTermPicker={onTermPicker} />
  }
  return <MainActions offering={offering} onDelete={onDelete} onExport={onExport} />
}

function ConflictContent({
  offering,
  groups,
  isLastTerm,
  profileTerm,
  onExport,
  onDelete,
  onTermPicker,
}: {
  offering: Offering
  groups: import("./conflict-detect").CourseConflict[]
  isLastTerm?: boolean
  profileTerm?: number | null
  onExport: () => void
  onDelete: (idx: string) => void
  onTermPicker: () => void
}) {
  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <ConflictGroupCard key={group.id} group={group} isLastTerm={isLastTerm} profileTerm={profileTerm} onTermOpen={onTermPicker} />
      ))}
      <Button variant="outline" className="w-full" onClick={onExport}>
        <Copy className="size-4" />
        خروجی
      </Button>
      <Button
        variant="destructive"
        className="w-full"
        onClick={() => {
          onDelete(offering.index)
          toastManager.add({ type: "success", title: "حذف شد از یادداشت‌ها", data: { variant: "x" } })
        }}
      >
        <Trash2 className="size-5" />
        حذف از یادداشت
      </Button>
    </div>
  )
}

/** Single-course management drawer (nested/inset), with export + share + delete.
 *  When opened from conflicts, shows conflict-specific actions (pre/co, moaref isLastTerm). */
export function CourseActionDrawer({
  offering,
  open,
  onOpenChange,
  onDelete,
  conflictGroups,
  isLastTerm,
}: {
  offering: Offering | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (courseIndex: string) => void
  conflictGroups?: import("./conflict-detect").CourseConflict[]
  isLastTerm?: boolean
}) {
  const [exportOpen, setExportOpen] = useState(false)
  const [previewType, setPreviewType] = useState<
    "full" | "nameUnit" | "code" | null
  >(null)
  const [termPickerOpen, setTermPickerOpen] = useState(false)
  const { profile, patchMut } = useCourseActionTerm()

  const relatedGroups =
    conflictGroups?.filter((g) =>
      g.courses.some((c) => c.index === offering?.index)
    ) ?? []

  // Always render - control via open prop for smooth animation
  return (
    <>
      <Drawer open={open && !exportOpen} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>مدیریت درس</DrawerTitle>
            <DrawerDescription>
              در این بخش می‌توانید عملیات مختلفی را روی این درس انجام دهید
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-2 p-4">
            {offering && (
              <CourseActionMainContent
                offering={offering}
                relatedGroups={relatedGroups}
                isLastTerm={isLastTerm}
                profileTerm={profile?.termNumber}
                onExport={() => setExportOpen(true)}
                onDelete={onDelete}
                onTermPicker={() => setTermPickerOpen(true)}
              />
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <ExportPanel
        offering={offering}
        open={exportOpen}
        onOpenChange={setExportOpen}
        previewType={previewType}
        setPreviewType={setPreviewType}
      />

      <TermPickerDrawer
        open={termPickerOpen}
        onOpenChange={setTermPickerOpen}
        value={profile?.termNumber ?? null}
        onSelect={(n) => {
          patchMut.mutate({ termNumber: n })
          setTermPickerOpen(false)
        }}
        disabled={patchMut.isPending}
        pendingValue={
          patchMut.isPending
            ? (patchMut.variables as { termNumber?: number })?.termNumber ?? null
            : null
        }
      />
    </>
  )
}
