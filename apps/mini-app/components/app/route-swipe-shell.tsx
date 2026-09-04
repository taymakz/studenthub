"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  animate,
  motion,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react"
import * as React from "react"

import { DrawerDirectionObserverProvider } from "@workspace/ui/components/drawer-direction-observer"

import {
  decaySwipeVelocity,
  dampBoundaryDrag,
  MAIN_TAB_ROUTES,
  mainTabIndex,
  navigationExitX,
  resolveGestureAxis,
  shouldCommitSwipe,
  swipeTargetIndex,
  type MainTabRoute,
} from "@/lib/route-swipe"
import { RoutePageProvider } from "@/lib/route-preview-context"

const ROUTE_LOADERS = [
  () => import("@/app/(bootstrap)/(app)/profile/page"),
  () => import("@/app/(bootstrap)/(app)/courses/page"),
  () => import("@/app/(bootstrap)/(app)/dashboard/page"),
  () => import("@/app/(bootstrap)/(app)/settings/page"),
] as const

const ProfileRoute = React.lazy(ROUTE_LOADERS[0])
const CoursesRoute = React.lazy(ROUTE_LOADERS[1])
const DashboardRoute = React.lazy(ROUTE_LOADERS[2])
const SettingsRoute = React.lazy(ROUTE_LOADERS[3])

const ROUTE_COMPONENTS = [
  ProfileRoute,
  CoursesRoute,
  DashboardRoute,
  SettingsRoute,
] as const

const SWIPE_IGNORE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[role='slider']",
  "[data-route-swipe-ignore]",
  "[data-slot='carousel']",
  "[data-slot^='drawer-']",
  "[data-slot^='dialog-']",
  "[data-slot^='alert-dialog-']",
].join(",")

const RELEASE_EASING = [0.32, 0.72, 0, 1] as const

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

interface RouteSwipeNavigationValue {
  navigate: (path: MainTabRoute) => boolean
  isNavigating: boolean
}

const RouteSwipeNavigationContext =
  React.createContext<RouteSwipeNavigationValue | null>(null)

export function useRouteSwipeNavigation(): RouteSwipeNavigationValue | null {
  return React.useContext(RouteSwipeNavigationContext)
}

