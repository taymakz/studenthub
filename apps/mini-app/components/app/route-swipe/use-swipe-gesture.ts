"use client"

import { useRouter } from "next/navigation"
import { animate, type MotionValue } from "motion/react"
import * as React from "react"
import { flushSync } from "react-dom"

import {
  decaySwipeVelocity,
  dampBoundaryDrag,
  isRouteSwipeBlockingOverlaySlot,
  MAIN_TAB_ROUTES,
  navigationExitX,
  resolveGestureAxis,
  shouldCommitSwipe,
  swipeTargetIndex,
  type MainTabRoute,
} from "@/lib/route-swipe"

import {
  COURSES_STABILIZATION_FRAMES,
  RELEASE_EASING,
  ROUTE_STABILIZATION_FRAMES,
  ROUTE_TRANSITION_TIMEOUT_MS,
} from "./constants"

const SWIPE_IGNORE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='slider']",
  "[data-route-swipe-ignore]",
  "[data-slot='carousel']",
].join(",")

function shouldIgnoreSwipeStart(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest(SWIPE_IGNORE_SELECTOR)) return true

  for (
    let element: Element | null = target;
    element;
    element = element.parentElement
  ) {
    if (isRouteSwipeBlockingOverlaySlot(element.getAttribute("data-slot"))) {
      return true
    }
  }

  return false
}

function triggerSelectionHaptic() {
  const webApp = window.Telegram?.WebApp as
    | {
        isVersionAtLeast?: (version: string) => boolean
        HapticFeedback?: {
          selectionChanged?: () => void
        }
      }
    | undefined

  try {
    if (webApp?.isVersionAtLeast?.("6.1") === false) return
    webApp?.HapticFeedback?.selectionChanged?.()
  } catch {
    // Browser development and older Telegram clients do not expose haptics.
  }
}

interface GestureState {
  pointerId: number
  sourceIndex: number
  startX: number
  startY: number
  lastX: number
  lastTime: number
  velocity: number
  axis: "pending" | "horizontal" | "vertical"
}

interface PendingRoute {
  path: MainTabRoute
  scrollY: number
}

export interface SwipeGestureController {
  isMoving: boolean
  isDragging: boolean
  visualSourceIndex: number | null
  activeTargetIndex: number | null
  previewTop: number
  navigate: (path: MainTabRoute) => boolean
  handlePointerDown: (event: React.PointerEvent<HTMLElement>) => void
  handlePointerMove: (event: React.PointerEvent<HTMLElement>) => void
  handlePointerUp: (event: React.PointerEvent<HTMLElement>) => void
  handlePointerCancel: (event: React.PointerEvent<HTMLElement>) => void
}

/**
 * Touch-only swipe gesture engine for the main tabs: finger-following drag
 * preview, RTL-aware thresholds, per-tab scroll restore and the atomic
 * preview-to-page swap after Next.js mounts the canonical route.
 */
