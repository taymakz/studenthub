"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/** Class-based theming on <html> - keeps .dark and .theme-* scopes working. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
