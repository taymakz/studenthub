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
  gated: boolean,
  setVisible: (v: boolean) => void,
  router: { replace: (url: string) => void },
  pathnameRef: React.MutableRefObject<string>
) {
  React.useEffect(() => {
    // `gated` covers full-screen gates (e.g. the web-login widget) — the
    // splash is intentionally paused there, so the timeout must not fire
    // and force-dismiss it mid-gate. Derived at the call site, no setState.
    if (visible || gated) return
    const t = setTimeout(() => {
      if (!visible) {
        setVisible(true)
        if (pathnameRef.current === "/") router.replace("/profile")
      }
    }, 12_000)
    return () => clearTimeout(t)
  }, [visible, gated, setVisible, router, pathnameRef])
}
