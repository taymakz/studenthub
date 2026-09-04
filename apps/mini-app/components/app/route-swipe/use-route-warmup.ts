"use client"

import * as React from "react"

import {
  ALL_MAIN_TAB_ROUTES_MASK,
  MAIN_TAB_ROUTE_COMPONENTS,
} from "@/lib/main-tab-route-preload"
import { useMainTabWarmup } from "@/lib/main-tab-warmup-context"
import { MAIN_TAB_ROUTES } from "@/lib/route-swipe"

import { ROUTE_PREVIEW_READY_TIMEOUT_MS } from "./constants"

interface PreviewReadyWaiter {
  resolve: () => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

/**
 * Prime one connected tree per turn so four heavy page mounts do not compete
 * in one long task. Prefer the current and nearest swipe targets.
 */
function computePrimingIndex(
  enabled: boolean,
  currentIndex: number,
  loadedRoutesMask: number,
  primedRoutesMask: number
): number | null {
  if (!enabled) return null

  const order = MAIN_TAB_ROUTES.map((_, index) => index).sort(
    (a, b) => Math.abs(a - currentIndex) - Math.abs(b - currentIndex)
  )
  return (
    order.find((index) => {
      const bit = 1 << index
      return (loadedRoutesMask & bit) !== 0 && (primedRoutesMask & bit) === 0
    }) ?? null
  )
}

/**
 * Chunk preload + retained-preview warmup for the four main tabs. The shell
 * uses "primed" state to know when a preview tree is safe to reveal, and
 * reports completion back to the bootstrap splash cover.
 */
export function useRouteWarmup({ currentIndex }: { currentIndex: number }) {
  const mainTabWarmup = useMainTabWarmup()
  const [warmupStarted, setWarmupStarted] = React.useState(
    mainTabWarmup.enabled
  )
  const [loadedRoutesMask, setLoadedRoutesMask] = React.useState(0)
  const [primedRoutesMask, setPrimedRoutesMask] = React.useState(0)
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

  function markRoutePrimed(index: number) {
    const bit = 1 << index
    if ((primedRoutesMaskRef.current & bit) !== 0) return

    primedRoutesMaskRef.current |= bit
    setPrimedRoutesMask(primedRoutesMaskRef.current)

    const waiters = previewReadyWaitersRef.current.get(index)
    if (!waiters) return
    previewReadyWaitersRef.current.delete(index)
    for (const waiter of waiters) waiter.resolve()
  }

  function waitForRoutePrimed(index: number): Promise<void> {
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
  }

  async function ensureRoutePreviewReady(index: number) {
    await MAIN_TAB_ROUTE_COMPONENTS[index]!.preload()
    if (!mountedRef.current) {
      throw new Error("Route swipe shell unmounted during preload")
    }
    setLoadedRoutesMask((mask) => mask | (1 << index))
    await waitForRoutePrimed(index)
  }

  function isRoutePreviewReady(index: number) {
    return (
      (primedRoutesMaskRef.current & (1 << index)) !== 0 &&
      MAIN_TAB_ROUTE_COMPONENTS[index]!.getComponent() !== null
    )
  }

  const primingIndex = computePrimingIndex(
    warmupStarted,
    currentIndex,
    loadedRoutesMask,
    primedRoutesMask
  )

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
    const previewReadyWaiters = previewReadyWaitersRef.current

    return () => {
      for (const waiters of previewReadyWaiters.values()) {
        for (const waiter of waiters) {
          waiter.reject(new Error("Route swipe shell unmounted"))
        }
      }
      previewReadyWaiters.clear()
    }
  }, [])

  return {
    warmupStarted,
    loadedRoutesMask,
    primingIndex,
    markRoutePrimed,
    ensureRoutePreviewReady,
    isRoutePreviewReady,
  }
}
