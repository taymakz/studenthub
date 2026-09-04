"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence } from "motion/react"

import { TelegramLoginWidget } from "@/components/auth/telegram-login-widget"
import { MAIN_TAB_ROUTES, mainTabIndex } from "@/lib/route-swipe"
import { preloadMainTabRoutes } from "@/lib/main-tab-route-preload"
import { MainTabWarmupProvider } from "@/lib/main-tab-warmup-context"
import { useProfileStore } from "@/stores/profile-store"
import { useSdkReady } from "@/providers/sdk-init"

import {
  BootstrapErrorView,
  BootstrapSplashView,
} from "./app-bootstrap/bootstrap-views"
import { useBootstrapReady, useBootstrapSafetyTimeoutWithVisible } from "./app-bootstrap/use-bootstrap-ready"
import { useBootstrapHydrate } from "./app-bootstrap/use-bootstrap-hydrate"
import { useBootstrapWebAuth } from "./app-bootstrap/use-bootstrap-web-auth"
import { useBootstrapGating } from "./app-bootstrap/use-bootstrap-gating"
import {
  useBootstrapRedirects,
  useBootstrapStaleToken,
} from "./app-bootstrap/use-bootstrap-redirects"

import { isProfileComplete } from "@/lib/api"

const MAIN_TAB_WARMUP_TIMEOUT_MS = 5000

function getStaleToken(ready: boolean, checked: boolean, hydrated: boolean, err: unknown, user: unknown, sdk: boolean) {
  if (!ready) return false
  if (!checked) return false
  if (!hydrated) return false
  if (!err) return false
  if (user) return false
  return !sdk
}
function getMaintenance(ready: boolean, m: unknown) {
  return ready && !!m
}
function getBanned(ready: boolean, b: unknown) {
  return ready && !!b
}
function getShowWebLogin(sdkReady: boolean, ready: boolean, checked: boolean, hydrated: boolean, needs: boolean, stale: boolean, user: unknown, isMaint: boolean, isBanned: boolean) {
  if (sdkReady) return false
  if (!ready) return false
  if (!checked) return false
  if (!hydrated) return false
  if (!needs && !stale) return false
  if (user) return false
  if (isMaint) return false
  if (isBanned) return false
  return true
}
function getErrored(ready: boolean, hydrated: boolean, err: unknown, show: boolean, isMaint: boolean, isBanned: boolean, stale: boolean) {
  if (!ready) return false
  if (!hydrated) return false
  if (!err) return false
  if (show) return false
  if (isMaint) return false
  if (isBanned) return false
  if (stale) return false
  return true
}
function useBootstrapFlags(
  ready: boolean,
  webAuthChecked: boolean,
  hydrated: boolean,
  storeError: unknown,
  user: unknown,
  sdkReady: boolean,
  maintenance: unknown,
  banned: unknown,
  needsWebAuth: boolean
) {
  const hasStaleWebToken = getStaleToken(ready, webAuthChecked, hydrated, storeError, user, sdkReady)
  const isMaintenance = getMaintenance(ready, maintenance)
  const isBanned = getBanned(ready, banned)
  const showWebLogin = getShowWebLogin(sdkReady, ready, webAuthChecked, hydrated, needsWebAuth, hasStaleWebToken, user, isMaintenance, isBanned)
  const errored = getErrored(ready, hydrated, storeError, showWebLogin, isMaintenance, isBanned, hasStaleWebToken)
  return { hasStaleWebToken, isMaintenance, isBanned, showWebLogin, errored }
}

/**
 * Bootstrap gate in the `(bootstrap)` route-group layout; it wraps "/",
 * /welcome, /setup and the `(app)` pages — but NOT /maintenance, which renders
 * its own shell and must not re-trigger the splash / /me hydration. On every
 * full page load it shows the draw-in splash, resolves ONE combined
 * `/me/bootstrap` into the profile store, then:
 *   never saw intro  -> /welcome
 *   no profile       -> /setup
 *   else             -> rd deep-link or /profile
 */
