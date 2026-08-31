"use client"

import { useState } from "react"
import { LifeBuoy } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"

import { SettingsRow } from "@/components/app/theme/settings-row"

export default function ContactSupport() {
  const [open, setOpen] = useState(false)
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<LifeBuoy className="size-5" />}
            title="پشتیبانی"
            description="ارتباط با تیم پشتیبانی"
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>پشتیبانی</DrawerTitle>
          <DrawerDescription>
            برای ارتباط با پشتیبانی از طریق تلگرام پیام دهید
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          <Button
            className="w-full"
            nativeButton={false}
            render={
              <a
                href="https://t.me/studenthubir?direct"
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            ارسال پیام
          </Button>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
