"use client"

import { useRouter } from "next/navigation"
import * as React from "react"

import { preloadMainTabRoutes } from "@/lib/main-tab-route-preload"
import type { MainTabWarmupContextValue } from "@/lib/main-tab-warmup-context"
import { MAIN_TAB_ROUTES, mainTabIndex } from "@/lib/route-swipe"

const MAIN_TAB_WARMUP_TIMEOUT_MS = 5000

function isMainTabWarmupEnabled({
  booted,
  hasUser,
  profileComplete,
  maintenance,
  banned,
  needsWebAuth,
}: {
  booted: boolean
  hasUser: boolean
  profileComplete: boolean
  maintenance: unknown
  banned: unknown
  needsWebAuth: boolean
}) {
  return (
    booted &&
    hasUser &&
    profileComplete &&
    !maintenance &&
    !banned &&
    !needsWebAuth
  )
}

function shouldHoldSplashForMainTabs(
  visible: boolean,
  warmupEnabled: boolean,
  isMainTabRoute: boolean,
  mainTabsReady: boolean,
  warmupExpired: boolean
) {
  return (
    visible && warmupEnabled && isMainTabRoute && !mainTabsReady && !warmupExpired
  )
}

/**
 * Warms the four main tabs while the bootstrap splash is visible. Starts the
 * route chunks as soon as a valid profile is known, holds the splash cover
 * until every retained preview tree has committed, and caps the wait so a
 * slow or failed chunk can never trap the user behind the splash.
 */
export function useMainTabWarmupGate({
  router,
  pathname,
  visible,
  booted,
  hasUser,
  profileComplete,
  maintenance,
  banned,
  needsWebAuth,
}: {
  router: ReturnType<typeof useRouter>
  pathname: string | null
  visible: boolean
  booted: boolean
  hasUser: boolean
  profileComplete: boolean
  maintenance: unknown
  banned: unknown
  needsWebAuth: boolean
}) {
  const [mainTabsReady, setMainTabsReady] = React.useState(false)
  const [mainTabWarmupExpired, setMainTabWarmupExpired] = React.useState(false)

  const mainTabWarmupEnabled = isMainTabWarmupEnabled({
    booted,
    hasUser,
    profileComplete,
    maintenance,
    banned,
    needsWebAuth,
  })
  const isMainTabRoute = mainTabIndex(pathname ?? "") >= 0

  function reportStarted() {
    // The `(app)` layout can unmount while the user edits setup and mount
    // again later. Its retained preview trees are new in that case, so this
    // warmup generation must earn readiness again before the cover leaves.
    setMainTabsReady(false)
    setMainTabWarmupExpired(false)
  }

  function reportReady() {
    setMainTabsReady(true)
  }

  const mainTabWarmupContext: MainTabWarmupContextValue = {
    enabled: mainTabWarmupEnabled,
    reportStarted,
    reportReady,
  }

  // Start every main-tab chunk as soon as a valid profile is known. This also
  // runs while the entry route is still "/", before its redirect mounts the
  // swipe shell. The shell shares this exact cache and performs the real DOM
  // warmup after landing on a tab.
  React.useEffect(() => {
    if (!mainTabWarmupEnabled) return

    for (const route of MAIN_TAB_ROUTES) router.prefetch(route)
    void preloadMainTabRoutes()
  }, [mainTabWarmupEnabled, router])

  // A slow or failed chunk must never trap the user behind the splash. Normal
  // startup waits for all four preview trees to commit; this cap releases the
  // app and lets the existing per-route retry path handle an early gesture.
  React.useEffect(() => {
    if (!visible || !mainTabWarmupEnabled || !isMainTabRoute || mainTabsReady) {
      return
    }

    const timeout = setTimeout(
      () => setMainTabWarmupExpired(true),
      MAIN_TAB_WARMUP_TIMEOUT_MS
    )
    return () => clearTimeout(timeout)
  }, [isMainTabRoute, mainTabWarmupEnabled, mainTabsReady, visible])

  const holdSplashForMainTabs = shouldHoldSplashForMainTabs(
    visible,
    mainTabWarmupEnabled,
    isMainTabRoute,
    mainTabsReady,
    mainTabWarmupExpired
  )

  return { mainTabWarmupContext, holdSplashForMainTabs }
}
