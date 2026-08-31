"use client"

import { useState } from "react"
import { UserPlus, Share2 } from "lucide-react"

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

export default function InviteFriends() {
  const [open, setOpen] = useState(false)
  const shareUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://t.me/studenthub_bot"

  const handleShare = async () => {
    const text = "اجرای اپلیکیشن دانشجویار"
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<UserPlus className="size-5" />}
            title="دعوت دوستان"
            description="کمک به رشد اپلیکیشن"
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>دعوت دوستان</DrawerTitle>
          <DrawerDescription>
            با دعوت دوستان خود به اپلیکیشن کمک کنید تا بهتر و کامل‌تر شود
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          <div className="space-y-4 p-4">
            <div className="rounded-lg border bg-card p-4 text-center">
              <Share2 className="mx-auto size-10 text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">
                لینک دعوت را برای دوستان خود ارسال کنید
              </p>
              <p className="mt-1 font-mono text-xs break-all">{shareUrl}</p>
            </div>
            <Button className="w-full" onClick={handleShare}>
              ارسال لینک دعوت
            </Button>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
