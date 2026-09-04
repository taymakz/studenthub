"use client"

import * as React from "react"

interface MainTabWarmupContextValue {
  enabled: boolean
  reportStarted: () => void
  reportReady: () => void
}

const MainTabWarmupContext =
  React.createContext<MainTabWarmupContextValue | null>(null)
const DEFAULT_MAIN_TAB_WARMUP: MainTabWarmupContextValue = {
  enabled: false,
  reportStarted: () => undefined,
  reportReady: () => undefined,
}

export function MainTabWarmupProvider({
  children,
  value,
}: Readonly<{
  children: React.ReactNode
  value: MainTabWarmupContextValue
}>) {
  return (
    <MainTabWarmupContext.Provider value={value}>
      {children}
    </MainTabWarmupContext.Provider>
  )
}

export function useMainTabWarmup(): MainTabWarmupContextValue {
  return React.useContext(MainTabWarmupContext) ?? DEFAULT_MAIN_TAB_WARMUP
}
