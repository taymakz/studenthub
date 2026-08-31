"use client"

import ChangeTheme from "@/components/app/theme/change-theme"
import ColorPalette from "@/components/app/theme/color-palette"

/** Old ThemeSettingsSlide - the two settings rows live right in the slide. */
export function ThemeSettingsSlide() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 pb-6 sm:gap-4 sm:pb-12">
      <div className="w-full max-w-sm divide-y">
        <ChangeTheme />
        <ColorPalette />
      </div>
    </div>
  )
}
