"use client"
/* eslint-disable react-hooks/set-state-in-effect -- hydration sync from localStorage */

import * as React from "react"

export interface ColorPaletteOption {
  value: string
  label: string
}

/**
 * The available accent palettes. «دانشجویار» is the default token set from
 * @workspace/ui; the others are CSS classes that re-scope --primary locally.
 */
export const COLOR_PALETTES: ColorPaletteOption[] = [
  { value: "studenthub", label: "دانشجویار" },
  { value: "theme-indigo", label: "نیلی" },
  { value: "theme-violet", label: "بنفش" },
  { value: "theme-pink", label: "صورتی" },
  { value: "theme-fuchsia", label: "ارغوانی" },
  { value: "theme-sky", label: "آبی آسمانی" },
  { value: "theme-cyan", label: "فیروزه‌ای" },
  { value: "theme-emerald", label: "سبز نخودی" },
  { value: "theme-emerald-hard", label: "سبز پررنگ" },
  { value: "theme-red", label: "قرمز" },
  { value: "theme-orange", label: "نارنجی" },
  { value: "theme-yellow", label: "زرد" },
  { value: "theme-amber", label: "کهربایی" },
  { value: "theme-lime", label: "لایم" },
]

const STORAGE_KEY = "sh-color-theme"

// Computed once in a single pass — every non-default palette class that must
// be removed from <html> before applying a new one.
const REMOVABLE_THEME_CLASSES: string[] = []
for (const t of COLOR_PALETTES) {
  if (t.value !== "studenthub") REMOVABLE_THEME_CLASSES.push(t.value)
}

function readStored(): string {
  if (typeof window === "undefined") return "studenthub"
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "studenthub"
  } catch {
    return "studenthub"
  }
}

/**
 * Hydration-safe: server and initial client render both use "studenthub",
 * then after mount we sync from localStorage (no mismatch).
 */
export function useColorTheme() {
  const [colorTheme, setColorThemeState] = React.useState("studenthub")

  React.useEffect(() => {
    const stored = readStored()
    if (stored !== "studenthub") {
      setColorThemeState(stored)
    }
    applyToRoot(stored)
  }, [])

  const setColorTheme = React.useCallback((next: string) => {
    setColorThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage blocked */
    }
    // Apply immediately for snappy feedback (also handled by effect on mount).
    applyToRoot(next)
  }, [])

  return { colorTheme, setColorTheme }
}

function applyToRoot(value: string) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.classList.remove(...REMOVABLE_THEME_CLASSES)
  if (value && value !== "studenthub") root.classList.add(value)
}
