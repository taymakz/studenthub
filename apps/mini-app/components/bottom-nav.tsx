"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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
  const [showLabels, setShowLabels] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false })
  // The pill appears instantly on first measure; only later moves animate.
  const [interactive, setInteractive] = useState(false)
  const pillMeasuredOnce = useRef(false)

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
      if (activeIndex < 0) {
        setPill((p) => ({ ...p, ready: false }))
        return
      }
      const el = itemRefs.current[activeIndex]
      const container = containerRef.current
      if (!el || !container) return
      const containerRect = container.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      const padLeft = parseFloat(getComputedStyle(container).paddingLeft || "0")
      const left = rect.left - containerRect.left - padLeft
      setPill({ left, width: rect.width, ready: true })
      if (!pillMeasuredOnce.current) {
        pillMeasuredOnce.current = true
        // Let the first paint land without a transition, then enable moves.
        setTimeout(() => setInteractive(true), 0)
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
  }, [activeIndex, pathname, showLabels])

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
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1 bottom-1 left-1 rounded-full bg-primary will-change-transform",
            pill.ready ? "opacity-100" : "opacity-0"
          )}
          style={{
            transform: `translateX(${pill.left}px)`,
            width: pill.width,
            transition: interactive
              ? "transform 200ms cubic-bezier(0.32,0.72,0,1), opacity 150ms ease-out"
              : "none",
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
              aria-label={item.title}
              aria-current={active ? "page" : undefined}
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
