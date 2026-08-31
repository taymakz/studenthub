"use client"

import { isTMA } from "@tma.js/bridge"
import { createContext, useContext, useEffect, useState } from "react"
import { init } from "@tma.js/sdk-react"

declare global {
  interface Window {
    Telegram?: {
      WebApp?: Record<string, unknown>
    }
  }
}

/**
 * Whether the tma.js SDK was successfully initialized (i.e. we are inside
 * Telegram AND `init()` completed). Child providers use this to decide
 * whether it is safe to call SDK hooks like `useLaunchParams()`.
 */
const SdkReadyContext = createContext(false)

/** Read by child providers to gate SDK-dependent hooks. */
export function useSdkReady(): boolean {
  return useContext(SdkReadyContext)
}

/**
 * Boots the tma.js SDK once the inline `/public/telegram.js` script (loaded
 * with strategy="beforeInteractive" in the root layout) has created
 * window.Telegram.WebApp. Uses `isTMA()` from @tma.js/bridge to officially
 * detect the Telegram environment before calling `init()`.
 *
 * In dev there is no webview, so the SDK is skipped entirely and initData
 * comes from NEXT_PUBLIC_DEV_INIT_DATA.
 */
export function SDKProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(
    process.env.NODE_ENV !== "production"
  )
  const [ready, setReady] = useState(process.env.NODE_ENV !== "production")

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    let cancelled = false
    // Safety: never block rendering longer than 700ms, even if
    // window.Telegram never appears (web without telegram.js).
    const safety = setTimeout(() => {
      if (!cancelled) setIsInitialized(true)
    }, 700)

    void (async () => {
      // Give beforeInteractive telegram.js a tick to define window.Telegram
      await new Promise<void>((r) => setTimeout(r, 40))
      if (cancelled) return
      let inside = false
      try {
        // Complete mode is reliable: calls a TMA-specific method and waits
        // for the bridge event (100-120ms). Falls back to simple sync check.
        try {
          // isTMA('complete') is async; overload accepts timeout object
          inside = await (
            isTMA as unknown as (
              mode: string,
              opts?: { timeout: number }
            ) => Promise<boolean>
          )("complete", { timeout: 120 })
        } catch {
          try {
            inside = (isTMA as unknown as () => boolean)()
          } catch {
            inside = false
          }
        }
        // Extra guard: even if isTMA says true, Telegram.WebApp must exist
        if (
          inside &&
          typeof window !== "undefined" &&
          !window.Telegram?.WebApp
        ) {
          inside = false
        }
      } catch (err) {
        console.warn("SDK initialization failed:", err)
        inside = false
      }

      if (cancelled) return
      if (inside) {
        try {
          init()
          setReady(true)
        } catch (err) {
          console.warn("tma.js init() failed:", err)
        }
      }
      clearTimeout(safety)
      setIsInitialized(true)
    })()

    return () => {
      cancelled = true
      clearTimeout(safety)
    }
  }, [])

  // Don't render children until SDK init has been attempted in production
  if (!isInitialized) {
    return null
  }

  return (
    <SdkReadyContext.Provider value={ready}>
      {children}
    </SdkReadyContext.Provider>
  )
}
