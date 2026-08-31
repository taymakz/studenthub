"use client"
/* eslint-disable @next/next/no-img-element -- reicon CDN logos are external SVGs */

import { useState } from "react"
import { Code2 } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { Card } from "@workspace/ui/components/card"

import { SettingsRow } from "@/components/app/theme/settings-row"

const techStacks = [
  {
    titlePersian: "فرانت‌اند",
    titleEnglish: "Frontend",
    items: [
      { name: "TypeScript", description: "Language", logo: "typescript" },
      { name: "React", description: "Library", logo: "react" },
      { name: "Next.js", description: "Framework", logo: "nextjs" },
      { name: "Tailwind CSS", description: "Styling", logo: "tailwindcss" },
      { name: "Motion", description: "Animation", logo: "framer" },
    ],
  },
  {
    titlePersian: "بک‌اند",
    titleEnglish: "Backend",
    items: [
      { name: "Bun", description: "Runtime", logo: "bun" },
      { name: "Hono", description: "Framework", logo: "hono" },
      { name: "Drizzle ORM", description: "Database", logo: "drizzle" },
      { name: "PostgreSQL", description: "Database", logo: "postgresql" },
      { name: "REST API", description: "Architecture", logo: "openapi" },
    ],
  },
]

export default function SettingsStack() {
  const [open, setOpen] = useState(false)
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<Code2 className="size-5" />}
            title="تکنولوژی‌های استفاده شده"
            description="استک فنی اپلیکیشن"
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>تکنولوژی‌های استفاده شده</DrawerTitle>
          <DrawerDescription>
            فناوری‌ها و ابزارهای استفاده شده در ساخت این اپلیکیشن
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          <div className="space-y-4">
            {techStacks.map((section) => (
              <div key={section.titleEnglish} className="space-y-3">
                <div className="flex justify-between font-medium text-primary">
                  <p>{section.titlePersian}</p>
                  <p className="font-sans">{section.titleEnglish}</p>
                </div>
                <div className="grid grid-cols-2 gap-3" dir="ltr">
                  {section.items.map((item) => (
                    <Card
                      key={item.name}
                      className="flex flex-row items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                        <img
                          src={`https://cdn.reicon.dev/logos/${item.logo}/original.svg`}
                          alt={item.name}
                          width={24}
                          height={24}
                          loading="lazy"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
