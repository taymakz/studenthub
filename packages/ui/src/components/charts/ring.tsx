"use client"

import { arc as arcGenerator } from "@visx/shape"
import {
  type MotionStyle,
  type MotionValue,
  m,
  useTransform,
} from "motion/react"
import { memo, useCallback, type ReactNode } from "react"
import {
  type RingData,
  ringCssVars,
  useRingHover,
  useRingStable,
} from "./ring-context"
import { useEnterComplete } from "./use-enter-complete"
import { useMountProgress } from "./use-mount-progress"

function generateArcPath(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  cornerRadius: number
): string {
  const generator = arcGenerator<unknown>({
    innerRadius,
    outerRadius,
    cornerRadius,
  })
  return generator({ startAngle, endAngle } as unknown as null) || ""
}

export type RingLineCap = "round" | "butt"

export interface RingProps {
  index: number
  color?: string
  animate?: boolean
  showGlow?: boolean
  lineCap?: RingLineCap
}

interface RingRadii {
  innerRadius: number
  outerRadius: number
}

function ringHoverScale(isHovered: boolean, isPushedOut: boolean): number {
  if (isHovered) {
    return 1.03
  }
  if (isPushedOut) {
    return 1.02
  }
  return 1
}

/** Value ratio (0..1) for a ring, 0 without data. */
function ringProgress(ringData?: RingData): number {
  return ringData ? ringData.value / ringData.maxValue : 0
}

/** Explicit prop color or the palette color for this index. */
function ringColor(
  colorProp: string | undefined,
  getColor: (index: number) => string,
  index: number
): string {
  return colorProp || getColor(index)
}

/** Background arc plus the settled progress arc (empty near zero progress). */
function ringGeometry(
  radii: RingRadii,
  startAngle: number,
  arcRange: number,
  progress: number,
  lineCap: RingLineCap
): { bgPath: string; progressPath: string } {
  const cornerRadius =
    lineCap === "round" ? (radii.outerRadius - radii.innerRadius) / 2 : 0
  const bgPath = generateArcPath(
    radii.innerRadius,
    radii.outerRadius,
    startAngle,
    startAngle + arcRange,
    cornerRadius
  )
  const progressEndAngle = startAngle + arcRange * progress
  const progressPath =
    progressEndAngle <= startAngle + 0.01
      ? ""
      : generateArcPath(
          radii.innerRadius,
          radii.outerRadius,
          startAngle,
          progressEndAngle,
          cornerRadius
        )
  return { bgPath, progressPath }
}

/** Per-frame progress arc for the mount animation (MotionValue transform). */
function computeAnimatedProgressPath(
  v: number,
  ctx: {
    ringData?: RingData
    startAngle: number
    arcRange: number
    progress: number
    index: number
    getRingRadii: (index: number) => RingRadii
    lineCap: RingLineCap
  }
): string {
  if (!ctx.ringData) {
    return ""
  }
  const currentEndAngle = ctx.startAngle + ctx.arcRange * ctx.progress * v
  if (currentEndAngle <= ctx.startAngle + 0.01) {
    return ""
  }
  const radii = ctx.getRingRadii(ctx.index)
  const corner =
    ctx.lineCap === "round" ? (radii.outerRadius - radii.innerRadius) / 2 : 0
  return generateArcPath(
    radii.innerRadius,
    radii.outerRadius,
    ctx.startAngle,
    currentEndAngle,
    corner
  )
}

/** Hover relationship of one ring against the currently hovered ring. */
function ringHoverState(
  hoveredIndex: number | null,
  index: number
): { isHovered: boolean; isPushedOut: boolean; layerOpacity: number } {
  const isHovered = hoveredIndex === index
  const isFaded = hoveredIndex !== null && hoveredIndex !== index
  return {
    isHovered,
    isPushedOut: hoveredIndex !== null && hoveredIndex < index,
    layerOpacity: isFaded ? 0.35 : 1,
  }
}

function ringGroupStyle(
  showGlow: boolean,
  isHovered: boolean,
  color: string
): MotionStyle {
  return {
    cursor: "pointer",
    transformOrigin: "0px 0px",
    filter: showGlow && isHovered ? `drop-shadow(0 0 12px ${color})` : "none",
  }
}

/** The ring is settled once mount animations are skipped or finished. */
function ringEnterDone(
  animate: boolean,
  expandComplete: boolean,
  progressComplete: boolean
): boolean {
  return !animate || (expandComplete && progressComplete)
}

function RingProgressPath({
  progressComplete,
  progressPath,
  animatedProgressPath,
  color,
}: {
  progressComplete: boolean
  progressPath: string
  animatedProgressPath: MotionValue<string>
  color: string
}) {
  if (progressComplete) {
    if (!progressPath) {
      return null
    }
    return <path d={progressPath} fill={color} />
  }
  return <m.path d={animatedProgressPath} fill={color} />
}

