"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { cn } from "@workspace/ui/lib/utils"
import type { IconFunction } from "reicon/createIcon"
import { Monitor } from "reicon/icons/Monitor"
import { Moon } from "reicon/icons/Moon"
import { Sun } from "reicon/icons/Sun"

/** Renders a reicon function as inline SVG at icon size. */
function Reicon({ icon, size = 12 }: { icon: IconFunction; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex [&_svg]:block"
      dangerouslySetInnerHTML={{ __html: icon.toSvg({ size }) }}
    />
  )
}

const OPTIONS = [
  { value: "system", label: "سیستم", icon: Monitor },
  { value: "dark", label: "تاریک", icon: Moon },
  { value: "light", label: "روشن", icon: Sun },
] as const

/** «ظاهر» row under the profile switcher in the sidebar header: three small
    same-bordered icon buttons for system / dark / light. The "d" keyboard
    shortcut still flips dark/light. */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount gate
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div
        aria-hidden
        className="flex h-7 items-center justify-between px-4 pt-1 pb-3"
      >
        <span className="h-7 w-[4.6rem] rounded-lg" />
      </div>
    )
  }

  return (
    <div
      role="radiogroup"
      aria-label="ظاهر برنامه"
      className="flex items-center justify-between px-4 pt-1 pb-3"
    >
      <span className="text-[11px] font-medium text-muted-foreground">
        ظاهر
      </span>
      {/* Shared border-only wrapper around the three options. */}
      <div className="flex w-fit items-center gap-0.5 rounded-lg border border-border/60">
        {OPTIONS.map((option) => {
          const active = theme === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={option.label}
              onClick={() => setTheme(option.value)}
              className={cn(
                "flex size-5.5 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:text-foreground"
              )}
            >
              <Reicon icon={option.icon} />
              <span className="sr-only">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
