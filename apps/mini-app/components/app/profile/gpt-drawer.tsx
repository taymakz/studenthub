"use client"

import { useEffect, useState } from "react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { cn } from "@workspace/ui/lib/utils"

export type Gpt = 10 | 12 | 20

export const GPT_OPTIONS: Array<{
  title: string
  value: Gpt
  available: number
}> = [
  { title: "مشروط", value: 10, available: 14 },
  { title: "متوسط", value: 12, available: 20 },
  { title: "الف", value: 20, available: 24 },
]

export const GPT_KEY = "user-gpt"

export function loadGpt(): Gpt | null {
  if (typeof window === "undefined") return null
  const v = Number(localStorage.getItem(GPT_KEY))
  return v === 10 || v === 12 || v === 20 ? (v as Gpt) : null
}

export function saveGpt(value: Gpt | null) {
  try {
    if (value === null) {
      localStorage.removeItem(GPT_KEY)
    } else {
      localStorage.setItem(GPT_KEY, String(value))
    }
  } catch {
    /* storage unavailable */
  }
}

export function gptToUnits(gpt: Gpt | null): number | null {
  return gpt === 10 ? 14 : gpt === 12 ? 20 : gpt === 20 ? 24 : null
}

export function gptToLabel(gpt: Gpt | null): string | null {
  return gpt === 10 ? "مشروط" : gpt === 12 ? "متوسط" : gpt === 20 ? "الف" : null
}

interface GptDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GptDrawer({ open, onOpenChange }: GptDrawerProps) {
  const [gpt, setGpt] = useState<Gpt | null>(null)

  useEffect(() => {
    if (!open) return
    setGpt(loadGpt())
  }, [open])

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
