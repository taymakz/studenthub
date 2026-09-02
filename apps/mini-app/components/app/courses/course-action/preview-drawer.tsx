"use client"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import type { Offering } from "@/lib/api"
import { courseLine } from "./../course-format"

export function PreviewDrawer({
  offering,
  previewType,
  onClose,
}: {
  offering: Offering | null
  previewType: "full" | "nameUnit" | "code" | null
  onClose: () => void
}) {
  return (
    <Drawer open={!!previewType} onOpenChange={() => onClose()}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader className="text-center">
          <DrawerTitle>
            پیش نمایش{" "}
            {previewType === "full" ? "کل جزئیات" : previewType === "nameUnit" ? "اسم واحد و کد درس" : "کد درس"}
          </DrawerTitle>
          <DrawerDescription>متن زیر کپی میشود</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          <div className="rounded-md bg-card p-4">
            <div className="whitespace-pre-line">
              {previewType && offering ? courseLine(offering, previewType) : ""}
            </div>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
