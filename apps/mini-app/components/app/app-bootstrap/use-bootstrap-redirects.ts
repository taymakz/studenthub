"use client"

import * as React from "react"

import { clearWebToken } from "@/lib/auth/web-token"

/** Navigation policy lives at module scope; the effects below only trigger it
    when the boot state (banned / maintenance) demands it. */
function replaceRoute(router: { replace: (url: string) => void }, url: string) {
  router.replace(url)
}

export function useBootstrapRedirects({
  isBanned,
  isMaintenance,
  pathname,
  router,
  redirectedRef,
  setVisible,
}: {
  isBanned: boolean
  isMaintenance: boolean
  pathname: string
  router: { replace: (url: string) => void }
  redirectedRef: React.MutableRefObject<boolean>
  setVisible: (v: boolean) => void
}) {
  React.useEffect(() => {
    if (!isBanned) return
    setVisible(true)
    if (pathname === "/banned") return
    redirectedRef.current = true
    replaceRoute(router, "/banned")
  }, [isBanned, pathname, router, redirectedRef, setVisible])

  React.useEffect(() => {
    if (!isMaintenance) return
    setVisible(true)
    if (pathname === "/maintenance" || pathname === "/banned") return
    redirectedRef.current = true
    replaceRoute(router, "/maintenance")
  }, [isMaintenance, pathname, router, redirectedRef, setVisible])
}

export function useBootstrapStaleToken(
  hasStaleWebToken: boolean,
  setNeedsWebAuth: (v: boolean) => void
) {
  React.useEffect(() => {
    if (!hasStaleWebToken) return
    clearWebToken()
    setNeedsWebAuth(true)
  }, [hasStaleWebToken, setNeedsWebAuth])
}
