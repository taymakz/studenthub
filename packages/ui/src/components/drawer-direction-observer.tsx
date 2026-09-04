"use client"

import * as React from "react"

const DrawerDirectionObserverContext = React.createContext(true)

export function DrawerDirectionObserverProvider({
  children,
  enabled,
}: Readonly<{
  children: React.ReactNode
  enabled: boolean
}>) {
  return (
    <DrawerDirectionObserverContext.Provider value={enabled}>
      {children}
    </DrawerDirectionObserverContext.Provider>
  )
}

export function useDrawerDirectionObserverEnabled(): boolean {
  return React.useContext(DrawerDirectionObserverContext)
}
