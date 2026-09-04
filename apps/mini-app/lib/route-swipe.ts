export const MAIN_TAB_ROUTES = [
  "/profile",
  "/courses",
  "/dashboard",
  "/settings",
] as const

export type MainTabRoute = (typeof MAIN_TAB_ROUTES)[number]
export type GestureAxis = "pending" | "horizontal" | "vertical"

const AXIS_LOCK_DISTANCE = 10
const HORIZONTAL_INTENT_RATIO = 1.25
const DISTANCE_THRESHOLD_RATIO = 0.18
const MAX_DISTANCE_THRESHOLD = 72
const VELOCITY_THRESHOLD = 0.35
const VELOCITY_DECAY_MS = 140

export function mainTabIndex(pathname: string, exact = false): number {
  return MAIN_TAB_ROUTES.findIndex((route) =>
    exact
      ? pathname === route
      : pathname === route || pathname.startsWith(`${route}/`)
  )
}

export function resolveGestureAxis(
  deltaX: number,
  deltaY: number
): GestureAxis {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (Math.max(absX, absY) < AXIS_LOCK_DISTANCE) return "pending"
  return absX > absY * HORIZONTAL_INTENT_RATIO ? "horizontal" : "vertical"
}

/**
 * The bottom navigation is RTL: lower indexes sit farther to the right.
 * Moving the current page left therefore reveals index - 1 from the right.
 */
export function swipeTargetIndex(
  currentIndex: number,
  deltaX: number
): number | null {
  if (deltaX === 0) return null
  const targetIndex = currentIndex + (deltaX < 0 ? -1 : 1)
  return targetIndex >= 0 && targetIndex < MAIN_TAB_ROUTES.length
    ? targetIndex
    : null
}

export function navigationExitX(
  sourceIndex: number,
  targetIndex: number,
  viewportWidth: number
): number {
  return targetIndex < sourceIndex ? -viewportWidth : viewportWidth
}

export function shouldCommitSwipe({
  offset,
  velocity,
  viewportWidth,
  hasTarget,
}: {
  offset: number
  /** Horizontal velocity in CSS pixels per millisecond. */
  velocity: number
  viewportWidth: number
  hasTarget: boolean
}): boolean {
  if (!hasTarget || viewportWidth <= 0) return false

  const distanceThreshold = Math.min(
    viewportWidth * DISTANCE_THRESHOLD_RATIO,
    MAX_DISTANCE_THRESHOLD
  )
  const velocityMatchesDirection =
    offset !== 0 && Math.sign(velocity) === Math.sign(offset)

  return (
    Math.abs(offset) >= distanceThreshold ||
    (velocityMatchesDirection && Math.abs(velocity) >= VELOCITY_THRESHOLD)
  )
}

/** Old velocity should not turn a pause at release into an accidental flick. */
export function decaySwipeVelocity(velocity: number, idleMs: number): number {
  return velocity * Math.exp(-Math.max(0, idleMs) / VELOCITY_DECAY_MS)
}

/** Rubber-band resistance at the first and last tab. */
export function dampBoundaryDrag(
  deltaX: number,
  viewportWidth: number
): number {
  const maxTravel = Math.max(18, viewportWidth * 0.08)
  const resisted = Math.log1p(Math.abs(deltaX)) * 7
  return Math.sign(deltaX) * Math.min(maxTravel, resisted)
}

export function getSwipeTransitionType(
  sourceIndex: number,
  targetIndex: number
): "nav-forward" | "nav-back" {
  return targetIndex > sourceIndex ? "nav-forward" : "nav-back"
}

export function isSwipeSupported(): boolean {
  if (typeof window === "undefined") return false
  // Only touch-capable devices ΓÇô desktop mouse drag is ignored.
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  )
}
