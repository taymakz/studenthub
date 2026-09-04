"use client"

import { usePathname } from "next/navigation"
import { m, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import * as React from "react"

import { MAIN_TAB_ROUTE_COMPONENTS } from "@/lib/main-tab-route-preload"
import { RoutePageProvider } from "@/lib/route-preview-context"
import { MAIN_TAB_ROUTES, mainTabIndex, type MainTabRoute } from "@/lib/route-swipe"

import { COURSES_ROUTE_INDEX } from "./route-swipe/constants"
import { RoutePreview } from "./route-swipe/route-preview"
import { useElementWidth } from "./route-swipe/use-element-width"
import { useRouteWarmup } from "./route-swipe/use-route-warmup"
import { useSwipeGesture } from "./route-swipe/use-swipe-gesture"

interface RouteSwipeNavigationValue {
  navigate: (path: MainTabRoute) => boolean
  isNavigating: boolean
}

const RouteSwipeNavigationContext =
  React.createContext<RouteSwipeNavigationValue | null>(null)

export function useRouteSwipeNavigation(): RouteSwipeNavigationValue | null {
  return React.useContext(RouteSwipeNavigationContext)
}

export function RouteSwipeShell({
  children,
  navigation,
}: Readonly<{
  children: React.ReactNode
  navigation: React.ReactNode
}>) {
  const pathname = usePathname() ?? ""
  const mainRef = React.useRef<HTMLElement>(null)
  const pageX = useMotionValue(0)
  const currentTransform = useTransform(
    pageX,
    (value) => `translate3d(${value}px, 0, 0)`
  )
  const shouldReduceMotion = useReducedMotion() === true

  const currentIndex = mainTabIndex(pathname)
  const exactCurrentIndex = mainTabIndex(pathname, true)
  const viewportWidth = useElementWidth(mainRef)
  const [overlayHost, setOverlayHost] = React.useState<HTMLDivElement | null>(
    null
  )
  const warmup = useRouteWarmup({ currentIndex })
  const gesture = useSwipeGesture({
    mainRef,
    pageX,
    pathname,
    currentIndex,
    exactCurrentIndex,
    viewportWidth,
    shouldReduceMotion,
    ensureRoutePreviewReady: warmup.ensureRoutePreviewReady,
    isRoutePreviewReady: warmup.isRoutePreviewReady,
  })

  const sourceIndex = gesture.visualSourceIndex ?? currentIndex
  const isVisualTransition =
    gesture.isMoving && gesture.visualSourceIndex !== null && !shouldReduceMotion
  const contextValue: RouteSwipeNavigationValue = {
    navigate: gesture.navigate,
    isNavigating: gesture.isMoving,
  }
  const routePageContext = {
    isPreview: false,
    overlayHost,
    overlayX: pageX,
    interactive: !gesture.isMoving,
  }

  return (
    <RouteSwipeNavigationContext.Provider value={contextValue}>
      <main
        ref={mainRef}
        className={`relative grow touch-pan-y overflow-x-clip ${
          gesture.isDragging ? "cursor-grabbing select-none" : ""
        }`}
        data-route-swipe-surface
        onPointerDown={gesture.handlePointerDown}
        onPointerMove={gesture.handlePointerMove}
        onPointerUp={gesture.handlePointerUp}
        onPointerCancel={gesture.handlePointerCancel}
      >
        {warmup.warmupStarted &&
          MAIN_TAB_ROUTE_COMPONENTS.map((route, index) => {
            const Component =
              (warmup.loadedRoutesMask & (1 << index)) !== 0
                ? route.getComponent()
                : null

            if (!Component) return null

            return (
              <RoutePreview
                key={MAIN_TAB_ROUTES[index]}
                Component={Component}
                index={index}
                sourceIndex={sourceIndex}
                viewportWidth={viewportWidth}
                pageX={pageX}
                active={index === gesture.activeTargetIndex}
                priming={index === warmup.primingIndex}
                trackingWindowScroll={
                  index === COURSES_ROUTE_INDEX && index === exactCurrentIndex
                }
                top={gesture.previewTop}
                overlayHost={overlayHost}
                onPrimed={warmup.markRoutePrimed}
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
            pointerEvents: gesture.isMoving ? "none" : "auto",
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
