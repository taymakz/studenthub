"use client"

import { motion, useReducedMotion, type Variants } from "motion/react"
import { type ComponentProps, useCallback } from "react"
import { cn } from "@workspace/ui/lib/utils"

export type ShimmeringTextProps = Omit<
  ComponentProps<typeof motion.span>,
  "children"
> & {
  /** The text to render with the shimmering effect. */
  text: string
  /**
   * Duration in seconds for one shimmer cycle.
   * @defaultValue 1
   */
  duration?: number
  /**
   * Pause the shimmer (e.g. when the hero leaves the viewport).
   * @defaultValue false
   */
  paused?: boolean
  /**
   * Legacy alias for `paused`.
   * @defaultValue false
   */
  isStopped?: boolean
}

export function ShimmeringText({
  text,
  duration = 1,
  isStopped = false,
  paused = false,
  className,
  ...props
}: ShimmeringTextProps) {
  const reducedMotion = useReducedMotion()
  const stopped = isStopped || paused || reducedMotion === true

  // Arabic-script glyph joining breaks when letters are split across
  // separate elements, so those texts shimmer as a single unit.
  const isArabicScript =
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(
      text
    )

  const createCharVariants = useCallback(
    (charIndex: number): Variants => ({
      running: {
        color: ["var(--color)", "var(--shimmering-color)", "var(--color)"],
        transition: {
          duration,
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "loop",
          repeatDelay: text.length * 0.05,
          delay: (charIndex * duration) / text.length,
          ease: "easeInOut",
        },
      },
      stopped: {
        color: "var(--color)",
        transition: {
          duration: duration * 0.5,
          ease: "easeOut",
        },
      },
    }),
    [duration, text.length]
  )

  if (isArabicScript) {
    return (
      <motion.span
        animate={stopped ? "stopped" : "running"}
        className={cn(
          "inline-flex items-center leading-none select-none",
          "[--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]",
          className
        )}
        initial="stopped"
        variants={{
          running: {
            color: ["var(--color)", "var(--shimmering-color)", "var(--color)"],
            transition: {
              duration,
              repeat: Number.POSITIVE_INFINITY,
              repeatType: "loop",
              repeatDelay: 0.8,
              ease: "easeInOut",
            },
          },
          stopped: {
            color: "var(--color)",
            transition: {
              duration: duration * 0.5,
              ease: "easeOut",
            },
          },
        }}
        {...props}
      >
        {text}
      </motion.span>
    )
  }

  return (
    <motion.span
      className={cn(
        "inline-flex items-center leading-none select-none",
        "[--color:var(--muted-foreground)] [--shimmering-color:var(--foreground)]",
        className
      )}
      {...props}
    >
      {text.split("").map((char, index) => (
        <motion.span
          animate={stopped ? "stopped" : "running"}
          aria-hidden
          className="inline-block leading-none whitespace-pre"
          initial="stopped"
          // biome-ignore lint/suspicious/noArrayIndexKey: static label text, order never changes
          key={index}
          variants={createCharVariants(index)}
        >
          {char}
        </motion.span>
      ))}
      <span className="sr-only">{text}</span>
    </motion.span>
  )
}