function RoutePreviewLoading() {
  return <div className="min-h-dvh bg-background" aria-hidden />
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

function RoutePreview({
  index,
  sourceIndex,
  viewportWidth,
  pageX,
  active,
  top,
  overlayHost,
}: {
  index: number
  sourceIndex: number
  viewportWidth: number
  pageX: MotionValue<number>
  active: boolean
  top: number
  overlayHost: HTMLElement | null
}) {
  const Component = ROUTE_COMPONENTS[index]!
  const previewX = useTransform(pageX, (value) => {
    const restingX = index < sourceIndex ? viewportWidth : -viewportWidth
    return value + restingX
  })
  const routePageContext = React.useMemo(
    () => ({
      isPreview: true,
      overlayHost,
      overlayX: previewX,
      interactive: false,
    }),
    [overlayHost, previewX]
  )

  return (
    <motion.div
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
    >
      <React.Suspense fallback={<RoutePreviewLoading />}>
        <DrawerDirectionObserverProvider enabled={false}>
          <RoutePageProvider value={routePageContext}>
            <Component />
          </RoutePageProvider>
        </DrawerDirectionObserverProvider>
      </React.Suspense>
    </motion.div>
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

  const movingRef = React.useRef(false)
  const gestureRef = React.useRef<GestureState | null>(null)
  const targetIndexRef = React.useRef<number | null>(null)
  const pendingRouteRef = React.useRef<PendingRoute | null>(null)
  const controlsRef = React.useRef<ReturnType<typeof animate> | null>(null)
  const navigationTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const suppressClickUntilRef = React.useRef(0)
  const scrollPositionsRef = React.useRef(new Map<MainTabRoute, number>())

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

    const updateWidth = () => setViewportWidth(element.clientWidth || window.innerWidth || 390)
    setViewportWidth(element.clientWidth || window.innerWidth || 390)

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    // Warm only the two possible swipe destinations. Importing the modules
    // has no component side effects, unlike mounting hidden route trees.
    for (const index of [currentIndex - 1, currentIndex + 1]) {
      if (index >= 0 && index < ROUTE_LOADERS.length) {
        void ROUTE_LOADERS[index]!().catch(() => undefined)
      }
    }
  }, [currentIndex])

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
    const pending = pendingRouteRef.current
    if (!pending || pathname !== pending.path) return

    // The preview is already exactly over the viewport. Swap it for Next's
    // canonical route tree before paint, then restore that tab's own scroll.
    window.scrollTo({ top: pending.scrollY, behavior: "instant" })
    resetVisualState()
    triggerSelectionHaptic()
  }, [pathname, resetVisualState])

  React.useEffect(() => {
    return () => {
      controlsRef.current?.stop()
      clearNavigationTimeout()
    }
  }, [clearNavigationTimeout])

  const prepareTarget = React.useCallback(
    (sourceIndex: number, targetIndex: number) => {
      const sourceRoute = MAIN_TAB_ROUTES[sourceIndex]!
      const targetRoute = MAIN_TAB_ROUTES[targetIndex]!
      const currentScrollY = window.scrollY

      scrollPositionsRef.current.set(sourceRoute, currentScrollY)
      setVisualSourceIndex(sourceIndex)
      setActiveTargetIndex(targetIndex)
      setPreviewTop(
        currentScrollY - (scrollPositionsRef.current.get(targetRoute) ?? 0)
      )
      targetIndexRef.current = targetIndex
    },
    []
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
      }, 4000)

      router.push(path, { scroll: false })
    },
    [clearNavigationTimeout, resetVisualState, router]
  )

  const settleToRoute = React.useCallback(
    (sourceIndex: number, targetIndex: number) => {
      setMovingState(true)
      setIsDragging(false)
      prepareTarget(sourceIndex, targetIndex)

      if (shouldReduceMotion || viewportWidth <= 0) {
        pushPreparedRoute(targetIndex)
        return
      }

      const exitX = navigationExitX(sourceIndex, targetIndex, viewportWidth)
      const remaining = Math.abs(exitX - pageX.get()) / viewportWidth

      controlsRef.current?.stop()
      controlsRef.current = animate(pageX, exitX, {
        type: "tween",
        duration: Math.min(0.28, Math.max(0.16, 0.14 + remaining * 0.14)),
        ease: RELEASE_EASING,
        onComplete: () => pushPreparedRoute(targetIndex),
      })
    },
    [
      pageX,
      prepareTarget,
      pushPreparedRoute,
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
      setMovingState(true)
      prepareTarget(sourceIndex, targetIndex)
      requestAnimationFrame(() => settleToRoute(sourceIndex, targetIndex))
      return true
    },
    [
      currentIndex,
      exactCurrentIndex,
      pageX,
      pathname,
      prepareTarget,
      pushPreparedRoute,
      setMovingState,
      settleToRoute,
      shouldReduceMotion,
    ]
  )

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const effectiveWidth = mainRef.current?.clientWidth || viewportWidth || (typeof window !== "undefined" ? window.innerWidth : 0)
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

    const target = event.target
    if (target instanceof Element && target.closest(SWIPE_IGNORE_SELECTOR)) {
      return
    }

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
      targetIndexRef.current = targetIndex
      if (targetIndex === null) {
        setActiveTargetIndex(null)
      } else {
        prepareTarget(gesture.sourceIndex, targetIndex)
      }
    }

    if (shouldReduceMotion) return
    pageX.set(
      targetIndex === null
        ? dampBoundaryDrag(deltaX, viewportWidth)
        : Math.max(-viewportWidth, Math.min(viewportWidth, deltaX))
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
    const offset = shouldReduceMotion ? rawOffset : pageX.get()
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
  const previewIndexes =
    activeTargetIndex === null || activeTargetIndex === sourceIndex
      ? []
      : [activeTargetIndex]

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
        {[...previewIndexes].map((index) => (
          <RoutePreview
            key={MAIN_TAB_ROUTES[index]}
            index={index}
            sourceIndex={sourceIndex}
            viewportWidth={viewportWidth}
            pageX={pageX}
            active={index === activeTargetIndex}
            top={previewTop}
            overlayHost={overlayHost}
          />
        ))}

        <motion.div
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
        </motion.div>
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
