"use client"

import { useEffect, useRef, useState } from "react"
import { Bookmark, ConfusedSquare } from "reicon-react"

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
  const [isScrollingDown, setIsScrollingDown] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const lastScrollPosition = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const handleScroll = () => {
      // Use requestAnimationFrame for smooth scroll detection
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
  }, [])

  return (
    <>
      {/* Noted Button */}
      {notedCount > 0 && (
        <div
          className="fixed bottom-22 z-20 transition-transform duration-150 ease-out"
          style={{
            right: "1.5rem",
            willChange: "transform",
          }}
        >
          <div
            className="relative flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-background px-2 transition-all duration-150 ease-out"
            style={{
              width: isScrollingDown ? "42px" : "105px",
              willChange: "width",
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
          </div>
        </div>
      )}

      {/* Conflicts Button */}
      {conflictsCount > 0 && (
        <div
          className="fixed bottom-34 z-20 transition-transform duration-150 ease-out"
          style={{
            right: "1.5rem",
            willChange: "transform",
          }}
        >
          <div
            className="relative flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-background px-2 transition-all duration-150 ease-out"
            style={{
              width: isScrollingDown ? "42px" : "105px",
              willChange: "width",
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
          </div>
        </div>
      )}

      {/* Scroll to Top Button - CSS transition for smooth feel */}
      <div
        className="fixed bottom-22 left-4 z-20 transition-all duration-200 ease-out"
        style={{
          transform: showScrollTop ? "scale(1)" : "scale(0)",
          opacity: showScrollTop ? 1 : 0,
          willChange: "transform, opacity",
        }}
      >
        <button
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
    </>
  )
}
