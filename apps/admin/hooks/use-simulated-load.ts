"use client"

import * as React from "react"

/**
 * Runs `load` once, after `delayMs`, to simulate fetching on the client.
 * Returns null until resolved — callers render their loading skeleton then.
 */
export function useSimulatedLoad<T>(load: () => T, delayMs: number): T | null {
  const loadRef = React.useRef(load)
  React.useEffect(() => {
    loadRef.current = load
  })
  const [data, setData] = React.useState<T | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => setData(loadRef.current()), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs])

  return data
}
