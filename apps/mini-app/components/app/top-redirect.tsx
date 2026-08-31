"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

/**
 * Top-layout hard redirect — every full page load lands on "/".
 * Mounts inside the root layout so it runs before AppBootstrap's gate.
 * Client navigations (next/link) are not bounced because this component
 * only runs once on mount (hard reload). No route is excluded — even
 * /maintenance bounces to "/" so the bootstrap hydration re-fetches /me
 * and decides whether maintenance is still active.
 */
export function TopRedirect() {
  const router = useRouter()
  const pathname = usePathname()
  const firedRef = React.useRef(false)

  React.useEffect(() => {
    if (firedRef.current) return
    if (pathname === "/") return
    firedRef.current = true
    router.replace("/")
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally once on mount
  }, [])

  return null
}
