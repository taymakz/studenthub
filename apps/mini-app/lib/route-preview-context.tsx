"use client"

import * as React from "react"
import type { MotionValue } from "motion/react"

interface RoutePageContextValue {
  isPreview: boolean
  overlayHost: HTMLElement | null
  overlayX: MotionValue<number> | null
  interactive: boolean
}

const RoutePageContext = React.createContext<RoutePageContextValue>({
  isPreview: false,
  overlayHost: null,
  overlayX: null,
  interactive: true,
})

export function RoutePageProvider({
  children,
  value,
}: Readonly<{
  children: React.ReactNode
  value: RoutePageContextValue
}>) {
  return (
    <RoutePageContext.Provider value={value}>
      {children}
    </RoutePageContext.Provider>
  )
}

export function useIsRoutePreview(): boolean {
  return React.useContext(RoutePageContext).isPreview
}

export function useRoutePageContext(): RoutePageContextValue {
  return React.useContext(RoutePageContext)
}
