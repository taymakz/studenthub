"use client"
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useRef } from "react"

type Snowflake = {
  x: number
  y: number
  size: number
  alpha: number
  dx: number // Horizontal drift
  dy: number // Vertical fall speed
}

type SnowfallProps = {
  color?: string
  quantity?: number
  speed?: number
  maxRadius?: number
  minRadius?: number
  className?: string
}

export default function Snowfall({
  color = "#ADD8E6",
  quantity = 40,
  speed = 0.2,
  maxRadius = 1,
  minRadius = 0.2,
  className = "",
}: SnowfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const snowflakesRef = useRef<Snowflake[]>([])
  const animationFrameRef = useRef<number | undefined>(undefined)

  const createSnowflake = (
    canvasWidth: number,
    canvasHeight: number
  ): Snowflake => {
    return {
      x: Math.random() * canvasWidth,
      y: Math.random() * canvasHeight,
      size: Math.random() * (maxRadius - minRadius) + minRadius,
      alpha: Math.random() * 0.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.5,
      dy: Math.random() * 0.25 + speed,
    }
  }

  const resizeCanvas = () => {
    if (
      !canvasContainerRef.current ||
      !canvasRef.current ||
      !contextRef.current
    )
      return

    const pixelRatio = window.devicePixelRatio || 1
    const width = canvasContainerRef.current.offsetWidth
    const height = canvasContainerRef.current.offsetHeight

    canvasRef.current.width = width * pixelRatio
    canvasRef.current.height = height * pixelRatio
    canvasRef.current.style.width = `${width}px`
    canvasRef.current.style.height = `${height}px`
    contextRef.current.scale(pixelRatio, pixelRatio)

    // Recreate snowflakes
    snowflakesRef.current = []
    for (let i = 0; i < quantity; i++) {
      snowflakesRef.current.push(createSnowflake(width, height))
    }
  }

  const drawSnowflake = (
    snowflake: Snowflake,
    r: number,
    g: number,
    b: number
  ) => {
    if (!contextRef.current) return

    const { x, y, size, alpha } = snowflake
    contextRef.current.beginPath()
    contextRef.current.arc(x, y, size, 0, Math.PI * 2)
    contextRef.current.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
    contextRef.current.fill()
  }

  const animate = () => {
    if (!contextRef.current || !canvasRef.current) return

    const width = canvasRef.current.width / (window.devicePixelRatio || 1)
    const height = canvasRef.current.height / (window.devicePixelRatio || 1)

    const cleanHex = color.replace(/^#/, "").padStart(6, "0")
    const bigint = parseInt(cleanHex, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255

    contextRef.current.clearRect(0, 0, width, height)

    snowflakesRef.current.forEach((snowflake) => {
      snowflake.x += snowflake.dx
      snowflake.y += snowflake.dy

      if (snowflake.y > height) {
        snowflake.y = -snowflake.size
        snowflake.x = Math.random() * width
      }

      drawSnowflake(snowflake, r, g, b)
    })

    animationFrameRef.current = requestAnimationFrame(animate)
  }

  useEffect(() => {
    if (!canvasRef.current) return

    contextRef.current = canvasRef.current.getContext("2d")
    resizeCanvas()
    animate()

    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [color, quantity, speed, maxRadius, minRadius])

  return (
    <div ref={canvasContainerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
