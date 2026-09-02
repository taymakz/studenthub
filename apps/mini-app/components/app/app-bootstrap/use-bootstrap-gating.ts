"use client"

import * as React from "react"

import { isProfileComplete } from "@/lib/api"
import { applyLaunchParams } from "@/lib/launch-params"
import { cloudStorageGet } from "@/lib/tma-storage"
import { resolveInitData } from "@/lib/request"
import { INTRO_STORAGE_KEY, DEBUG } from "@/constants"
import type { MeProfile } from "@/lib/api"

export function useBootstrapGating({
  booted,
  ready,
  maintenance,
  banned,
  needsWebAuth,
  profile,
  pathname,
  router,
  redirectedRef,
  setVisible,
}: {
  booted: boolean
  ready: boolean
  maintenance: unknown
  banned: unknown
  needsWebAuth: boolean
  profile: MeProfile | null
  pathname: string
  router: { replace: (url: string) => void }
  redirectedRef: React.MutableRefObject<boolean>
  setVisible: (v: boolean) => void
}) {
  React.useEffect(() => {
    if (!booted || !ready) return
    if (maintenance || banned) return
    if (needsWebAuth) return
    let cancelled = false

    void (async () => {
      let introCompleted = false
      try {
        introCompleted =
          localStorage.getItem(INTRO_STORAGE_KEY) === JSON.stringify(true)
      } catch {
        introCompleted = false
      }
      if (!introCompleted) {
        const v = await cloudStorageGet(INTRO_STORAGE_KEY)
        if (v === JSON.stringify(true)) {
          introCompleted = true
          try {
            localStorage.setItem(INTRO_STORAGE_KEY, v)
          } catch {}
        }
      }

      const appRoutes = ["/profile", "/courses", "/dashboard", "/settings"]
      const isAppRoute = appRoutes.some(
        (r) => pathname === r || pathname.startsWith(r + "/")
      )

      let target: string | null = null
      if (DEBUG) target = "/welcome"
      else if (!introCompleted) {
        if (pathname !== "/welcome") target = "/welcome"
      } else if (!isProfileComplete(profile ?? null)) {
        if (pathname !== "/setup") target = "/setup"
      } else {
        const initData = await resolveInitData()
        const { rd } = applyLaunchParams(initData)
        if (rd) target = rd.startsWith("/") ? rd : `/${rd}`
        else if (pathname === "/" || pathname === "/welcome") target = "/profile"
      }

      if (cancelled) return
      if (target === null) {
        setVisible(true)
        return
      }
      if (pathname === target) {
        setVisible(true)
        return
      }
      if (redirectedRef.current) {
        setVisible(true)
        return
      }
      redirectedRef.current = true
      router.replace(target)
      try {
        localStorage.removeItem("rd")
      } catch {}
    })().catch(() => {
      if (!cancelled) setVisible(true)
    })

    return () => {
      cancelled = true
    }
  }, [
    booted,
    ready,
    pathname,
    profile,
    router,
    maintenance,
    banned,
    needsWebAuth,
    redirectedRef,
    setVisible,
  ])
}
