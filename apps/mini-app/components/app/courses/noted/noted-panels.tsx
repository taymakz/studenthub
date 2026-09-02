"use client"

import { Drawer, DrawerDescription, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle } from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { toastManager } from "@workspace/ui/components/toast"

export function ActionsDrawer({ open, onOpenChange, onExport, onAddPassed, onClear }: { open: boolean; onOpenChange: (o: boolean) => void; onExport: () => void; onAddPassed: () => void; onClear: () => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar><DrawerHeader className="text-center"><DrawerTitle>عملیات</DrawerTitle><DrawerDescription>عملیات های مدیریت لیست یادداشت ها</DrawerDescription></DrawerHeader><DrawerPanel className="space-y-2 p-4">
        <Button variant="outline" className="w-full" onClick={()=>{ onOpenChange(false); onExport()}}>خروجی</Button>
        <Button variant="success" className="w-full" onClick={()=>{ onOpenChange(false); onAddPassed()}}>افزودن به دروس پاس شده</Button>
        <Button variant="destructive" className="w-full" onClick={()=>{ onOpenChange(false); onClear()}}>حذف همه</Button>
      </DrawerPanel></DrawerPopup>
    </Drawer>
  )
}

export function ConfirmAddPassed({ open, onOpenChange, count, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; count: number; onConfirm: () => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar><DrawerHeader className="text-center"><DrawerTitle>افزودن به دروس پاس شده</DrawerTitle><DrawerDescription>{count} درس به لیست دروس پاس شده اضافه می‌شود</DrawerDescription></DrawerHeader><DrawerPanel className="p-4"><div className="flex gap-4"><Button variant="outline" className="flex-1" onClick={()=>onOpenChange(false)}>انصراف</Button><Button variant="success" className="flex-1" onClick={()=>{ onConfirm(); onOpenChange(false); toastManager.add({ type:"success", title:"افزوده شد به دروس پاس شده", data:{variant:"x"}})}}>افزودن</Button></div></DrawerPanel></DrawerPopup>
    </Drawer>
  )
}

export function ConfirmClear({ open, onOpenChange, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar><DrawerHeader className="text-center"><DrawerTitle>پاک کردن لیست یادداشت</DrawerTitle><DrawerDescription>آیا می‌خواهید همه دروس از لیست یادداشت حذف شوند؟</DrawerDescription></DrawerHeader><DrawerPanel className="p-4"><div className="flex gap-4"><Button variant="outline" className="flex-1" onClick={()=>onOpenChange(false)}>انصراف</Button><Button variant="destructive" className="flex-1" onClick={()=>{ onConfirm(); onOpenChange(false); toastManager.add({ type:"success", title:"لیست یادداشت پاک شد", data:{variant:"x"}})}}>حذف شود</Button></div></DrawerPanel></DrawerPopup>
    </Drawer>
  )
}
