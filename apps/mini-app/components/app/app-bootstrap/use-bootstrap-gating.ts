"use client"

import * as React from "react"

import { isProfileComplete } from "@/lib/api"
import { applyLaunchParams } from "@/lib/launch-params"
import { cloudStorageGet } from "@/lib/tma-storage"
import { resolveInitData } from "@/lib/request"
import { INTRO_STORAGE_KEY, DEBUG } from "@/constants"
import type { MeProfile } from "@/lib/api"

/** Navigation policy lives at module scope; the effect below only triggers it
    after the async gate resolves (cloud storage + initData — no event-handler
    equivalent exists for this decision). */
function replaceRoute(router: { replace: (url: string) => void }, url: string) {
  router.replace(url)
}

async function resolveBootstrapTarget(
  pathname: string,
  profile: MeProfile | null
): Promise<string | null> {
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

  if (DEBUG) return "/welcome"
  if (!introCompleted) {
    if (pathname !== "/welcome") return "/welcome"
    return null
  }
  if (!isProfileComplete(profile)) {
    if (pathname !== "/setup") return "/setup"
    return null
  }
  const initData = await resolveInitData()
  const { rd } = applyLaunchParams(initData)
  if (rd) return rd.startsWith("/") ? rd : `/${rd}`
  if (pathname === "/" || pathname === "/welcome") return "/profile"
  return null
}

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
      const target = await resolveBootstrapTarget(pathname, profile ?? null)

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
      replaceRoute(router, target)
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
