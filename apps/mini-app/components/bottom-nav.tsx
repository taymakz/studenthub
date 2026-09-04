"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  animate,
  m,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Book2, Grid, Settings } from "reicon-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"
import { proxyImage } from "@/lib/image-proxy"
import { useProfileStore } from "@/stores/profile-store"
import { useRouteSwipeNavigation } from "@/components/app/route-swipe-shell"

/** Same release curve the swipe shell uses, so tap moves match page slides. */
const PILL_RELEASE_EASING = [0.32, 0.72, 0, 1] as const

/**
 * Floating pill bottom nav — 280px, equal 4×70px cells, RTL-aware, hardware-accelerated.
 * Home tab now shows the user's avatar (profile) instead of Home icon.
 */
const navLinks = [
  {
    to: "/profile",
    title: "پروفایل",
    icon: null as unknown as null,
    isProfile: true,
  },
  { to: "/courses", title: "دروس", icon: Book2 },
  { to: "/dashboard", title: "داشبورد", icon: Grid },
  { to: "/settings", title: "تنظیمات", icon: Settings },
] as const

export function BottomNav() {
  const pathname = usePathname() ?? ""
  const routeSwipe = useRouteSwipeNavigation()
  const slide = routeSwipe?.slide ?? null
  const slideSourceIndex = routeSwipe?.slideSourceIndex ?? null
  const slideTargetIndex = routeSwipe?.slideTargetIndex ?? null
  const shouldReduceMotion = useReducedMotion() === true
  const [showLabels, setShowLabels] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  // Visual left offset of every item, measured against the padding edge —
  // direction-independent, so translateX math works the same in RTL.
  const leftsRef = useRef<(number | null)[]>([])
  const pillX = useMotionValue(0)
  const prevActiveRef = useRef(-1)
  // Stand-in when the shell is absent (hook must be called unconditionally);
  // its change event never fires.
  const noopSlide = useMotionValue(0)
  const [pillWidth, setPillWidth] = useState(0)
  // The pill appears instantly on first measure; only later moves animate.
  const [pillReady, setPillReady] = useState(false)
  const placedRef = useRef(false)

  const user = useProfileStore((s) => s.user)
  const photoUrl = user?.photoUrl ?? null
  const firstName = user?.firstName ?? "U"

  const activeIndex = navLinks.findIndex((item) =>
    pathname === "/" ? false : pathname.startsWith(item.to)
  )

  useEffect(() => {
    const t = setTimeout(() => setShowLabels(true), 800)
    return () => clearTimeout(t)
  }, [])

  // Hardware-accelerated pill.
  // The pill is pinned with `left-1` (physical left padding edge) so its origin
  // is direction-independent; then translateX moves it by the measured visual
  // offset of the active item (minus the same padding). In RTL the flex items
  // render right-to-left, and the measurement below is visual (viewport-based),
  // so the math stays correct without reordering anything.
  useLayoutEffect(() => {
    const update = () => {
      const container = containerRef.current
      if (!container) return
      const containerRect = container.getBoundingClientRect()
      const padLeft = parseFloat(
        getComputedStyle(container).paddingLeft || "0"
      )
      const lefts = itemRefs.current.map((el) =>
        el ? el.getBoundingClientRect().left - containerRect.left - padLeft : null
      )
      leftsRef.current = lefts

      const activeLeft = activeIndex >= 0 ? (lefts[activeIndex] ?? null) : null
      const activeWidth =
        activeIndex >= 0
          ? (itemRefs.current[activeIndex]?.getBoundingClientRect().width ?? 0)
          : 0
      if (activeLeft === null || activeWidth <= 0) return

      setPillWidth(activeWidth)
      setPillReady(true)

      // Reposition instantly on measurement changes (resize, labels) — but
      // never on tab changes: the resting effect below eases those moves.
      const activeIndexChanged = prevActiveRef.current !== activeIndex
      prevActiveRef.current = activeIndex
      if (slideSourceIndex === null && placedRef.current && !activeIndexChanged) {
        pillX.set(activeLeft)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    itemRefs.current.forEach((el) => el && ro.observe(el))
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [activeIndex, pillX, showLabels, slideSourceIndex])

  // Park the pill on the active tab whenever no transition owns it. First
  // placement is instant; tab changes ease out on the shared release curve.
  useLayoutEffect(() => {
    if (slideSourceIndex !== null) return
    const left = activeIndex >= 0 ? leftsRef.current[activeIndex] : null
    if (left === null || left === undefined) return

    if (!placedRef.current || shouldReduceMotion) {
      placedRef.current = true
      pillX.set(left)
      return
    }
    const controls = animate(pillX, left, {
      duration: 0.2,
      ease: PILL_RELEASE_EASING,
    })
    return () => controls.stop()
  }, [activeIndex, pillReady, pillX, shouldReduceMotion, slideSourceIndex])

  // While a swipe owns the shell, the pill follows the exact same slide
  // progress the page translates with — drag, hold and release stay in
  // lockstep because both read the single pageX MotionValue.
  useMotionValueEvent(slide ?? noopSlide, "change", (value) => {
    if (slideSourceIndex === null || slideTargetIndex === null) return
    const from = leftsRef.current[slideSourceIndex]
    const to = leftsRef.current[slideTargetIndex]
    if (from === null || from === undefined) return
    if (to === null || to === undefined) return

    const progress = Math.min(1, Math.abs(value))
    pillX.set(from + (to - from) * progress)
  })

  // A gesture that activates a cold preview mid-drag (or a tap landing while
  // the pill is parked) must place the pill at the current progress at once —
  // the change event above only fires on the next pageX frame.
  useEffect(() => {
    if (!slide || slideSourceIndex === null || slideTargetIndex === null) return
    const from = leftsRef.current[slideSourceIndex]
    const to = leftsRef.current[slideTargetIndex]
    if (from === null || from === undefined) return
    if (to === null || to === undefined) return

    const progress = Math.min(1, Math.abs(slide.get()))
    pillX.set(from + (to - from) * progress)
  }, [pillX, slide, slideSourceIndex, slideTargetIndex])

  return (
    <nav
      dir="rtl"
      className="fixed inset-x-0 bottom-[calc(var(--tg-safe-area-inset-bottom)+var(--tg-content-safe-area-inset-bottom)+4px)] z-30 mx-auto flex w-75 justify-center"
    >
      <div
        ref={containerRef}
        dir="rtl"
        className="relative flex w-full items-center overflow-hidden rounded-full bg-zinc-900 p-1 shadow-lg select-none dark:bg-zinc-800"
      >
        {/* Active pill — origin pinned to the physical left padding edge (`left-1`),
            so translateX is direction-independent; only transform animates. */}
        <m.div
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-primary will-change-transform",
            pillReady ? "opacity-100" : "opacity-0"
          )}
          style={{
            x: pillX,
            width: pillWidth,
            transition: "opacity 150ms ease-out",
          }}
        />
        {navLinks.map((item, idx) => {
          const active = idx === activeIndex
          const isProfile = (item as unknown as { isProfile?: boolean })
            .isProfile
          return (
            <Link
              key={item.to}
              ref={(el) => {
                itemRefs.current[idx] = el
              }}
              href={item.to}
              prefetch={true}
              aria-disabled={routeSwipe?.isNavigating || undefined}
              aria-label={item.title}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return
                }

                if (routeSwipe?.navigate(item.to)) event.preventDefault()
              }}
              className={cn(
                "relative flex min-h-12 flex-1 touch-manipulation flex-col items-center justify-center gap-1 rounded-full px-4 py-2.5 text-[10px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
                active
                  ? "text-primary-foreground"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {isProfile ? (
                <Avatar className="relative z-10 size-6 border border-white/20">
                  <AvatarImage
                    src={proxyImage(photoUrl) ?? ""}
                    alt={firstName}
                  />
                  <AvatarFallback className="text-[10px]">
                    {firstName.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="relative z-10 flex size-6 items-center justify-center">
                  {(() => {
                    const Icon = item.icon as React.ComponentType<{
                      weight?: "Filled" | "Outline"
                      className?: string
                    }>
                    return (
                      <Icon
                        weight={active ? "Filled" : "Outline"}
                        className="size-6"
                      />
                    )
                  })()}
                </span>
              )}
              <span className="relative z-10 leading-none font-bold whitespace-nowrap">
                {item.title}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
