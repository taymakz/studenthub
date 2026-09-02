"use client"

import * as React from "react"

import { resolveInitData } from "@/lib/request"

export function useBootstrapWebAuth(
  ready: boolean,
  sdkReady: boolean,
  user: unknown,
  hydrated: boolean
) {
  const [webAuthChecked, setWebAuthChecked] = React.useState(false)
  const [needsWebAuth, setNeedsWebAuth] = React.useState(false)

  React.useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      if (sdkReady) {
        if (!cancelled) {
          setNeedsWebAuth(false)
          setWebAuthChecked(true)
        }
        return
      }
      const initData = await resolveInitData()
      if (cancelled) return
      const hasAuth = Boolean(initData)
      if (!hasAuth) {
        if (!user && hydrated) setNeedsWebAuth(true)
      } else {
        setNeedsWebAuth(false)
      }
      setWebAuthChecked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [ready, sdkReady, user, hydrated])

  return { webAuthChecked, needsWebAuth, setNeedsWebAuth }
}
