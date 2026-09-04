"use client"

import { m, useMotionValue, useTransform, type MotionValue } from "motion/react"
import * as React from "react"

import { DrawerDirectionObserverProvider } from "@workspace/ui/components/drawer-direction-observer"

import { RoutePageProvider } from "@/lib/route-preview-context"
import { MAIN_TAB_ROUTES } from "@/lib/route-swipe"

import {
  COURSES_PREVIEW_MIN_RENDERED_ITEMS,
  COURSES_ROUTE_INDEX,
  ROUTE_PREVIEW_MAX_STABILIZATION_FRAMES,
  ROUTE_STABILIZATION_FRAMES,
} from "./constants"

function RoutePreviewPrimeMarker({
  index,
  onPrimed,
}: {
  index: number
  onPrimed: (index: number) => void
}) {
  const markerRef = React.useRef<HTMLSpanElement>(null)
  const notifyPrimed = React.useEffectEvent(onPrimed)

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
        notifyPrimed(index)
        return
      }
      frame = requestAnimationFrame(advance)
    }

    // Keep the retained route tree connected for several real rendering
    // opportunities. Virtuoso schedules measurements from ResizeObserver into
    // a later frame; hiding after the first passive effect would cancel that
    // work.
    frame = requestAnimationFrame(advance)
    return () => {
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [index])
  return <span ref={markerRef} hidden data-route-preview-prime-marker />
}

export function RoutePreview({
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

  // RoutePreview instances survive for the whole app session. Keep the
  // resting offset in a MotionValue so this transform never captures the
  // source index from its first render.
  React.useLayoutEffect(() => {
    restingX.set(index < sourceIndex ? viewportWidth : -viewportWidth)
  }, [index, restingX, sourceIndex, viewportWidth])

  const routePageContext = {
    isPreview: true,
    // Hidden warm copies must not create portals in the shared overlay host.
    overlayHost: active ? overlayHost : null,
    overlayX: previewX,
    interactive: false,
  }

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
          </RoutePageProvider>
        </DrawerDirectionObserverProvider>
      </React.Activity>
      {priming && (
        <RoutePreviewPrimeMarker index={index} onPrimed={onPrimed} />
      )}
    </m.div>
  )
}
