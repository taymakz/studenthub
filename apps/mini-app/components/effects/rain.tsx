"use client"

import { useEffect, useRef } from "react"

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

      raindropsRef.current.forEach((raindrop) => {
        raindrop.y += raindrop.speed

        if (raindrop.y > height) {
          raindrop.y = -raindrop.length
          raindrop.x = Math.random() * width
        }

        context.beginPath()
        context.moveTo(raindrop.x, raindrop.y)
        context.lineTo(raindrop.x, raindrop.y + raindrop.length)
        context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${raindrop.alpha})`
        context.lineWidth = 1
        context.stroke()
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
  }, [color, quantity, speed, maxLength, minLength])

  return (
    <div ref={canvasContainerRef} className={className} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  )
}
