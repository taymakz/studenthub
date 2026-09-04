"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  animate,
  m,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import * as React from "react"
import { flushSync } from "react-dom"

import { DrawerDirectionObserverProvider } from "@workspace/ui/components/drawer-direction-observer"

import {
  ALL_MAIN_TAB_ROUTES_MASK,
  MAIN_TAB_ROUTE_COMPONENTS,
} from "@/lib/main-tab-route-preload"
import { useMainTabWarmup } from "@/lib/main-tab-warmup-context"
import {
  decaySwipeVelocity,
  dampBoundaryDrag,
  isRouteSwipeBlockingOverlaySlot,
  MAIN_TAB_ROUTES,
  mainTabIndex,
  navigationExitX,
  resolveGestureAxis,
  shouldCommitSwipe,
  swipeTargetIndex,
  type MainTabRoute,
} from "@/lib/route-swipe"
import { RoutePageProvider } from "@/lib/route-preview-context"

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

const RELEASE_EASING = [0.32, 0.72, 0, 1] as const
const ROUTE_TRANSITION_TIMEOUT_MS = 4000
const ROUTE_PREVIEW_READY_TIMEOUT_MS = 4000
const COURSES_ROUTE_INDEX = MAIN_TAB_ROUTES.indexOf("/courses")
const ROUTE_STABILIZATION_FRAMES = 3
const COURSES_STABILIZATION_FRAMES = 6
const ROUTE_PREVIEW_MAX_STABILIZATION_FRAMES = 12
const COURSES_PREVIEW_MIN_RENDERED_ITEMS = 3

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