export function useSwipeGesture({
  mainRef,
  pageX,
  pathname,
  currentIndex,
  exactCurrentIndex,
  viewportWidth,
  shouldReduceMotion,
  ensureRoutePreviewReady,
  isRoutePreviewReady,
}: {
  mainRef: React.RefObject<HTMLElement | null>
  pageX: MotionValue<number>
  pathname: string
  currentIndex: number
  exactCurrentIndex: number
  viewportWidth: number
  shouldReduceMotion: boolean
  ensureRoutePreviewReady: (index: number) => Promise<void>
  isRoutePreviewReady: (index: number) => boolean
}): SwipeGestureController {
  const router = useRouter()
  const [visualSourceIndex, setVisualSourceIndex] = React.useState<
    number | null
  >(null)
  const [activeTargetIndex, setActiveTargetIndex] = React.useState<
    number | null
  >(null)
  const [previewTop, setPreviewTop] = React.useState(0)
  const [isMoving, setIsMoving] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)

  const movingRef = React.useRef(false)
  const previousPathnameRef = React.useRef(pathname)
  const gestureRef = React.useRef<GestureState | null>(null)
  const targetIndexRef = React.useRef<number | null>(null)
  const pendingRouteRef = React.useRef<PendingRoute | null>(null)
  const controlsRef = React.useRef<ReturnType<typeof animate> | null>(null)
  const navigationTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const transitionAttemptRef = React.useRef(0)
  const suppressClickUntilRef = React.useRef(0)
  const scrollPositionsRef = React.useRef(new Map<MainTabRoute, number>())
  const stabilizationFrameRef = React.useRef<number | null>(null)

  function setMovingState(moving: boolean) {
    movingRef.current = moving
    setIsMoving(moving)
  }

  function clearNavigationTimeout() {
    if (navigationTimeoutRef.current !== null) {
      clearTimeout(navigationTimeoutRef.current)
      navigationTimeoutRef.current = null
    }
  }

  function resetVisualState() {
    transitionAttemptRef.current += 1
    controlsRef.current?.stop()
    controlsRef.current = null
    clearNavigationTimeout()
    pageX.set(0)
    targetIndexRef.current = null
    gestureRef.current = null
    pendingRouteRef.current = null
    setMovingState(false)
    setIsDragging(false)
    setVisualSourceIndex(null)
    setActiveTargetIndex(null)
    setPreviewTop(0)
  }

  function prepareTarget(sourceIndex: number, targetIndex: number): boolean {
    if (!isRoutePreviewReady(targetIndex)) return false

    const sourceRoute = MAIN_TAB_ROUTES[sourceIndex]!
    const targetRoute = MAIN_TAB_ROUTES[targetIndex]!
    const currentScrollY = window.scrollY

    // Motion values update outside React. Commit the preview first so moving
    // the source page can never reveal the shell background for one frame.
    flushSync(() => {
      scrollPositionsRef.current.set(sourceRoute, currentScrollY)
      setVisualSourceIndex(sourceIndex)
      setActiveTargetIndex(targetIndex)
      setPreviewTop(
        currentScrollY - (scrollPositionsRef.current.get(targetRoute) ?? 0)
      )
      targetIndexRef.current = targetIndex
    })

    return true
  }

  function pushPreparedRoute(targetIndex: number) {
    const path = MAIN_TAB_ROUTES[targetIndex]!
    pendingRouteRef.current = {
      path,
      scrollY: scrollPositionsRef.current.get(path) ?? 0,
    }

    clearNavigationTimeout()
    navigationTimeoutRef.current = setTimeout(() => {
      if (pendingRouteRef.current?.path === path) resetVisualState()
    }, ROUTE_TRANSITION_TIMEOUT_MS)

    router.push(path, { scroll: false })
  }

  function settleToRoute(sourceIndex: number, targetIndex: number) {
    setMovingState(true)
    setIsDragging(false)

    if (shouldReduceMotion || viewportWidth <= 0) {
      pushPreparedRoute(targetIndex)
      return
    }

    const attempt = ++transitionAttemptRef.current
    clearNavigationTimeout()
    navigationTimeoutRef.current = setTimeout(() => {
      if (transitionAttemptRef.current === attempt) resetVisualState()
    }, ROUTE_TRANSITION_TIMEOUT_MS)

    const beginTransition = () => {
      if (
        transitionAttemptRef.current !== attempt ||
        !movingRef.current ||
        !prepareTarget(sourceIndex, targetIndex)
      ) {
        return
      }

      // The previous timer guarded cold-preview readiness. Once the target
      // is ready, restart the guard for the animation itself so a late
      // preload cannot be cancelled by the old deadline mid-transition.
      clearNavigationTimeout()
      navigationTimeoutRef.current = setTimeout(() => {
        if (transitionAttemptRef.current === attempt) resetVisualState()
      }, ROUTE_TRANSITION_TIMEOUT_MS)

      const exitX = navigationExitX(sourceIndex, targetIndex, viewportWidth)
      const remaining = Math.abs(exitX - pageX.get()) / viewportWidth

      controlsRef.current?.stop()
      controlsRef.current = animate(pageX, exitX, {
        type: "tween",
        duration: Math.min(0.28, Math.max(0.16, 0.14 + remaining * 0.14)),
        ease: RELEASE_EASING,
        onComplete: () => {
          if (transitionAttemptRef.current === attempt) {
            pushPreparedRoute(targetIndex)
          }
        },
      })
    }

    if (isRoutePreviewReady(targetIndex)) {
      beginTransition()
      return
    }

    // A very early gesture can beat the background preload. Keep the
    // current page fully in place, then animate once real content is ready.
    pageX.set(0)
    setActiveTargetIndex(null)
    void ensureRoutePreviewReady(targetIndex)
      .then(beginTransition)
      .catch(() => {
        if (transitionAttemptRef.current === attempt) resetVisualState()
      })
  }

  function cancelSwipe() {
    setIsDragging(false)

    if (shouldReduceMotion || pageX.get() === 0) {
      resetVisualState()
      return
    }

    setMovingState(true)
    controlsRef.current?.stop()
    controlsRef.current = animate(pageX, 0, {
      type: "tween",
      duration: 0.2,
      ease: RELEASE_EASING,
      onComplete: resetVisualState,
    })
  }

  function navigate(path: MainTabRoute): boolean {
    const targetIndex = MAIN_TAB_ROUTES.indexOf(path)
    if (targetIndex < 0 || movingRef.current) return movingRef.current
    if (targetIndex === currentIndex && pathname === path) return true

    const sourceIndex = currentIndex
    if (
      sourceIndex < 0 ||
      exactCurrentIndex < 0 ||
      Math.abs(targetIndex - sourceIndex) !== 1 ||
      shouldReduceMotion
    ) {
      if (exactCurrentIndex >= 0) {
        scrollPositionsRef.current.set(
          MAIN_TAB_ROUTES[exactCurrentIndex]!,
          window.scrollY
        )
      }
      setMovingState(true)
      pushPreparedRoute(targetIndex)
      return true
    }

    pageX.set(0)
    settleToRoute(sourceIndex, targetIndex)
    return true
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    const effectiveWidth =
      mainRef.current?.clientWidth ||
      viewportWidth ||
      (typeof window !== "undefined" ? window.innerWidth : 0)
    if (
      event.pointerType !== "touch" ||
      !event.isPrimary ||
      event.button !== 0 ||
      exactCurrentIndex < 0 ||
      movingRef.current ||
      effectiveWidth <= 0
    ) {
      return
    }

    if (shouldIgnoreSwipeStart(event.target)) return

    controlsRef.current?.stop()
    gestureRef.current = {
      pointerId: event.pointerId,
      sourceIndex: exactCurrentIndex,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      axis: "pending",
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    const deltaX = event.clientX - gesture.startX
    const deltaY = event.clientY - gesture.startY

    if (gesture.axis === "pending") {
      gesture.axis = resolveGestureAxis(deltaX, deltaY)
      if (gesture.axis === "pending") return
      if (gesture.axis === "vertical") return

      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // The pointer may already have been cancelled by the webview.
      }

      suppressClickUntilRef.current = performance.now() + 350
      setMovingState(true)
      setIsDragging(true)
      setVisualSourceIndex(gesture.sourceIndex)
    }

    if (gesture.axis !== "horizontal") return
    event.preventDefault()

    const elapsed = Math.max(1, event.timeStamp - gesture.lastTime)
    const instantVelocity = (event.clientX - gesture.lastX) / elapsed
    gesture.velocity = gesture.velocity * 0.35 + instantVelocity * 0.65
    gesture.lastX = event.clientX
    gesture.lastTime = event.timeStamp

    const targetIndex = swipeTargetIndex(gesture.sourceIndex, deltaX)
    if (targetIndex !== targetIndexRef.current) {
      transitionAttemptRef.current += 1
      clearNavigationTimeout()
      targetIndexRef.current = targetIndex
      if (targetIndex === null) {
        setActiveTargetIndex(null)
      } else if (!prepareTarget(gesture.sourceIndex, targetIndex)) {
        const attempt = transitionAttemptRef.current
        setActiveTargetIndex(null)
        pageX.set(0)
        navigationTimeoutRef.current = setTimeout(() => {
          if (transitionAttemptRef.current === attempt) resetVisualState()
        }, ROUTE_TRANSITION_TIMEOUT_MS)

        void ensureRoutePreviewReady(targetIndex)
          .then(() => {
            const activeGesture = gestureRef.current
            if (
              transitionAttemptRef.current !== attempt ||
              activeGesture !== gesture ||
              activeGesture.axis !== "horizontal" ||
              targetIndexRef.current !== targetIndex
            ) {
              return
            }

            clearNavigationTimeout()
            if (!prepareTarget(gesture.sourceIndex, targetIndex)) {
              resetVisualState()
              return
            }

            if (!shouldReduceMotion) {
              pageX.set(
                Math.max(
                  -viewportWidth,
                  Math.min(
                    viewportWidth,
                    activeGesture.lastX - activeGesture.startX
                  )
                )
              )
            }
          })
          .catch(() => {
            if (transitionAttemptRef.current === attempt) {
              resetVisualState()
            }
          })
      }
    }

    if (shouldReduceMotion) return
    pageX.set(
      targetIndex === null
        ? dampBoundaryDrag(deltaX, viewportWidth)
        : isRoutePreviewReady(targetIndex)
          ? Math.max(-viewportWidth, Math.min(viewportWidth, deltaX))
          : 0
    )
  }

  function finishPointer(
    event: React.PointerEvent<HTMLElement>,
    cancelled: boolean
  ) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Pointer capture is best-effort across Android/iOS webviews.
    }

    gestureRef.current = null
    if (gesture.axis !== "horizontal") return

    suppressClickUntilRef.current = performance.now() + 350
    const rawOffset = event.clientX - gesture.startX
    const targetIndex = swipeTargetIndex(gesture.sourceIndex, rawOffset)
    const targetIsReady =
      targetIndex !== null && isRoutePreviewReady(targetIndex)
    const offset =
      shouldReduceMotion || !targetIsReady ? rawOffset : pageX.get()
    const releaseVelocity = decaySwipeVelocity(
      gesture.velocity,
      event.timeStamp - gesture.lastTime
    )
    const commit =
      !cancelled &&
      shouldCommitSwipe({
        offset,
        velocity: releaseVelocity,
        viewportWidth,
        hasTarget: targetIndex !== null,
      })

    if (commit && targetIndex !== null) {
      settleToRoute(gesture.sourceIndex, targetIndex)
    } else {
      cancelSwipe()
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>) {
    finishPointer(event, false)
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLElement>) {
    finishPointer(event, true)
  }

  // Per-tab scroll memory: remember the latest scroll offset while the tab
  // is the canonical route and the swipe transition is not in flight.
  React.useEffect(() => {
    if (exactCurrentIndex < 0 || movingRef.current) return
    const route = MAIN_TAB_ROUTES[exactCurrentIndex]!
    const rememberScroll = () => {
      if (!movingRef.current) {
        scrollPositionsRef.current.set(route, window.scrollY)
      }
    }

    rememberScroll()
    window.addEventListener("scroll", rememberScroll, { passive: true })
    return () => window.removeEventListener("scroll", rememberScroll)
  }, [exactCurrentIndex])

  // After a swipe-driven router.push the canonical page mounts behind its
  // warmed preview. Restore the destination scroll, then atomically swap the
  // two trees once the new page has had a stabilization window of frames.
  const handlePathnameChange = React.useEffectEvent(() => {
    const pending = pendingRouteRef.current
    if (!pending || pathname !== pending.path) {
      // Browser history, redirects, and external navigation invalidate any
      // preview or import callback that still belongs to the previous route.
      if (movingRef.current) resetVisualState()
      return
    }

    clearNavigationTimeout()
    setPreviewTop(0)
    window.scrollTo({ top: pending.scrollY, behavior: "instant" })

    const hasCoveringPreview =
      !shouldReduceMotion &&
      movingRef.current &&
      targetIndexRef.current !== null &&
      pageX.get() !== 0

    if (!hasCoveringPreview) {
      resetVisualState()
      triggerSelectionHaptic()
      return
    }

    let remainingFrames =
      pending.path === "/courses"
        ? COURSES_STABILIZATION_FRAMES
        : ROUTE_STABILIZATION_FRAMES
    const advance = () => {
      remainingFrames -= 1
      if (remainingFrames === 0) {
        flushSync(resetVisualState)
        triggerSelectionHaptic()
        return
      }
      stabilizationFrameRef.current = requestAnimationFrame(advance)
    }

    stabilizationFrameRef.current = requestAnimationFrame(advance)
  })

  React.useLayoutEffect(() => {
    const pathnameChanged = previousPathnameRef.current !== pathname
    previousPathnameRef.current = pathname
    if (!pathnameChanged) return

    handlePathnameChange()
    return () => {
      if (stabilizationFrameRef.current !== null) {
        cancelAnimationFrame(stabilizationFrameRef.current)
      }
    }
  }, [pathname])

  React.useEffect(() => {
    return () => {
      transitionAttemptRef.current += 1
      movingRef.current = false
      gestureRef.current = null
      pendingRouteRef.current = null
      controlsRef.current?.stop()
      if (navigationTimeoutRef.current !== null) {
        clearTimeout(navigationTimeoutRef.current)
        navigationTimeoutRef.current = null
      }
    }
  }, [])

  // A touch drag that ends with movement leaves a synthetic click behind.
  // Swallow it during the suppression window so the release cannot activate
  // whatever element happens to sit under the finger.
  React.useEffect(() => {
    const element = mainRef.current
    if (!element) return

    const suppressGhostClick = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntilRef.current) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    element.addEventListener("click", suppressGhostClick, true)
    return () => element.removeEventListener("click", suppressGhostClick, true)
  }, [mainRef])

  return {
    isMoving,
    isDragging,
    visualSourceIndex,
    activeTargetIndex,
    previewTop,
    navigate,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  }
}
