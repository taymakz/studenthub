"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { m } from "motion/react"
import { Bookmark, ConfusedSquare } from "reicon-react"

import { cn } from "@workspace/ui/lib/utils"
import { useRoutePageContext } from "@/lib/route-preview-context"

const PILL_BUTTON_CLASS =
  "relative flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl border bg-background px-2 text-start transition-[width] duration-150 ease-out"

/**
 * Hides the pills while the user scrolls down and reveals a scroll-to-top
 * shortcut past 200px. Uses requestAnimationFrame for smooth detection.
 */
function useFloatingButtonScrollState(enabled: boolean) {
  const [isScrollingDown, setIsScrollingDown] = React.useState(false)
  const [showScrollTop, setShowScrollTop] = React.useState(false)
  const lastScrollPosition = React.useRef(0)
  const ticking = React.useRef(false)

  React.useEffect(() => {
    if (!enabled) return

    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollPosition = window.scrollY

          if (currentScrollPosition === 0 || lastScrollPosition.current === 0) {
            lastScrollPosition.current = currentScrollPosition
            ticking.current = false
            return
          }

          setIsScrollingDown(currentScrollPosition > lastScrollPosition.current)
          setShowScrollTop(currentScrollPosition > 200)
          lastScrollPosition.current = currentScrollPosition
          ticking.current = false
        })
        ticking.current = true
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [enabled])

  return { isScrollingDown, showScrollTop }
}

function NotedFloatingButton({
  notedCount,
  isScrollingDown,
  interactive,
  isPreview,
  onOpenNoted,
}: {
  notedCount: number
  isScrollingDown: boolean
  interactive: boolean
  isPreview: boolean
  onOpenNoted: () => void
}) {
  if (notedCount <= 0) return null

  return (
    <div
      className={cn(
        "absolute bottom-22 z-20 transition-transform duration-150 ease-out",
        interactive && !isPreview
          ? "pointer-events-auto"
          : "pointer-events-none"
      )}
      style={{
        right: "1.5rem",
      }}
    >
      <button
        type="button"
        className={PILL_BUTTON_CLASS}
        style={{
          width: isScrollingDown ? "42px" : "105px",
        }}
        onClick={onOpenNoted}
      >
        <span className="absolute -top-3 -right-3 size-6 animate-pulse rounded-full bg-primary blur-lg" />
        <span className="absolute -top-3 -right-3 flex size-6 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
          {notedCount}
        </span>
        <Bookmark size={24} className="min-w-6 text-primary" />
        {!isScrollingDown && (
          <span className="text-sm font-medium whitespace-nowrap text-primary">
            لیست من
          </span>
        )}
      </button>
    </div>
  )
}

function ConflictsFloatingButton({
  conflictsCount,
  isScrollingDown,
  interactive,
  isPreview,
  onOpenConflicts,
}: {
  conflictsCount: number
  isScrollingDown: boolean
  interactive: boolean
  isPreview: boolean
  onOpenConflicts: () => void
}) {
  if (conflictsCount <= 0) return null

  return (
    <div
      className={cn(
        "absolute bottom-34 z-20 transition-transform duration-150 ease-out",
        interactive && !isPreview
          ? "pointer-events-auto"
          : "pointer-events-none"
      )}
      style={{
        right: "1.5rem",
      }}
    >
      <button
        type="button"
        className={PILL_BUTTON_CLASS}
        style={{
          width: isScrollingDown ? "42px" : "105px",
        }}
        onClick={onOpenConflicts}
      >
        <span className="absolute -top-3 -right-3 size-6 animate-pulse rounded-full bg-warning blur-lg" />
        <span className="absolute -top-3 -right-3 flex size-6 items-center justify-center rounded-full bg-warning text-sm text-primary-foreground">
          {conflictsCount}
        </span>
        <span className="absolute size-4 animate-pulse rounded-full bg-warning blur-lg" />
        <ConfusedSquare
          size={24}
          className="relative z-10 min-w-6 text-warning"
        />
        {!isScrollingDown && (
          <span className="text-sm font-medium whitespace-nowrap text-warning">
            تداخلات
          </span>
        )}
      </button>
    </div>
  )
}

function ScrollTopFloatingButton({
  showScrollTop,
  interactive,
  isPreview,
}: {
  showScrollTop: boolean
  interactive: boolean
  isPreview: boolean
}) {
  return (
    <div
      className={cn(
        "absolute bottom-22 left-4 z-20 transition-[transform,opacity] duration-200 ease-out",
        interactive && !isPreview
          ? "pointer-events-auto"
          : "pointer-events-none"
      )}
      style={{
        transform: showScrollTop ? "scale(1)" : "scale(0)",
        opacity: showScrollTop ? 1 : 0,
      }}
    >
      <button
        type="button"
        aria-label="بازگشت به بالای صفحه"
        className="flex size-12 cursor-pointer items-center justify-center rounded-full border bg-background shadow-lg transition-transform duration-100 ease-out hover:bg-accent active:scale-95"
        onClick={() => window.scrollTo({ top: 0, behavior: "instant" })}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-6 text-primary"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
    </div>
  )
}

/**
 * Floating pill buttons with Emil Kowalski animation principles:
 * - Only animate transform and opacity (GPU accelerated)
 * - Custom easing curves for smooth feel
 * - Fast transitions (under 200ms for UI interactions)
 * - No animation on keyboard actions (scroll is frequent)
 */
export function FloatingButtons({
  notedCount,
  conflictsCount,
  onOpenNoted,
  onOpenConflicts,
}: {
  notedCount: number
  conflictsCount: number
  onOpenNoted: () => void
  onOpenConflicts: () => void
}) {
  const { interactive, isPreview, overlayHost, overlayX } =
    useRoutePageContext()
  const { isScrollingDown, showScrollTop } = useFloatingButtonScrollState(
    !isPreview
  )

  if (!overlayHost || !overlayX) return null

  return createPortal(
    <m.div
      aria-hidden={isPreview || undefined}
      inert={isPreview || !interactive}
      className="pointer-events-none absolute inset-0"
      style={{ x: overlayX }}
    >
      <NotedFloatingButton
        notedCount={notedCount}
        isScrollingDown={isScrollingDown}
        interactive={interactive}
        isPreview={isPreview}
        onOpenNoted={onOpenNoted}
      />
      <ConflictsFloatingButton
        conflictsCount={conflictsCount}
        isScrollingDown={isScrollingDown}
        interactive={interactive}
        isPreview={isPreview}
        onOpenConflicts={onOpenConflicts}
      />
      <ScrollTopFloatingButton
        showScrollTop={showScrollTop}
        interactive={interactive}
        isPreview={isPreview}
      />
    </m.div>,
    overlayHost
  )
}