interface PreviewReadyWaiter {
  resolve: () => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

interface RouteSwipeNavigationValue {
  navigate: (path: MainTabRoute) => boolean
  isNavigating: boolean
}

const RouteSwipeNavigationContext =
  React.createContext<RouteSwipeNavigationValue | null>(null)

export function useRouteSwipeNavigation(): RouteSwipeNavigationValue | null {
  return React.useContext(RouteSwipeNavigationContext)
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

function RoutePreviewPrimeMarker({
  index,
  onPrimed,
}: {
  index: number
  onPrimed: (index: number) => void
}) {
  const markerRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    let frame: number | null = null
    let elapsedFrames = 0

    const advance = () => {
      elapsedFrames += 1
      const preview = markerRef.current?.closest("[data-route-swipe-preview]")
      const routeContentReady =
        index !== COURSES_ROUTE_INDEX ||
        (preview?.querySelectorAll("[data-index]").length ?? 0) >=
          COURSES_PREVIEW_MIN_RENDERED_ITEMS

      if (
        (elapsedFrames >= ROUTE_STABILIZATION_FRAMES && routeContentReady) ||
        elapsedFrames >= ROUTE_PREVIEW_MAX_STABILIZATION_FRAMES
      ) {
        onPrimed(index)
        return
      }
      frame = requestAnimationFrame(advance)
    }

    // Keep the Activity connected for several real rendering opportunities.
    // Virtuoso schedules measurements from ResizeObserver into a later frame;
    // hiding after the first passive effect would cancel that work.
    frame = requestAnimationFrame(advance)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [index, onPrimed])
  return <span ref={markerRef} hidden data-route-preview-prime-marker />
}

function RoutePreview({
  Component,
  index,
  sourceIndex,
  viewportWidth,
  pageX,
  active,
  priming,
  trackingWindowScroll,
  top,
  overlayHost,
  onPrimed,
}: {
  Component: React.ComponentType
  index: number
  sourceIndex: number
  viewportWidth: number
  pageX: MotionValue<number>
  active: boolean
  priming: boolean
  trackingWindowScroll: boolean
  top: number
  overlayHost: HTMLElement | null
  onPrimed: (index: number) => void
}) {
  const restingX = useMotionValue(
    index < sourceIndex ? viewportWidth : -viewportWidth
  )
  const previewX = useTransform(() => pageX.get() + restingX.get())

  // RoutePreview instances now survive for the whole app session. Keep the
  // resting offset in a MotionValue so this transform never captures the
  // source index from its first render.
  React.useLayoutEffect(() => {
    restingX.set(index < sourceIndex ? viewportWidth : -viewportWidth)
  }, [index, restingX, sourceIndex, viewportWidth])

  const routePageContext = React.useMemo(
    () => ({
      isPreview: true,
      // Hidden warm copies must not create portals in the shared overlay host.
      overlayHost: active ? overlayHost : null,
      overlayX: previewX,
      interactive: false,
    }),
    [active, overlayHost, previewX]
  )

  return (
    <m.div
      aria-hidden
      inert
      className="pointer-events-none absolute inset-x-0 min-h-dvh bg-background"
      style={{
        top: active ? top : 0,
        x: previewX,
        visibility: active ? "visible" : "hidden",
        zIndex: active ? 0 : -1,
        willChange: active ? "transform" : "auto",
      }}
      data-route-swipe-preview={MAIN_TAB_ROUTES[index]}
      data-route-swipe-preview-active={active}
    >
      <React.Activity
        name={`route-preview-${MAIN_TAB_ROUTES[index]}`}
        mode={active || priming || trackingWindowScroll ? "visible" : "hidden"}
      >
        <DrawerDirectionObserverProvider enabled={false}>
          <RoutePageProvider value={routePageContext}>
            <Component />
            {priming && (
              <RoutePreviewPrimeMarker index={index} onPrimed={onPrimed} />
            )}
          </RoutePageProvider>
        </DrawerDirectionObserverProvider>
      </React.Activity>
    </m.div>
  )
}

export function RouteSwipeShell({
  children,
  navigation,
}: Readonly<{
  children: React.ReactNode
  navigation: React.ReactNode
}>) {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const mainTabWarmup = useMainTabWarmup()
  const shouldReduceMotion = useReducedMotion() === true
  const mainRef = React.useRef<HTMLElement>(null)
  const pageX = useMotionValue(0)
  const currentTransform = useTransform(
    pageX,
    (value) => `translate3d(${value}px, 0, 0)`
  )

  const currentIndex = mainTabIndex(pathname)
  const exactCurrentIndex = mainTabIndex(pathname, true)
  const [viewportWidth, setViewportWidth] = React.useState(0)
  const [visualSourceIndex, setVisualSourceIndex] = React.useState<
    number | null
  >(null)
  const [activeTargetIndex, setActiveTargetIndex] = React.useState<
    number | null
  >(null)
  const [previewTop, setPreviewTop] = React.useState(0)
  const [isMoving, setIsMoving] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [overlayHost, setOverlayHost] = React.useState<HTMLDivElement | null>(
    null
  )
  const [loadedRoutesMask, setLoadedRoutesMask] = React.useState(0)
  const [primedRoutesMask, setPrimedRoutesMask] = React.useState(0)
  const [warmupStarted, setWarmupStarted] = React.useState(
    mainTabWarmup.enabled
  )

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
  const primedRoutesMaskRef = React.useRef(0)
  const previewReadyWaitersRef = React.useRef(
    new Map<number, Set<PreviewReadyWaiter>>()
  )
  const reportedWarmupRef = React.useRef(false)
  const registeredWarmupRef = React.useRef(false)
  const mountedRef = React.useRef(false)

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const setMovingState = React.useCallback((moving: boolean) => {
    movingRef.current = moving
    setIsMoving(moving)
  }, [])

  const clearNavigationTimeout = React.useCallback(() => {
    if (navigationTimeoutRef.current !== null) {
      clearTimeout(navigationTimeoutRef.current)
      navigationTimeoutRef.current = null
    }
  }, [])

  const resetVisualState = React.useCallback(() => {
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
  }, [clearNavigationTimeout, pageX, setMovingState])

  React.useLayoutEffect(() => {
    const element = mainRef.current
    if (!element) return

    const updateWidth = () =>
      setViewportWidth(element.clientWidth || window.innerWidth || 390)
    setViewportWidth(element.clientWidth || window.innerWidth || 390)

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  React.useLayoutEffect(() => {
    if (!mainTabWarmup.enabled || registeredWarmupRef.current) return
    registeredWarmupRef.current = true
    setWarmupStarted(true)
    mainTabWarmup.reportStarted()
  }, [mainTabWarmup])

  React.useEffect(() => {
    if (!warmupStarted) return
    let cancelled = false

    // Start all four chunks together. AppBootstrap may already have started
    // these same cached promises while the entry route was still "/".
    MAIN_TAB_ROUTE_COMPONENTS.forEach((route, index) => {
      void route
        .preload()
        .then(() => {
          if (!cancelled) {
            setLoadedRoutesMask((mask) => mask | (1 << index))
          }
        })
        .catch(() => undefined)
    })

    return () => {
      cancelled = true
    }
  }, [warmupStarted])

  const markRoutePrimed = React.useCallback((index: number) => {
    const bit = 1 << index
    if ((primedRoutesMaskRef.current & bit) !== 0) return

    primedRoutesMaskRef.current |= bit
    setPrimedRoutesMask(primedRoutesMaskRef.current)

    const waiters = previewReadyWaitersRef.current.get(index)
    if (!waiters) return
    previewReadyWaitersRef.current.delete(index)
    for (const waiter of waiters) waiter.resolve()
  }, [])

  const waitForRoutePrimed = React.useCallback((index: number) => {
    const bit = 1 << index
    if ((primedRoutesMaskRef.current & bit) !== 0) return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      let waiters = previewReadyWaitersRef.current.get(index)
      if (!waiters) {
        waiters = new Set()
        previewReadyWaitersRef.current.set(index, waiters)
      }

      const removeWaiter = (waiter: PreviewReadyWaiter) => {
        const currentWaiters = previewReadyWaitersRef.current.get(index)
        currentWaiters?.delete(waiter)
        if (currentWaiters?.size === 0) {
          previewReadyWaitersRef.current.delete(index)
        }
      }
      const waiter: PreviewReadyWaiter = {
        timeout: setTimeout(() => {
          removeWaiter(waiter)
          reject(new Error(`Route preview ${index} did not become ready`))
        }, ROUTE_PREVIEW_READY_TIMEOUT_MS),
        resolve: () => {
          clearTimeout(waiter.timeout)
          removeWaiter(waiter)
          resolve()
        },
        reject: (error) => {
          clearTimeout(waiter.timeout)
          removeWaiter(waiter)
          reject(error)
        },
      }
      waiters.add(waiter)
    })
  }, [])

  const ensureRoutePreviewReady = React.useCallback(
    async (index: number) => {
      await MAIN_TAB_ROUTE_COMPONENTS[index]!.preload()
      if (!mountedRef.current) {
        throw new Error("Route swipe shell unmounted during preload")
      }
      setLoadedRoutesMask((mask) => mask | (1 << index))
      await waitForRoutePrimed(index)
    },
    [waitForRoutePrimed]
  )

  const isRoutePreviewReady = React.useCallback(
    (index: number) =>
      (primedRoutesMaskRef.current & (1 << index)) !== 0 &&
      MAIN_TAB_ROUTE_COMPONENTS[index]!.getComponent() !== null,
    []
  )

  const primingIndex = React.useMemo(() => {
    if (!warmupStarted) return null

    // Prime one connected tree per turn so four heavy page mounts do not
    // compete in one long task. Prefer the current and nearest swipe targets.
    const order = MAIN_TAB_ROUTES.map((_, index) => index).sort(
      (a, b) => Math.abs(a - currentIndex) - Math.abs(b - currentIndex)
    )
    return (
      order.find((index) => {
        const bit = 1 << index
        return (loadedRoutesMask & bit) !== 0 && (primedRoutesMask & bit) === 0
      }) ?? null
    )
  }, [currentIndex, loadedRoutesMask, primedRoutesMask, warmupStarted])

  React.useEffect(() => {
    if (
      !mainTabWarmup.enabled ||
      primedRoutesMask !== ALL_MAIN_TAB_ROUTES_MASK ||
      reportedWarmupRef.current
    ) {
      return
    }

    let secondFrame: number | null = null
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        reportedWarmupRef.current = true
        mainTabWarmup.reportReady()
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame !== null) cancelAnimationFrame(secondFrame)
    }
  }, [mainTabWarmup, primedRoutesMask])

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

  React.useLayoutEffect(() => {
    const pathnameChanged = previousPathnameRef.current !== pathname
    previousPathnameRef.current = pathname
    if (!pathnameChanged) return

    const pending = pendingRouteRef.current
    if (!pending || pathname !== pending.path) {
      // Browser history, redirects, and external navigation invalidate any
      // preview or import callback that still belongs to the previous route.
      if (movingRef.current) resetVisualState()
      return
    }

    // Restore the destination scroll while its warmed preview still covers
    // the viewport. Next's canonical page has just mounted offscreen inside
    // the translated source frame; give it the same stabilization window as
    // the preview before atomically swapping the two trees.
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

    let frame: number | null = null
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
      frame = requestAnimationFrame(advance)
    }

    frame = requestAnimationFrame(advance)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [
    clearNavigationTimeout,
    pageX,
    pathname,
    resetVisualState,
    shouldReduceMotion,
  ])

  React.useEffect(() => {
    const previewReadyWaiters = previewReadyWaitersRef.current

    return () => {
      transitionAttemptRef.current += 1
      movingRef.current = false
      gestureRef.current = null
      pendingRouteRef.current = null
      controlsRef.current?.stop()
      clearNavigationTimeout()
      for (const waiters of previewReadyWaiters.values()) {
        for (const waiter of waiters) {
          waiter.reject(new Error("Route swipe shell unmounted"))
        }
      }
      previewReadyWaiters.clear()
    }
  }, [clearNavigationTimeout])

  const prepareTarget = React.useCallback(
    (sourceIndex: number, targetIndex: number): boolean => {
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
    },
    [isRoutePreviewReady]
  )

  const pushPreparedRoute = React.useCallback(
    (targetIndex: number) => {
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
    },
    [clearNavigationTimeout, resetVisualState, router]
  )

  const settleToRoute = React.useCallback(
    (sourceIndex: number, targetIndex: number) => {
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
    },
    [
      clearNavigationTimeout,
      ensureRoutePreviewReady,
      isRoutePreviewReady,
      pageX,
      prepareTarget,
      pushPreparedRoute,
      resetVisualState,
      setMovingState,
      shouldReduceMotion,
      viewportWidth,
    ]
  )

  const cancelSwipe = React.useCallback(() => {
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
  }, [pageX, resetVisualState, setMovingState, shouldReduceMotion])

  const navigate = React.useCallback(
    (path: MainTabRoute): boolean => {
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
    },
    [
      currentIndex,
      exactCurrentIndex,
      pageX,
      pathname,
      pushPreparedRoute,
      setMovingState,
      settleToRoute,
      shouldReduceMotion,
    ]
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
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

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
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

  const finishPointer = (
    event: React.PointerEvent<HTMLElement>,
    cancelled: boolean
  ) => {
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

  const sourceIndex = visualSourceIndex ?? currentIndex

  const contextValue = React.useMemo<RouteSwipeNavigationValue>(
    () => ({ navigate, isNavigating: isMoving }),
    [isMoving, navigate]
  )
  const routePageContext = React.useMemo(
    () => ({
      isPreview: false,
      overlayHost,
      overlayX: pageX,
      interactive: !isMoving,
    }),
    [isMoving, overlayHost, pageX]
  )
  const isVisualTransition =
    isMoving && visualSourceIndex !== null && !shouldReduceMotion

  return (
    <RouteSwipeNavigationContext.Provider value={contextValue}>
      <main
        ref={mainRef}
        className={`relative grow touch-pan-y overflow-x-clip ${
          isDragging ? "cursor-grabbing select-none" : ""
        }`}
        data-route-swipe-surface
        onClickCapture={(event) => {
          if (performance.now() < suppressClickUntilRef.current) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPointer(event, false)}
        onPointerCancel={(event) => finishPointer(event, true)}
      >
        {warmupStarted &&
          MAIN_TAB_ROUTE_COMPONENTS.map((route, index) => {
            const bit = 1 << index
            const Component =
              (loadedRoutesMask & bit) !== 0 ? route.getComponent() : null

            if (!Component) return null

            return (
              <RoutePreview
                key={MAIN_TAB_ROUTES[index]}
                Component={Component}
                index={index}
                sourceIndex={sourceIndex}
                viewportWidth={viewportWidth}
                pageX={pageX}
                active={index === activeTargetIndex}
                priming={index === primingIndex}
                trackingWindowScroll={
                  index === COURSES_ROUTE_INDEX && index === exactCurrentIndex
                }
                top={previewTop}
                overlayHost={overlayHost}
                onPrimed={markRoutePrimed}
              />
            )
          })}

        <m.div
          className="relative z-10 min-h-full bg-background"
          data-route-swipe-page
          style={{
            transform: isVisualTransition ? currentTransform : "none",
            boxShadow: isVisualTransition
              ? "0 0 18px rgb(0 0 0 / 18%)"
              : "none",
            pointerEvents: isMoving ? "none" : "auto",
            willChange: isVisualTransition ? "transform" : "auto",
            contain: "layout paint" as unknown as string,
          }}
        >
          <RoutePageProvider value={routePageContext}>
            {children}
          </RoutePageProvider>
        </m.div>
      </main>
      <div
        ref={setOverlayHost}
        className="pointer-events-none fixed inset-0 z-20 touch-pan-y overflow-clip"
        data-route-swipe-overlays
      />
      {navigation}
    </RouteSwipeNavigationContext.Provider>
  )
}