export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const sdkReady = useSdkReady()
  const ready = useBootstrapReady()
  const [visible, setVisible] = React.useState(false)
  const [mainTabsReady, setMainTabsReady] = React.useState(false)
  const [mainTabWarmupExpired, setMainTabWarmupExpired] = React.useState(false)
  const redirectedRef = React.useRef(false)
  const prevPathnameRef = React.useRef(pathname)

  // Reset the one-redirect-per-load allowance when the route actually changes.
  // Ref writes live in an effect — render must stay pure.
  React.useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      redirectedRef.current = false
    }
  }, [pathname])

  const hydrated = useProfileStore((s) => s.hydrated)
  const pathnameRef = React.useRef(pathname)
  React.useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])
  const storeError = useProfileStore((s) => s.error)
  const profile = useProfileStore((s) => s.profile)
  const user = useProfileStore((s) => s.user)
  const maintenance = useProfileStore((s) => s.maintenance)
  const banned = useProfileStore((s) => s.banned)
  const booted = hydrated && !storeError
  const profileComplete = isProfileComplete(profile ?? null)

  useBootstrapHydrate()

  const { webAuthChecked, needsWebAuth, setNeedsWebAuth } =
    useBootstrapWebAuth(ready, sdkReady, user, hydrated)

  const mainTabWarmupEnabled =
    booted &&
    Boolean(user) &&
    profileComplete &&
    !maintenance &&
    !banned &&
    !needsWebAuth
  const isMainTabRoute = mainTabIndex(pathname ?? "") >= 0
  const reportMainTabsReady = React.useCallback(
    () => setMainTabsReady(true),
    []
  )
  const reportMainTabsStarted = React.useCallback(() => {
    // The `(app)` layout can unmount while the user edits setup and mount
    // again later. Its retained preview trees are new in that case, so this
    // warmup generation must earn readiness again before the cover leaves.
    setMainTabsReady(false)
    setMainTabWarmupExpired(false)
  }, [])
  const mainTabWarmupContext = React.useMemo(
    () => ({
      enabled: mainTabWarmupEnabled,
      reportStarted: reportMainTabsStarted,
      reportReady: reportMainTabsReady,
    }),
    [mainTabWarmupEnabled, reportMainTabsReady, reportMainTabsStarted]
  )

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

  useBootstrapGating({
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
  })

  const { hasStaleWebToken, isMaintenance, isBanned, showWebLogin, errored } =
    useBootstrapFlags(
      ready,
      webAuthChecked,
      hydrated,
      storeError,
      user,
      sdkReady,
      maintenance,
      banned,
      needsWebAuth
    )

  useBootstrapRedirects({
    isBanned,
    isMaintenance,
    pathname,
    router,
    redirectedRef,
    setVisible,
  })

  // While the web-login gate is up the splash is paused — derive the pause
  // at the call site instead of syncing showWebLogin into `visible` via an
  // effect (avoids a cascading extra render on every gate flip).
  useBootstrapSafetyTimeoutWithVisible(
    visible,
    showWebLogin,
    setVisible,
    router,
    pathnameRef
  )

  useBootstrapStaleToken(hasStaleWebToken, setNeedsWebAuth)

  const holdSplashForMainTabs =
    visible &&
    mainTabWarmupEnabled &&
    isMainTabRoute &&
    !mainTabsReady &&
    !mainTabWarmupExpired

  if (showWebLogin) {
    return <TelegramLoginWidget />
  }

  return (
    <MainTabWarmupProvider value={mainTabWarmupContext}>
      {children}
      <AnimatePresence mode="wait">
        {errored ? (
          <BootstrapErrorView />
        ) : !visible || holdSplashForMainTabs ? (
          <BootstrapSplashView />
        ) : null}
      </AnimatePresence>
    </MainTabWarmupProvider>
  )
}
