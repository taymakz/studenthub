"use client"

import * as React from "react"

export function useBootstrapReady() {
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 600)
    return () => clearTimeout(t)
  }, [])

  return ready
}

export function useBootstrapSafetyTimeout(
  visible: boolean,
  router: { replace: (url: string) => void },
  pathnameRef: React.MutableRefObject<string>
) {
  React.useEffect(() => {
    if (visible) return
    const t = setTimeout(() => {
      if (!visible) {
        // handled via setter passed? we need setVisible param
      }
    }, 12_000)
    return () => clearTimeout(t)
  }, [visible, router, pathnameRef])
}

// actual safety timeout with setVisible
export function useBootstrapSafetyTimeoutWithVisible(
  visible: boolean,
  setVisible: (v: boolean) => void,
  router: { replace: (url: string) => void },
  pathnameRef: React.MutableRefObject<string>
) {
  React.useEffect(() => {
    if (visible) return
    const t = setTimeout(() => {
      if (!visible) {
        setVisible(true)
        if (pathnameRef.current === "/") router.replace("/profile")
      }
    }, 12_000)
    return () => clearTimeout(t)
  }, [visible, setVisible, router, pathnameRef])
}
