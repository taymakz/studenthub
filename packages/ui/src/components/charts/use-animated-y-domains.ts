"use client"

import { animate, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import type { ChartPhase } from "./chart-phase"
import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing"
import {
  domainsEqual,
  isYDomainTweenPhase,
  resolveAnimatedYDestinationDomains,
  shouldTweenYDomain,
  type YDomain,
} from "./y-domain-utils"

function lerpDomain(from: YDomain, to: YDomain, progress: number): YDomain {
  return [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress,
  ]
}

function snapDomains(
  domains: Record<string, YDomain>,
  setAnimatedByAxis: (domains: Record<string, YDomain>) => void,
  animatedRef: { current: Record<string, YDomain> }
) {
  if (domainsEqual(animatedRef.current, domains)) {
    return
  }
  setAnimatedByAxis(domains)
  animatedRef.current = domains
}

function tweenDomains({
  destination,
  durationMs,
  enabled,
  reducedMotion,
  animatedRef,
  setAnimatedByAxis,
  onSettled,
}: {
  destination: Record<string, YDomain>
  durationMs: number
  enabled: boolean
  reducedMotion: boolean | null
  animatedRef: { current: Record<string, YDomain> }
  setAnimatedByAxis: (domains: Record<string, YDomain>) => void
  onSettled?: () => void
}) {
  if (domainsEqual(animatedRef.current, destination)) {
    onSettled?.()
    return
  }

  if (!enabled || reducedMotion) {
    snapDomains(destination, setAnimatedByAxis, animatedRef)
    onSettled?.()
    return
  }

  const axisIds = Object.keys(destination)
  const fromSnapshot = animatedRef.current

  let needsTween = false
  for (const axisId of axisIds) {
    const from =
      fromSnapshot[axisId] ?? destination[axisId] ?? ([0, 100] as YDomain)
    const to = destination[axisId] ?? from
    if (shouldTweenYDomain(from, to)) {
      needsTween = true
      break
    }
  }

  if (!needsTween) {
    snapDomains(destination, setAnimatedByAxis, animatedRef)
    onSettled?.()
    return
  }

  const fromByAxis: Record<string, YDomain> = {}
  for (const axisId of axisIds) {
    fromByAxis[axisId] = fromSnapshot[axisId] ?? destination[axisId] ?? [0, 100]
  }

  // Coalesce animation frames into at most one state update per task. Motion
  // can deliver several synchronous onUpdate bursts (parallel tweens, immediate
  // completion, StrictMode re-entry); committing each one directly nests state
  // updates past React's "maximum update depth" limit.
  let pendingDomains: Record<string, YDomain> | null = null
  let flushScheduled = false
  const flushPendingDomains = () => {
    flushScheduled = false
    if (!pendingDomains) {
      return
    }
    animatedRef.current = pendingDomains
    setAnimatedByAxis(pendingDomains)
    pendingDomains = null
  }

  const control = animate(0, 1, {
    duration: durationMs / 1000,
    ease: [...LINE_LOADING_PULSE_EASE],
    onUpdate: (progress) => {
      const next: Record<string, YDomain> = {}
      for (const axisId of axisIds) {
        const from =
          fromByAxis[axisId] ?? destination[axisId] ?? ([0, 100] as YDomain)
        const to = destination[axisId] ?? from
        next[axisId] = shouldTweenYDomain(from, to)
          ? lerpDomain(from, to, progress)
          : to
      }
      if (domainsEqual(animatedRef.current, next)) {
        return
      }
      pendingDomains = next
      if (!flushScheduled) {
        flushScheduled = true
        queueMicrotask(flushPendingDomains)
      }
    },
    onComplete: () => {
      // Flush any trailing frame before settling so the resting domain lands.
      flushScheduled = false
      pendingDomains = null
      snapDomains(destination, setAnimatedByAxis, animatedRef)
      onSettled?.()
    },
  })

  return {
    stop: () => {
      // Dropping the tween must also drop its queued frame — otherwise a
      // late microtask could commit stale domains over a newer animation.
      flushScheduled = false
      pendingDomains = null
      control.stop()
    },
  }
}

export interface UseAnimatedYDomainsOptions {
  enabled: boolean
  durationMs: number
  chartPhase: ChartPhase
  skeletonByAxis: Record<string, YDomain>
  targetByAxis: Record<string, YDomain>
  onSettled?: () => void
  /** When true, tweens y-domains on target changes while the chart is in the ready phase (e.g. brush zoom). */
  tweenOnTargetChange?: boolean
}

export function useAnimatedYDomains({
  enabled,
  durationMs,
  chartPhase,
  skeletonByAxis,
  targetByAxis,
  onSettled,
  tweenOnTargetChange = false,
}: UseAnimatedYDomainsOptions): Record<string, YDomain> {
  const reducedMotion = useReducedMotion()
  const destinationByAxis = resolveAnimatedYDestinationDomains(
    chartPhase,
    skeletonByAxis,
    targetByAxis
  )
  const destinationRef = useRef(destinationByAxis)
  destinationRef.current = destinationByAxis
  const skeletonRef = useRef(skeletonByAxis)
  skeletonRef.current = skeletonByAxis
  const targetRef = useRef(targetByAxis)
  targetRef.current = targetByAxis

  const [animatedByAxis, setAnimatedByAxis] = useState(destinationByAxis)
  const animatedRef = useRef(animatedByAxis)
  const prevPhaseRef = useRef(chartPhase)
  const onSettledRef = useRef(onSettled)
  onSettledRef.current = onSettled

  useEffect(() => {
    animatedRef.current = animatedByAxis
  }, [animatedByAxis])

  useEffect(() => {
    const phaseChanged = prevPhaseRef.current !== chartPhase
    prevPhaseRef.current = chartPhase

    const settle = () => {
      onSettledRef.current?.()
    }

    if (!isYDomainTweenPhase(chartPhase)) {
      // Resting phases snap their domain once per transition only — re-running
      // on unrelated dep changes would cascade redundant updates.
      if (!phaseChanged) {
        return
      }
      // Keep grid spacing frozen while the series exits the viewport.
      if (chartPhase === "exiting") {
        snapDomains(skeletonRef.current, setAnimatedByAxis, animatedRef)
        return
      }
      if (
        chartPhase === "exitingReady" ||
        chartPhase === "loading" ||
        chartPhase === "revealing" ||
        chartPhase === "ready"
      ) {
        snapDomains(targetRef.current, setAnimatedByAxis, animatedRef)
      }
      return
    }

    const control = tweenDomains({
      destination: destinationRef.current,
      durationMs,
      enabled,
      reducedMotion,
      animatedRef,
      setAnimatedByAxis,
      onSettled: settle,
    })

    return () => control?.stop()
  }, [chartPhase, durationMs, enabled, reducedMotion])

  const targetSignature = JSON.stringify(targetByAxis)
  const prevTargetSignatureRef = useRef(targetSignature)

  useEffect(() => {
    const inLivePhase = chartPhase === "ready" || chartPhase === "revealing"

    if (!inLivePhase) {
      prevTargetSignatureRef.current = targetSignature
      return
    }

    if (prevTargetSignatureRef.current === targetSignature) {
      return
    }
    prevTargetSignatureRef.current = targetSignature

    if (tweenOnTargetChange && chartPhase === "ready") {
      const control = tweenDomains({
        destination: targetRef.current,
        durationMs,
        enabled,
        reducedMotion,
        animatedRef,
        setAnimatedByAxis,
        onSettled: () => onSettledRef.current?.(),
      })

      return () => control?.stop()
    }

    snapDomains(targetRef.current, setAnimatedByAxis, animatedRef)
  }, [
    chartPhase,
    durationMs,
    enabled,
    reducedMotion,
    targetSignature,
    tweenOnTargetChange,
  ])

  return animatedByAxis
}
