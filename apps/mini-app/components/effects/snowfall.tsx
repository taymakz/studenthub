"use client"

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    contextRef.current = canvas.getContext("2d")

    const resizeCanvas = () => {
      const container = canvasContainerRef.current
      const context = contextRef.current
      if (!container || !context) return

      const pixelRatio = window.devicePixelRatio || 1
      const width = container.offsetWidth
      const height = container.offsetHeight

      canvas.width = width * pixelRatio
      canvas.height = height * pixelRatio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.scale(pixelRatio, pixelRatio)

      // Recreate snowflakes
      snowflakesRef.current = []
      for (let i = 0; i < quantity; i++) {
        snowflakesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * (maxRadius - minRadius) + minRadius,
          alpha: Math.random() * 0.5 + 0.5,
          dx: (Math.random() - 0.5) * 0.5,
          dy: Math.random() * 0.25 + speed,
        })
      }
    }

    resizeCanvas()

    const cleanHex = color.replace(/^#/, "").padStart(6, "0")
    const bigint = parseInt(cleanHex, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255

    let animationFrame: number | undefined

    const animate = () => {
      const context = contextRef.current
      if (!context || !canvasRef.current) return

      const width = canvasRef.current.width / (window.devicePixelRatio || 1)
      const height = canvasRef.current.height / (window.devicePixelRatio || 1)

      context.clearRect(0, 0, width, height)

      snowflakesRef.current.forEach((snowflake) => {
        snowflake.x += snowflake.dx
        snowflake.y += snowflake.dy

        if (snowflake.y > height) {
          snowflake.y = -snowflake.size
          snowflake.x = Math.random() * width
        }

        context.beginPath()
        context.arc(snowflake.x, snowflake.y, snowflake.size, 0, Math.PI * 2)
        context.fillStyle = `rgba(${r}, ${g}, ${b}, ${snowflake.alpha})`
        context.fill()
      })

      animationFrame = requestAnimationFrame(animate)
    }

    animate()

    window.addEventListener("resize", resizeCanvas)

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [color, quantity, speed, maxRadius, minRadius])

  return (
    <div ref={canvasContainerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
