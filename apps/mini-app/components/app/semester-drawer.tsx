"use client"

import { useEffect, useState } from "react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { useProfileStore } from "@/stores/profile-store"
import { toastManager } from "@workspace/ui/components/toast"
import { useSemesterData } from "./semester-drawer/use-semester-data"
import { SemesterList } from "./semester-drawer/semester-list"

interface SemesterDrawerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement
  children?: React.ReactElement
}

function useSemesterOpen(setOpen: (v: boolean) => void) {
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-profile-semester-drawer", handler)
    window.addEventListener("open-semester-drawer", handler)
    return () => {
      window.removeEventListener("open-profile-semester-drawer", handler)
      window.removeEventListener("open-semester-drawer", handler)
    }
  }, [setOpen])
}

async function handleSelectCode(code: string, setOpen: (v: boolean) => void) {
  try {
    await useProfileStore.getState().setSemester(code)
    toastManager.add({ type: "success", title: "نیم‌سال تغییر کرد", data: { variant: "x" } })
    setOpen(false)
  } catch {
    toastManager.add({ type: "error", title: "خطا در تغییر نیم‌سال", data: { variant: "x" } })
  }
}

function SemesterDrawerInner({ open, setOpen, trigger, children }: { open: boolean; setOpen: (v: boolean) => void; trigger?: React.ReactElement; children?: React.ReactElement }) {
  const { profile, termsQuery, terms, newerCode } = useSemesterData(open)
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {trigger && <DrawerTrigger render={trigger} />}
      {children && <DrawerTrigger render={children} />}
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>انتخاب نیم‌سال</DrawerTitle>
          <DrawerDescription>نیم‌سال مورد نظر را انتخاب کنید</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-2 p-4">
          <SemesterList terms={terms} currentCode={profile?.currentSemesterCode} newerCode={newerCode} isLoading={termsQuery.isLoading} onSelect={(c) => handleSelectCode(c, setOpen)} />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

export function SemesterDrawer({ open: controlledOpen, onOpenChange, trigger, children }: SemesterDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  useSemesterOpen(setOpen)
  return (
    <SemesterDrawerInner open={open} setOpen={setOpen} trigger={trigger}>
      {children}
    </SemesterDrawerInner>
  )
}
