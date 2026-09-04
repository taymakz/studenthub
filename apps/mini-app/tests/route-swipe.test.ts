import { describe, expect, it, vi } from "vitest"

import {
  createPreloadableRoute,
  preloadRoutesConcurrently,
} from "../lib/preloadable-route"
import {
  decaySwipeVelocity,
  dampBoundaryDrag,
  isRouteSwipeBlockingOverlaySlot,
  mainTabIndex,
  navigationExitX,
  resolveGestureAxis,
  shouldCommitSwipe,
  swipeTargetIndex,
} from "../lib/route-swipe"

describe("route preview preload", () => {
  it("renders from the shared component cache on its first preview", async () => {
    const RouteComponent = () => null
    let resolveLoader!: (routeModule: {
      default: typeof RouteComponent
    }) => void
    const loader = vi.fn(
      () =>
        new Promise<{ default: typeof RouteComponent }>((resolve) => {
          resolveLoader = resolve
        })
    )
    const route = createPreloadableRoute(loader)

    const firstLoad = route.preload()
    const secondLoad = route.preload()

    expect(firstLoad).toBe(secondLoad)
    expect(route.getComponent()).toBeNull()

    resolveLoader({ default: RouteComponent })

    await expect(firstLoad).resolves.toBe(RouteComponent)
    expect(route.getComponent()).toBe(RouteComponent)
    expect(route.preload()).toBe(firstLoad)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it("can retry a failed route import", async () => {
    const RouteComponent = () => null
    let attempt = 0
    const loader = vi.fn(() => {
      attempt += 1
      return attempt === 1
        ? Promise.reject(new Error("chunk failed"))
        : Promise.resolve({ default: RouteComponent })
    })
    const route = createPreloadableRoute(loader)

    await expect(route.preload()).rejects.toThrow("chunk failed")
    await expect(route.preload()).resolves.toBe(RouteComponent)

    expect(route.getComponent()).toBe(RouteComponent)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it("starts all tab imports together and isolates a failed chunk", async () => {
    const RouteComponent = () => null
    const resolvers: Array<
      (routeModule: { default: typeof RouteComponent }) => void
    > = []
    const loaders = Array.from({ length: 4 }, (_, index) =>
      vi.fn(
        () =>
          new Promise<{ default: typeof RouteComponent }>((resolve, reject) => {
            if (index === 2) {
              reject(new Error("dashboard chunk failed"))
              return
            }
            resolvers.push(resolve)
          })
      )
    )
    const routes = loaders.map((loader) => createPreloadableRoute(loader))

    const preload = preloadRoutesConcurrently(routes)

    expect(loaders.every((loader) => loader.mock.calls.length === 1)).toBe(true)
    for (const resolve of resolvers) resolve({ default: RouteComponent })

    const results = await preload
    expect(results.map((result) => result.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "rejected",
      "fulfilled",
    ])
    expect(routes[0]!.getComponent()).toBe(RouteComponent)
    expect(routes[1]!.getComponent()).toBe(RouteComponent)
    expect(routes[2]!.getComponent()).toBeNull()
    expect(routes[3]!.getComponent()).toBe(RouteComponent)
  })
})

describe("route swipe start targets", () => {
  it("allows closed overlay triggers to start a route swipe", () => {
    expect(isRouteSwipeBlockingOverlaySlot("drawer-trigger")).toBe(false)
    expect(isRouteSwipeBlockingOverlaySlot("dialog-trigger")).toBe(false)
    expect(isRouteSwipeBlockingOverlaySlot("alert-dialog-trigger")).toBe(false)
  })

  it("keeps gestures inside open overlays isolated from route swipes", () => {
    expect(isRouteSwipeBlockingOverlaySlot("drawer-popup")).toBe(true)
    expect(isRouteSwipeBlockingOverlaySlot("drawer-menu-trigger")).toBe(true)
    expect(isRouteSwipeBlockingOverlaySlot("dialog-viewport")).toBe(true)
    expect(isRouteSwipeBlockingOverlaySlot("alert-dialog-content")).toBe(true)
    expect(isRouteSwipeBlockingOverlaySlot("button")).toBe(false)
    expect(isRouteSwipeBlockingOverlaySlot(null)).toBe(false)
  })
})

describe("route swipe gesture", () => {
  it("locks only after a clear horizontal or vertical intent", () => {
    expect(resolveGestureAxis(5, 2)).toBe("pending")
    expect(resolveGestureAxis(18, 5)).toBe("horizontal")
    expect(resolveGestureAxis(7, 18)).toBe("vertical")
    expect(resolveGestureAxis(12, 12)).toBe("vertical")
  })

  it("maps physical swipe direction to the RTL tab order", () => {
    expect(swipeTargetIndex(1, -40)).toBe(0)
    expect(swipeTargetIndex(1, 40)).toBe(2)
    expect(swipeTargetIndex(0, -40)).toBeNull()
    expect(swipeTargetIndex(3, 40)).toBeNull()
  })

  it("moves the source toward the side opposite its target", () => {
    expect(navigationExitX(1, 0, 390)).toBe(-390)
    expect(navigationExitX(1, 2, 390)).toBe(390)
  })

  it("commits by distance or flick velocity, but never at a boundary", () => {
    expect(
      shouldCommitSwipe({
        offset: 90,
        velocity: 0.1,
        viewportWidth: 390,
        hasTarget: true,
      })
    ).toBe(true)
    expect(
      shouldCommitSwipe({
        offset: 25,
        velocity: 0.6,
        viewportWidth: 390,
        hasTarget: true,
      })
    ).toBe(true)
    expect(
      shouldCommitSwipe({
        offset: 25,
        velocity: -0.8,
        viewportWidth: 390,
        hasTarget: true,
      })
    ).toBe(false)
    expect(
      shouldCommitSwipe({
        offset: 25,
        velocity: 0.1,
        viewportWidth: 390,
        hasTarget: true,
      })
    ).toBe(false)
    expect(
      shouldCommitSwipe({
        offset: 300,
        velocity: 1,
        viewportWidth: 390,
        hasTarget: false,
      })
    ).toBe(false)
  })

  it("decays stale flick velocity while the pointer is held still", () => {
    expect(decaySwipeVelocity(0.8, 0)).toBe(0.8)
    expect(decaySwipeVelocity(0.8, 140)).toBeLessThan(0.3)
  })

  it("applies bounded resistance beyond the first and last tab", () => {
    expect(dampBoundaryDrag(20, 390)).toBeGreaterThan(0)
    expect(dampBoundaryDrag(-20, 390)).toBeLessThan(0)
    expect(Math.abs(dampBoundaryDrag(1000, 390))).toBeLessThanOrEqual(31.2)
  })
})

describe("main tab matching", () => {
  it("supports nested tab routes without enabling exact-route swipes", () => {
    expect(mainTabIndex("/dashboard/professors")).toBe(2)
    expect(mainTabIndex("/dashboard/professors", true)).toBe(-1)
    expect(mainTabIndex("/settings", true)).toBe(3)
  })
})
