"use client"

import { LazyMotion, domAnimation } from "motion/react"

/**
 * LazyMotion loads only the `m` component runtime (domAnimation features)
 * instead of the full `motion` bundle — about 30kb less JS on every page.
 * `strict` throws if any file still imports the full `motion` component,
 * so regressions fail fast in dev.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
}
