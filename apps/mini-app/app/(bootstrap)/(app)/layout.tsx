"use client"

import { BottomNav } from "@/components/bottom-nav"
import { EffectOverlay } from "@/components/effects/effect-overlay"

/**
 * Main app shell (post-onboarding): pages render inside the padded column,
 * pill nav floats at the bottom - same structure as old (app)/layout.tsx,
 * including the snow/rain effect overlay mounted above all content.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col safe-bottom-padding">
      <EffectOverlay />
      <main className="relative grow">{children}</main>
      <BottomNav />
    </div>
  )
}
