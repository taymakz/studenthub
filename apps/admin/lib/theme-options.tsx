import { MonitorIcon, Moon, Sun } from "lucide-react"

/** Single source of truth for theme picker UIs (user dropdown, preferences
    select). Values match next-themes' `setTheme`. */
export const THEME_OPTIONS = [
  { value: "system", label: "ظاهر سیستمی", icon: MonitorIcon },
  { value: "dark", label: "ظاهر تیره", icon: Moon },
  { value: "light", label: "ظاهر روشن", icon: Sun },
] as const

export type ThemeValue = (typeof THEME_OPTIONS)[number]["value"]
