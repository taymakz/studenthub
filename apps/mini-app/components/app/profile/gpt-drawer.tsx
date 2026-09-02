"use client"

import { useState } from "react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { cn } from "@workspace/ui/lib/utils"

import { GPT_OPTIONS, loadGpt, saveGpt, type Gpt } from "./gpt"

interface GptDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GptDrawer({ open, onOpenChange }: GptDrawerProps) {
  const [gpt, setGpt] = useState<Gpt | null>(null)

  // Re-read localStorage whenever the drawer opens: render-phase adjustment
  // per react.dev "you might not need an effect" — no effect, no cascading
  // setState-after-paint.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setGpt(loadGpt())
  }

  const selectedGpt = GPT_OPTIONS.find((o) => o.value === gpt)

  const handleSelect = (value: Gpt) => {
    const next = gpt === value ? null : value
    setGpt(next)
    saveGpt(next)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>
            {gpt ? "ویرایش معدل نیم‌سال" : "ثبت معدل نیم‌سال"}
          </DrawerTitle>
          <DrawerDescription>
            {selectedGpt
              ? `مجاز به انتخاب ${selectedGpt.available} واحد`
              : "برای کارکرد بهتر، وضعیت معدل خود را وارد کنید"}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          <div className="grid grid-cols-3 gap-2">
            {GPT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "flex h-11 items-center justify-center rounded-md border bg-card text-sm font-medium transition-colors",
                  gpt === opt.value
                    ? "border-primary text-primary"
                    : "hover:border-primary/50"
                )}
              >
                {opt.title}
              </button>
            ))}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
