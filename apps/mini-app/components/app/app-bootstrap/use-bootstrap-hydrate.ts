"use client"

import * as React from "react"

import { useProfileStore } from "@/stores/profile-store"

export function useBootstrapHydrate() {
  const firedRef = React.useRef(false)
  React.useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    void useProfileStore.getState().hydrate()
  }, [])
}