/** Settled ring shell: springy hover scale + fade around its children. */
function RingHoverGroup({
  hoverScale,
  layerOpacity,
  style,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  hoverScale: number
  layerOpacity: number
  style: MotionStyle
  onMouseEnter: () => void
  onMouseLeave: () => void
  children: ReactNode
}) {
  return (
    <m.g
      animate={{ scale: hoverScale, opacity: layerOpacity }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
      transition={{
        scale: { type: "spring", stiffness: 400, damping: 25 },
        opacity: { duration: 0.15 },
      }}
    >
      {children}
    </m.g>
  )
}

/** Entrance phase: the ring scales in from nothing, background only. */
function RingEnterGroup({
  bgPath,
  enterScale,
  layerOpacity,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  bgPath: string
  enterScale: MotionValue<number>
  layerOpacity: number
  style: MotionStyle
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <m.g
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ ...style, scale: enterScale, opacity: layerOpacity }}
    >
      <path d={bgPath} fill={ringCssVars.ringBackground} />
    </m.g>
  )
}

/** Settled ring body: static path once done, morphing path while animating. */
function RingSettledGroup({
  enterDone,
  bgPath,
  progressPath,
  progressComplete,
  animatedProgressPath,
  color,
  hoverScale,
  layerOpacity,
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  enterDone: boolean
  bgPath: string
  progressPath: string
  progressComplete: boolean
  animatedProgressPath: MotionValue<string>
  color: string
  hoverScale: number
  layerOpacity: number
  style: MotionStyle
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <RingHoverGroup
      hoverScale={hoverScale}
      layerOpacity={layerOpacity}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <path d={bgPath} fill={ringCssVars.ringBackground} />
      {enterDone ? (
        progressPath ? (
          <path d={progressPath} fill={color} />
        ) : null
      ) : (
        <RingProgressPath
          progressComplete={progressComplete}
          progressPath={progressPath}
          animatedProgressPath={animatedProgressPath}
          color={color}
        />
      )}
    </RingHoverGroup>
  )
}

export const Ring = memo(function Ring({
  index,
  color: colorProp,
  animate = true,
  showGlow = true,
  lineCap = "round",
}: RingProps) {
  const {
    data,
    getColor,
    getRingRadii,
    startAngle,
    endAngle,
    enterTransition,
    enterStaggerScale,
    animationKey,
  } = useRingStable()
  const { hoveredIndex, setHoveredIndex } = useRingHover()

  const expandDelay = index * 0.08 * enterStaggerScale
  const expandProgress = useMountProgress(
    enterTransition,
    expandDelay,
    `${animationKey}-expand-${index}`
  )
  const expandComplete = useEnterComplete(expandProgress)

  const progressDelay = (0.6 + index * 0.1) * enterStaggerScale
  const progressMount = useMountProgress(
    enterTransition,
    progressDelay,
    `${animationKey}-progress-${index}`
  )
  const progressComplete = useEnterComplete(progressMount)

  const ringData = data[index]
  const progress = ringProgress(ringData)
  const arcRange = endAngle - startAngle

  const animatedProgressPath = useTransform(progressMount, (v) =>
    computeAnimatedProgressPath(v, {
      ringData,
      startAngle,
      arcRange,
      progress,
      index,
      getRingRadii,
      lineCap,
    })
  )
  const enterScale = useTransform(expandProgress, [0, 1], [0, 1])

  const handleMouseEnter = useCallback(
    () => setHoveredIndex(index),
    [index, setHoveredIndex]
  )
  const handleMouseLeave = useCallback(
    () => setHoveredIndex(null),
    [setHoveredIndex]
  )

  if (!ringData) {
    return null
  }

  const geometry = ringGeometry(
    getRingRadii(index),
    startAngle,
    arcRange,
    progress,
    lineCap
  )
  const color = ringColor(colorProp, getColor, index)
  const hoverState = ringHoverState(hoveredIndex, index)
  const style = ringGroupStyle(showGlow, hoverState.isHovered, color)

  if (!expandComplete) {
    return (
      <RingEnterGroup
        bgPath={geometry.bgPath}
        enterScale={enterScale}
        layerOpacity={hoverState.layerOpacity}
        style={style}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
    )
  }

  return (
    <RingSettledGroup
      enterDone={ringEnterDone(animate, expandComplete, progressComplete)}
      bgPath={geometry.bgPath}
      progressPath={geometry.progressPath}
      progressComplete={progressComplete}
      animatedProgressPath={animatedProgressPath}
      color={color}
      hoverScale={ringHoverScale(hoverState.isHovered, hoverState.isPushedOut)}
      layerOpacity={hoverState.layerOpacity}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  )
})

Ring.displayName = "Ring"

export default Ring
