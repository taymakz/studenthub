"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { useReducedMotion, AnimatePresence, motion } from "motion/react"
import { ChevronLeft, type LucideIcon } from "lucide-react"
import type { IconFunction } from "reicon/createIcon"

import { Badge } from "@workspace/ui/components/badge"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { navSections, type NavIcon, type NavItem } from "@/lib/fake-data"

/** Renders a nav icon, which may be a Lucide component (JSX) or a reicon
    function (SVG string). Keeps either icon set pixel-consistent at 14px
    like the surrounding menu buttons. */
export function NavItemIcon({ icon }: { icon: NavIcon }) {
  if ("toSvg" in icon) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex [&_svg]:size-3.5"
        dangerouslySetInnerHTML={{
          __html: (icon as IconFunction).toSvg({ size: 14 }),
        }}
      />
    )
  }
  const Lucide = icon as LucideIcon
  return <Lucide />
}

function isActive(pathname: string, item: NavItem): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function findParents(sections: typeof navSections) {
  return sections.flatMap((section) =>
    section.items.filter((item) => item.children?.length)
  )
}

function findOwningParent(
  parents: NavItem[],
  pathname: string
): NavItem | null {
  return (
    parents.find(
      (item) =>
        isActive(pathname, item) ||
        item.children!.some((c) => isActive(pathname, c))
    ) ?? null
  )
}

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate: (item: NavItem) => void
}) {
  const hasChildren = !!item.children?.length
  // Placeholder hrefs (starting with "#") are inert: render a button instead
  // of an anchor so clicks don't append junk fragments or history entries.
  const isPlaceholder = item.href.startsWith("#")

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={hasChildren ? undefined : item.label}
        onClick={() => onNavigate(item)}
        render={
          isPlaceholder ? <button type="button" /> : <Link href={item.href} />
        }
        className="text-muted-foreground"
      >
        <NavItemIcon icon={item.icon} />
        <span>{item.label}</span>
        {item.badge && !hasChildren && (
          <Badge className="ms-auto border-transparent bg-foreground/10 px-1.5 text-[10px] text-foreground/70 tabular-nums">
            {item.badge}
          </Badge>
        )}
      </SidebarMenuButton>
      {!hasChildren ? null : (
        <span className="pointer-events-none absolute inset-e-1 top-1/2 -translate-y-1/2 text-sidebar-foreground/60">
          {/* Drill-in points toward the inline end (right in LTR, left in
              RTL). Base icon points left; dir-driven variant flips it, so
              changing <html dir> fixes every chevron automatically. */}
          <ChevronLeft className="size-4 ltr:rotate-180" />
        </span>
      )}
    </SidebarMenuItem>
  )
}

const EASE_OUT_STRONG: [number, number, number, number] = [0.23, 1, 0.32, 1]

/** Same drill-down navigation as the previous admin project: parents slide
    their children in behind a back button, leaves highlight via the URL.
    Animation is direction-aware (forward/back), exits faster than it enters,
    uses blur to mask the crossfade, and respects prefers-reduced-motion. */
export function SidebarDrillDownNav({
  sections,
  back,
}: {
  sections: typeof navSections
  /** Optional static back row rendered above the nav (e.g. "< Back" out of
      the settings area). Clicking it navigates and closes a mobile sheet. */
  back?: { href: string; label: string }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const reduceMotion = useReducedMotion() ?? false
  const { setOpenMobile } = useSidebar()
  const effectivePathname = pathname

  const [override, setOverride] = React.useState<{
    path: string
    key: string | null
  } | null>(null)

  // A drill-down override only ever applies to the exact page it was created
  // on -- including the one our own router.push just landed on. When the
  // pathname changes any other way (browser back/forward, palette, header),
  // drop it so an old nested view can't resurrect.
  const lastPathRef = React.useRef(effectivePathname)
  React.useEffect(() => {
    if (lastPathRef.current !== effectivePathname) {
      lastPathRef.current = effectivePathname
      setOverride(null)
    }
  }, [effectivePathname])

  const parents = findParents(sections)

  const owningParent = React.useMemo(
    () => findOwningParent(parents, effectivePathname),
    [parents, effectivePathname]
  )

  const viewParent =
    override && override.path === effectivePathname
      ? (parents.find((item) => item.key === override.key) ?? null)
      : owningParent

  // Direction-aware drill animation
  const [direction, setDirection] = React.useState<"forward" | "back">("back")

  const handleNavigate = (item: NavItem) => {
    if (item.children?.length) {
      // Drilling into a submenu keeps the sidebar open (no page change).
      setDirection("forward")
      setOverride({ path: effectivePathname, key: item.key })
      return
    }
    // Leaf navigation leaves the sidebar: on mobile close the sheet so the
    // destination page is visible. Placeholder hrefs change no page.
    if (!item.href.startsWith("#")) setOpenMobile(false)
  }

  const handleBack = () => {
    setDirection("back")
    setOverride({ path: effectivePathname, key: null })
  }

  const viewKey = viewParent?.key ?? "root"

  const content = viewParent ? (
    <SidebarGroup className="px-4 py-0">
      <SidebarMenu>
        {viewParent.children!.map((child) => (
          <NavRow
            key={child.key}
            item={child}
            active={isActive(effectivePathname, child)}
            onNavigate={handleNavigate}
          />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  ) : (
    sections.map((section, index) =>
      section.items.length > 0 ? (
        <SidebarGroup
          key={section.label ?? `section-${index}`}
          className="px-4 py-0"
        >
          <SidebarMenu>
            {section.items.map((item) => (
              <NavRow
                key={item.key}
                item={item}
                active={
                  !item.children?.length && isActive(effectivePathname, item)
                }
                onNavigate={handleNavigate}
              />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ) : null
    )
  )

  const enterX = direction === "forward" ? 8 : -8
  const exitX = direction === "forward" ? -8 : 8

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {back && (
        <div className="px-2 pb-1">
          <button
            type="button"
            onClick={() => {
              setOpenMobile(false)
              router.push(back.href)
            }}
            className="flex h-7 w-full items-center gap-1.5 rounded-lg px-2 text-[0.8125rem] font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {/* Back points toward the inline start (right in RTL): the base
                icon points left, so flip it under RTL. */}
            <ChevronLeft className="size-4 shrink-0 rtl:rotate-180" />
            <span className="text-start">{back.label}</span>
          </button>
        </div>
      )}
      {viewParent && (
        <div className="px-2 pb-1">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-8 w-full items-center gap-1 rounded-md px-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {/* Back points toward the inline start (right in RTL): the base
                icon points left, so flip it under RTL. */}
            <ChevronLeft className="size-4 shrink-0 rtl:rotate-180" />
            <span className="flex-1 text-center">{viewParent.label}</span>
          </button>
        </div>
      )}

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={viewKey}
          initial={{ opacity: 0, x: reduceMotion ? 0 : enterX }}
          animate={{
            opacity: 1,
            x: 0,
            filter: reduceMotion ? "blur(0px)" : undefined,
          }}
          exit={{
            opacity: 0,
            x: reduceMotion ? 0 : exitX,
            filter: "blur(2px)",
            transition: { duration: 0.12, ease: EASE_OUT_STRONG },
          }}
          transition={{ duration: 0.16, ease: EASE_OUT_STRONG }}
          style={{ willChange: "transform, opacity, filter" }}
          className="min-h-0"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
