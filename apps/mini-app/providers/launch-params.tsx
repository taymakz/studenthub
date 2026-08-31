"use client"

import { useLaunchParams } from "@tma.js/sdk-react"
import { useEffect } from "react"

import { applyStartParam } from "@/lib/launch-params"
import { useSdkReady } from "@/providers/sdk-init"

/**
 * Reads the Telegram start parameter once the SDK is booted and persists the
 * cd/ref/rd/fid fragments into localStorage (port of the old launch-params
 * provider). Other code (e.g. the redirect gate) reads these from storage.
 *
 * When the SDK failed to initialize (opened outside Telegram), this provider
 * is a no-op – the web-token / widget flow in AppBootstrap handles auth.
 */
export function SDKLaunchParamsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // In dev there is no Telegram webview – skip SDK hooks entirely.
  if (process.env.NODE_ENV !== "production") {
    return <>{children}</>
  }

  return <LaunchParamsReader>{children}</LaunchParamsReader>
}

/**
 * Calls useLaunchParams() only when the SDK was successfully initialized.
 * If init() failed (e.g. app opened outside Telegram), we skip the hook to
 * avoid the LaunchParamsRetrieveError crash.
 */
function LaunchParamsReader({ children }: { children: React.ReactNode }) {
  const sdkReady = useSdkReady()

  // SDK not ready → outside Telegram. Render children without start-param
  // processing; the web-token / widget path in AppBootstrap takes over.
  if (!sdkReady) {
    return <>{children}</>
  }

  return <LaunchParamsEffect>{children}</LaunchParamsEffect>
}

/** Separated so that useLaunchParams() is only called in this component,
 *  which is only rendered when sdkReady === true. */
function LaunchParamsEffect({ children }: { children: React.ReactNode }) {
  const { tgWebAppStartParam } = useLaunchParams()

  useEffect(() => {
    if (tgWebAppStartParam) applyStartParam(tgWebAppStartParam)
  }, [tgWebAppStartParam])

  return <>{children}</>
}
