"use client"

import dynamic from "next/dynamic"
import { useUIEffect, useUIEffectHydrate } from "@/hooks/use-ui-effect"

// Canvas effects - client-only (they measure the viewport in effects),
// and z-100 above ALL content incl. the bottom nav, exactly like the old app.
const Snowfall = dynamic(() => import("@/components/effects/snowfall"), {
  ssr: false,
  loading: () => null,
})
const Rain = dynamic(() => import("@/components/effects/rain"), {
  ssr: false,
  loading: () => null,
})

/** Port of the old (app)/layout effects mount: snow/rain over everything. */
export function EffectOverlay() {
  useUIEffectHydrate()
  const effect = useUIEffect((s) => s.effect)

  if (effect === "snow") {
    return (
      <Snowfall
        className="pointer-events-none fixed inset-0 z-100"
        quantity={60}
      />
    )
  }
  if (effect === "rain") {
    return (
      <Rain className="pointer-events-none fixed inset-0 z-100" quantity={40} />
    )
  }
  return null
}
