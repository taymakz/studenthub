"use client"

import { LazyMotion, domAnimation } from "motion/react"

/**
 * LazyMotion loads only the `m` component runtime (domAnimation features)
 * instead of the full `motion` bundle — @workspace/ui renders `m` components,
 * which need these features in scope to animate.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>
}
