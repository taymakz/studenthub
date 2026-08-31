"use client"

import { useState } from "react"
import { Users, ExternalLink } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"

import { SettingsRow } from "@/components/app/theme/settings-row"
import { GITHUB_REPO_URL } from "@/constants"

const developers = [
  {
    name: "تایماز اکبری",
    role: "Software Engineer",
    avatar: "https://avatars.githubusercontent.com/u/71381670?v=4",
    website: "https://taymakz.ir",
    github: "https://github.com/taymakz",
  },
  {
    name: "عماد محققی",
    role: "Frontend Developer",
    avatar: "https://avatars.githubusercontent.com/u/140918379?v=4",
    website: "https://emadmo.ir",
    github: "https://github.com/emadmo",
  },
]

export default function SettingsDevelopers() {
  const [open, setOpen] = useState(false)
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<Users className="size-5" />}
            title="توسعه‌دهندگان"
            description="تیم توسعه دانشجویار"
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>توسعه‌دهندگان</DrawerTitle>
          <DrawerDescription>
            تیم توسعه‌دهنده پلتفرم دانشجویار
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          <div className="space-y-3">
            {developers.map((dev) => (
              <div key={dev.name} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarImage src={dev.avatar} alt={dev.name} />
                      <AvatarFallback>{dev.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-sm font-semibold">{dev.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {dev.role}
                      </p>
                    </div>
                  </div>
                  <a
                    href={dev.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {dev.website.replace("https://", "")}{" "}
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ))}

            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <h4 className="text-sm font-medium">مشارکت در پروژه</h4>
              <p className="text-xs leading-6 text-muted-foreground">
                دانشجویار اوپن‌سورس است. برای افزودن دانشگاه، رشته یا چارت جدید
                تنها کافیست یک Pull Request ارسال کنید.
              </p>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                مشاهده ریپازیتوری <ExternalLink className="size-3" />
              </a>
              <div className="pt-2">
                <a
                  href={`${GITHUB_REPO_URL}/blob/main/CONTRIBUTING.md`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  راهنمای مشارکت
                </a>
              </div>
            </div>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
