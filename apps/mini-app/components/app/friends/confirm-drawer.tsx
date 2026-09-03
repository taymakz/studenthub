"use client"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"

/** Generic inset confirmation drawer (accept / decline / block / unblock …). */
export function ConfirmDrawer({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  danger = false,
  pending = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel: string
  danger?: boolean
  pending?: boolean
  onConfirm: () => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? (
            <DrawerDescription>{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <DrawerPanel className="p-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant={danger ? "destructive" : "default"}
              className="flex-1"
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? <Spinner /> : confirmLabel}
            </Button>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
