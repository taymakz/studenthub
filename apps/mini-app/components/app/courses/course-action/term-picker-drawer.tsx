"use client"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import { TermNumberPicker } from "@/components/app/settings/term-number-picker"

export function TermPickerDrawer({
  open,
  onOpenChange,
  value,
  onSelect,
  disabled,
  pendingValue,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  value: number | null
  onSelect: (n: number) => void
  disabled: boolean
  pendingValue: number | null
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>انتخاب ترم</DrawerTitle>
          <DrawerDescription>ترم فعلی خود را انتخاب کنید</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <TermNumberPicker value={value} onSelect={onSelect} disabled={disabled} pendingValue={pendingValue} />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
