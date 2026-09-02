"use client"

import { Drawer, DrawerDescription, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle } from "@workspace/ui/components/drawer"
import { StatusButton } from "@workspace/ui/components/status-button"

export function ThemeDrawer({ open, onOpenChange, onExport }: { open: boolean; onOpenChange: (o: boolean) => void; onExport: (isDark: boolean) => Promise<void> }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar><DrawerHeader className="text-center"><DrawerTitle>خروجی عکس</DrawerTitle><DrawerDescription>عکس با چه حالتی ساخته شود؟</DrawerDescription></DrawerHeader><DrawerPanel className="space-y-2 p-4">
        <StatusButton className="w-full" variant="outline" successLabel="ارسال شد" onClick={()=>onExport(true)}>حالت تیره</StatusButton>
        <StatusButton className="w-full" successLabel="ارسال شد" onClick={()=>onExport(false)}>حالت روشن</StatusButton>
      </DrawerPanel></DrawerPopup>
    </Drawer>
  )
}
