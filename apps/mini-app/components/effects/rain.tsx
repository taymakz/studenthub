"use client"

import { useCallback, useEffect, useRef } from "react"

type Raindrop = {
  x: number
  y: number
  length: number
  alpha: number
  speed: number
}

type RainProps = {
  color?: string
  quantity?: number
  speed?: number
  maxLength?: number
  minLength?: number
  className?: string
}

export default function Rain({
  color = "#6495ED",
  quantity = 25,
  speed = 0.5,
  maxLength = 10,
  minLength = 5,
  className = "",
}: RainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const raindropsRef = useRef<Raindrop[]>([])
  const animationFrameRef = useRef<number | undefined>(undefined)

  const resizeCanvas = useCallback(() => {
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

    // Recreate raindrops
    raindropsRef.current = []
    for (let i = 0; i < quantity; i++) {
      raindropsRef.current.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        length: Math.random() * (maxLength - minLength) + minLength,
        alpha: Math.random() * 0.3 + 0.3,
        speed: Math.random() * speed + speed,
      })
    }
  }, [maxLength, minLength, quantity, speed])

  const animate = useCallback(() => {
    if (!contextRef.current || !canvasRef.current) return

    const width = canvasRef.current.width / (window.devicePixelRatio || 1)
    const height = canvasRef.current.height / (window.devicePixelRatio || 1)

    const cleanHex = color.replace(/^#/, "").padStart(6, "0")
    const bigint = parseInt(cleanHex, 16)
    const r = (bigint >> 16) & 255
    const g = (bigint >> 8) & 255
    const b = bigint & 255

    contextRef.current.clearRect(0, 0, width, height)

    raindropsRef.current.forEach((raindrop) => {
      raindrop.y += raindrop.speed

      if (raindrop.y > height) {
        raindrop.y = -raindrop.length
        raindrop.x = Math.random() * width
      }

      if (!contextRef.current) return
      const { x, y, length, alpha } = raindrop
      contextRef.current.beginPath()
      contextRef.current.moveTo(x, y)
      contextRef.current.lineTo(x, y + length)
      contextRef.current.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
      contextRef.current.lineWidth = 1
      contextRef.current.stroke()
    })

    animationFrameRef.current = requestAnimationFrame(animate)
  }, [color])

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
  }, [resizeCanvas, animate])

  return (
    <div ref={canvasContainerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
