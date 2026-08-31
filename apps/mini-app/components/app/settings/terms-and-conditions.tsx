"use client"

import { useState } from "react"
import { FileText } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { SettingsRow } from "@/components/app/theme/settings-row"

export default function TermsAndConditions() {
  const [open, setOpen] = useState(false)
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<FileText className="size-5" />}
            title="قوانین و مقررات"
            description="شرایط استفاده از اپلیکیشن"
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>قوانین و مقررات</DrawerTitle>
          <DrawerDescription>شرایط استفاده از دانشجویار</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          <div className="space-y-3 p-4 text-sm leading-6 text-muted-foreground">
            <p>
              با استفاده از دانشجویار، شما با ذخیره اطلاعات درسی خود در اپلیکیشن
              موافقت می‌کنید.
            </p>
            <p>
              اطلاعات شما تنها برای نمایش چارت و ارائه‌ها استفاده می‌شود و با
              شخص ثالثی به اشتراک گذاشته نمی‌شود.
            </p>
            <p>
              در صورت تخلف یا ارسال محتوای نامناسب، حساب کاربری شما ممکن است
              مسدود شود.
            </p>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
