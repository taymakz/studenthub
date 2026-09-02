"use client"

import { useState } from "react"
import { flushSync } from "react-dom"
import { useTheme } from "next-themes"
import { MonitorSmartphone, Sun, Moon } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { SettingsRow, SettingsOptionRow } from "./settings-row"

const OPTIONS = [
  { value: "system", label: "مطابق با سیستم عامل", Icon: MonitorSmartphone },
  { value: "light", label: "حالت روز", Icon: Sun },
  { value: "dark", label: "حالت شب", Icon: Moon },
] as const

/**
 * View-transitioned theme switch - port of the old ChangeTheme, including
 * the flushSync-wrapped transition so the crossfade animates the real paint.
 */
export default function ChangeTheme() {
  const [isOpen, setIsOpen] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()

  const handleThemeChange = (newTheme: string) => {
    const isAppearanceTransition =
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (!isAppearanceTransition) {
      setTheme(newTheme)
      return
    }

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light"
    const targetResolvedTheme = newTheme === "system" ? systemTheme : newTheme

    // Same look already active - flip the preference without a transition.
    if (resolvedTheme === targetResolvedTheme) {
      setTheme(newTheme)
      return
    }

    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(newTheme)
      })
    })
  }

  const description =
    theme === "dark"
      ? "تاریک"
      : theme === "light"
        ? "روشن"
        : "مطابق با سیستم عامل"

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<SunMoon className="size-5" />}
            title="حالت نمایش"
            description={description}
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>حالت نمایش</DrawerTitle>
          <DrawerDescription>انتخاب حالت نمایش اپلیکیشن</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <div className="flex flex-col">
            {OPTIONS.map(({ value, label, Icon }) => (
              <SettingsOptionRow
                key={value}
                icon={Icon}
                label={label}
                selected={theme === value}
                onSelect={() => handleThemeChange(value)}
              />
            ))}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

function SunMoon({ className }: { className?: string }) {
  // Lucide's SunMoon equivalent (day/night dial).
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4Z" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </svg>
  )
}
