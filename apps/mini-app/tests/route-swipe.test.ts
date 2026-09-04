import { describe, expect, it } from "vitest"

import {
  decaySwipeVelocity,
  dampBoundaryDrag,
  mainTabIndex,
  navigationExitX,
  resolveGestureAxis,
  shouldCommitSwipe,
  swipeTargetIndex,
} from "../lib/route-swipe"

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
