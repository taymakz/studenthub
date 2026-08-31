"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"

import { InitialLoading } from "@/components/app/initial-loading"
import { TelegramLoginWidget } from "@/components/auth/telegram-login-widget"
import { isProfileComplete } from "@/lib/api"
import { applyLaunchParams } from "@/lib/launch-params"
import { resolveInitData } from "@/lib/request"
import { clearWebToken } from "@/lib/auth/web-token"
import { INTRO_STORAGE_KEY, DEBUG } from "@/constants"
import { useProfileStore } from "@/stores/profile-store"
import { useSdkReady } from "@/providers/sdk-init"

/**
 * Bootstrap gate in the `(bootstrap)` route-group layout; it wraps "/",
 * /welcome, /setup and the `(app)` pages — but NOT /maintenance, which renders
 * its own shell and must not re-trigger the splash / /me hydration. On every
 * full page load it shows the draw-in splash, resolves ONE combined
 * `/me/bootstrap` into the profile store, then:
 *   never saw intro  -> /welcome
 *   no profile       -> /setup
 *   else             -> rd deep-link or /profile
 * Once it lands on the right route it renders the requested page; in-app
 * client navigations are not re-gated, so the splash only shows on load.
 *
 * Auth branching:
 *  - Inside Telegram (initData present via tma.js or window.Telegram): `tma` header → same user row.
 *  - Outside Telegram (web): no initData → expects `sh_web_token` (Bearer) minted by
 *    Telegram Login Widget / OIDC (`POST /auth/telegram/widget`). Both flows hit the
 *    same users table (PK = Telegram chat id), so the web account IS the mini-app account.
 */
