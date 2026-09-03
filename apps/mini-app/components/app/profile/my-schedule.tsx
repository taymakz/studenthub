"use client"

import { useState } from "react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { SettingsOptionRow } from "@/components/app/theme/settings-row"
import { ToolButton } from "./tool-card"
import {
  CalendarExamIcon,
  CalendarWeekIcon,
  MyScheduleIcon,
} from "./tool-icons"
import { OPEN_EXAM_SCHEDULE_EVENT } from "./exam-schedule"
import { OPEN_WEEKLY_SCHEDULE_EVENT } from "./weekly-schedule"

/**
 * Combined «برنامه من» tool button. Opens a chooser drawer (هفتگی /
 * امتحانی) which then opens the previously-separate schedule drawer via
 * window events — the schedule components stay mounted with hidden triggers.
 */
export function MySchedule() {
  const [open, setOpen] = useState(false)

  const pick = (kind: "weekly" | "exam") => {
    setOpen(false)
    window.dispatchEvent(
      new Event(
        kind === "weekly" ? OPEN_WEEKLY_SCHEDULE_EVENT : OPEN_EXAM_SCHEDULE_EVENT
      )
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={<ToolButton title="برنامه من" icon={MyScheduleIcon} />}
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>برنامه من</DrawerTitle>
          <DrawerDescription>کدام برنامه را می‌خواهید ببینید؟</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <div className="mb-4 flex flex-col">
            <SettingsOptionRow
              icon={CalendarWeekIcon}
              label="برنامه هفتگی"
              selected={false}
              onSelect={() => pick("weekly")}
            />
            <SettingsOptionRow
              icon={CalendarExamIcon}
              label="برنامه امتحانی"
              selected={false}
              onSelect={() => pick("exam")}
            />
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
