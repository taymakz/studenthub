"use client"

import * as React from "react"

const emptySubscribe = () => () => {}

/**
 * True only after the component has mounted in the browser; false during SSR
 * and the hydration pass. Uses useSyncExternalStore so no setState-in-effect
 * (no cascading extra render) while keeping the exact "render nothing before
 * mount" semantics the previous mounted-state pattern had.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}
