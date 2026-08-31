"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform } from "motion/react"
import { cn } from "@workspace/ui/lib/utils"

/**
 * Sheet container with the sticky drag-thumb that flattens as it sticks -
 * verbatim port of the old frontend-next ContentLayout.
 */
export default function ContentLayout({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Track scroll relative to the container
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 30px", "start start"],
  })

  // Transform scroll progress to border radius (32px -> 0px)
  const borderRadius = useTransform(scrollYProgress, [0, 1], [32, 0])

  // Transform scroll progress to span width (56px -> 100%)
  const spanWidth = useTransform(scrollYProgress, [0, 1], ["56px", "72px"])

  return (
    <div
      ref={containerRef}
      className={cn(
        // Bottom padding clears the floating bottom nav (104px) plus the
        // Telegram bottom safe inset, which lifts the nav higher.
        "-mt-6 min-h-dvh bg-secondary pb-[calc(6.5rem+var(--tg-safe-area-inset-bottom,0px))]",
        className
      )}
    >
      {/* Thumb */}
      <motion.div
        className="sticky top-0 z-10 flex w-full items-center justify-center bg-secondary py-2.5"
        style={{
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        }}
      >
        <motion.span
          className="block h-1 rounded-full bg-foreground/50"
          style={{
            width: spanWidth,
          }}
        />
      </motion.div>
      {children}
    </div>
  )
}