export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const sdkReady = useSdkReady()
  const [ready, setReady] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const redirectedRef = React.useRef(false)
  const prevPathnameRef = React.useRef(pathname)
  const hydrateFiredRef = React.useRef(false)

  // Reset redirect guard when pathname changes (e.g. welcome → /) so the
  // bootstrap logic can route to /setup or /profile.
  if (prevPathnameRef.current !== pathname) {
    prevPathnameRef.current = pathname
    redirectedRef.current = false
  }

  const hydrated = useProfileStore((s) => s.hydrated)
  const storeError = useProfileStore((s) => s.error)
  const profile = useProfileStore((s) => s.profile)
  const user = useProfileStore((s) => s.user)
  const maintenance = useProfileStore((s) => s.maintenance)
  const banned = useProfileStore((s) => s.banned)
  const booted = hydrated && !storeError
  const [webAuthChecked, setWebAuthChecked] = React.useState(false)
  const [needsWebAuth, setNeedsWebAuth] = React.useState(false)

  // Hold the splash for a beat even when the store is already hydrated.
  React.useEffect(() => {
    const t = setTimeout(() => setReady(true), 600)
    return () => clearTimeout(t)
  }, [])

  // Safety timeout: if bootstrap is stuck (hydrate hanging, network issue,
  // etc.), force-show the UI after 12 seconds so the user isn't
  // trapped on the loading splash forever. Web-login bypasses this.
  React.useEffect(() => {
    if (visible) return
    const t = setTimeout(() => {
      if (!visible) setVisible(true)
    }, 12_000)
    return () => clearTimeout(t)
  }, [visible])

  // One combined `/me/bootstrap` request hydrates the app-wide profile store.
  // Guard with a ref so StrictMode double-mount (dev) never fires twice;
  // the store's own hydratePromise dedupes concurrent callers as well.
  React.useEffect(() => {
    if (hydrateFiredRef.current) return
    hydrateFiredRef.current = true
    void useProfileStore.getState().hydrate()
  }, [])

  // Web mode: if SDK has no initData and no web token, show Telegram Login Widget
  // (browser open). Runs after the 600ms splash AND after SDK detection settles
  // so Telegram has time to inject initData. Re-runs when sdkReady/user change
  // so late-arriving initData (slow webview) is picked up.
  React.useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      // Inside Telegram (sdkReady true) we must NOT show the widget even if
      // resolveInitData is momentarily null during SDK boot. The sdkReady
      // flag is the source of truth for environment.
      if (sdkReady) {
        if (!cancelled) {
          setNeedsWebAuth(false)
          setWebAuthChecked(true)
        }
        return
      }
      const initData = await resolveInitData()
      if (cancelled) return
      // Enterprise: web auth is HttpOnly cookie (not readable via JS) — hasAuth only checks initData (TMA/dev)
      const hasAuth = Boolean(initData)
      if (!hasAuth) {
        if (!user && hydrated) setNeedsWebAuth(true)
        else if (!hydrated) {
          // wait for hydrate — don't decide yet (cookie will be validated via /me)
        }
      } else {
        setNeedsWebAuth(false)
      }
      setWebAuthChecked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [ready, sdkReady, user, hydrated])

  React.useEffect(() => {
    if (!booted || !ready) return
    // Under maintenance or banned: skip intro/profile gating entirely; the
    // redirect effects below send the user to /maintenance or /banned.
    if (maintenance || banned) return
    // Do not run gating while we are waiting to show the web widget —
    // the user must authenticate first.
    if (needsWebAuth) return
    let cancelled = false

    void (async () => {
      // Intro flag: prefer localStorage, fallback to Telegram cloudStorage (if available).
      // Welcome page saves to BOTH, so returning users on a new device still skip intro.
      let introCompleted = false
      try {
        introCompleted =
          localStorage.getItem(INTRO_STORAGE_KEY) === JSON.stringify(true)
      } catch {
        introCompleted = false
      }
      if (!introCompleted) {
        try {
          const { cloudStorage } = await import("@tma.js/sdk-react")
          const v = await cloudStorage.getItem(INTRO_STORAGE_KEY)
          if (v === JSON.stringify(true)) {
            introCompleted = true
            try {
              localStorage.setItem(INTRO_STORAGE_KEY, v)
            } catch {}
          }
        } catch {
          // cloudStorage unavailable (web) or not yet initialized — ignore
        }
      }

      // Determine target but don't force /profile when user is already on a valid app route.
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
        if (rd) target = rd
        // Don't redirect away from /setup — users navigate there intentionally
        // from settings to edit their profile even when it's already complete.
        else if (pathname === "/" || pathname === "/welcome")
          target = "/profile"
        // else stay on current app route (isAppRoute) → no redirect
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
      // If anything in the async chain throws, still show the page
      // so the user isn't stuck on the loading splash.
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
  ])

  const isMaintenance = ready && maintenance
  const isBanned = ready && banned

  // Banned → standalone /banned page (highest priority, even over maintenance)
  React.useEffect(() => {
    if (!isBanned) return
    setVisible(true)
    if (pathname === "/banned") return
    redirectedRef.current = true
    router.replace("/banned")
  }, [isBanned, pathname, router])

  // Maintenance → route to the standalone /maintenance page (no data fetches).
  React.useEffect(() => {
    if (!isMaintenance) return
    // Dismiss the splash: the intro/profile effect returns early under
    // maintenance, so without this `InitialLoading` would sit opaque over the
    // /maintenance page forever and hide the message.
    setVisible(true)
    if (pathname === "/maintenance" || pathname === "/banned") return
    redirectedRef.current = true
    router.replace("/maintenance")
  }, [isMaintenance, pathname, router])
  // Stale web token: hydrate failed despite having a token/cookie -> expired/invalid (web only)
  const hasStaleWebToken =
    ready && webAuthChecked && hydrated && storeError && !user && !sdkReady
  // Inside Telegram (sdkReady) never show the widget — initData is the auth source.
  const showWebLogin =
    !sdkReady &&
    ready &&
    webAuthChecked &&
    hydrated &&
    (needsWebAuth || hasStaleWebToken) &&
    !user &&
    !isMaintenance &&
    !isBanned
  const errored =
    ready &&
    hydrated &&
    storeError &&
    !showWebLogin &&
    !isMaintenance &&
    !isBanned &&
    !hasStaleWebToken

  // When we have determined web login is needed, dismiss the splash so the
  // widget is visible (otherwise the fixed splash with z-50 hides it).
  React.useEffect(() => {
    if (showWebLogin) setVisible(true)
  }, [showWebLogin])

  // Clear stale token/cookie so next mount doesn't loop on 401 (enterprise: clears HttpOnly via /auth/telegram/logout)
  React.useEffect(() => {
    if (!hasStaleWebToken) return
    clearWebToken()
    setNeedsWebAuth(true)
  }, [hasStaleWebToken])

  // Web unauthenticated → full-screen Telegram Login Widget (same user PK as TMA).
  if (showWebLogin) {
    return <TelegramLoginWidget />
  }

  // Maintenance pages render their own shell; keep bootstrap children hidden
  // behind splash until redirect, but maintenance page itself is outside this layout.
  return (
    <>
      {/* Page content fades in via app/(app)/template.tsx — keep children mounted
          under the splash so the first paint after fade is instant. */}
      {children}
      <AnimatePresence mode="wait">
        {errored ? (
          <motion.div
            key="bootstrap-error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-8 text-center"
          >
            <p className="font-medium">خطا در اتصال</p>
            <p className="text-sm text-muted-foreground">
              لطفا لحظاتی دیگر دوباره وارد شوید.
            </p>
            <button
              onClick={() => void useProfileStore.getState().refresh()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              تلاش مجدد
            </button>
          </motion.div>
        ) : !visible ? (
          <motion.div
            key="bootstrap-splash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-50"
          >
            <InitialLoading />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  )
}
