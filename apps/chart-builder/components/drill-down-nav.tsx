"use client"

import * as React from "react"

import { useReducedMotion, AnimatePresence, motion } from "motion/react"
import { Check, ChevronLeft, type LucideIcon } from "lucide-react"
import type { IconFunction } from "reicon/createIcon"

import { cn } from "@workspace/ui/lib/utils"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

/** Lucide components render as JSX; reicon functions render via toSvg. */
export type NavIcon = LucideIcon | IconFunction

/** A sidebar entry driven by an action callback instead of navigation. */
export type NavAction = {
  key: string
  label: string
  icon?: NavIcon
  /** Trailing counter/value badge (leaf rows only). */
  badge?: string
  /** Muted current-value summary shown before the drill-in chevron (parent rows). */
  summary?: string
  /** Marks an option row as selected (radio or multi-select). */
  checked?: boolean
  danger?: boolean
  disabled?: boolean
  onSelect?: () => void
  children?: NavAction[]
}

export type NavSection = {
  divider?: boolean
  label?: string
  items: NavAction[]
}

/** Renders a nav icon, which may be a Lucide component (JSX) or a reicon
    function (SVG string). Keeps either icon set pixel-consistent at 14px
    like the surrounding menu buttons. */
function NavActionIcon({ icon }: { icon: NavIcon }) {
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

function ActionRow({
  item,
  onSelect,
}: {
  item: NavAction
  onSelect: (item: NavAction) => void
}) {
  const hasChildren = !!item.children?.length

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={hasChildren ? undefined : item.checked}
        disabled={item.disabled}
        onClick={() => onSelect(item)}
        className={cn(
          "text-muted-foreground",
          item.checked && !hasChildren && "text-sidebar-accent-foreground",
          item.danger &&
            "text-destructive/80 hover:bg-destructive/10 hover:text-destructive active:text-destructive"
        )}
      >
        {item.icon && <NavActionIcon icon={item.icon} />}
        <span>{item.label}</span>
        {!hasChildren && item.checked && (
          <Check className="ms-auto size-3.5 shrink-0" />
        )}
        {!hasChildren && !item.checked && item.badge && (
          <span className="ms-auto border-transparent px-1.5 text-[10px] text-foreground/50 tabular-nums">
            {item.badge}
          </span>
        )}
        {hasChildren && item.summary && (
          <span className="ms-auto truncate pe-5 text-[11px] font-normal text-foreground/45">
            {item.summary}
          </span>
        )}
      </SidebarMenuButton>
      {!hasChildren ? null : (
        <span className="inset-e-1 pointer-events-none absolute top-1/2 -translate-y-1/2 text-sidebar-foreground/60">
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

/** Same drill-down navigation as the previous admin project, but every row
    fires an action instead of navigating: parents slide their children in
    behind a back button, leaves run their callback. Animation is
    direction-aware (forward/back), exits faster than it enters, uses blur to
    mask the crossfade, and respects prefers-reduced-motion. */
export function SidebarDrillDownNav({ sections }: { sections: NavSection[] }) {
  const reduceMotion = useReducedMotion() ?? false
  const { setOpenMobile } = useSidebar()

  // null = root view; otherwise the key of the drilled-in parent.
  const [openKey, setOpenKey] = React.useState<string | null>(null)

  // Direction-aware drill animation
  const [direction, setDirection] = React.useState<"forward" | "back">("back")

  const parents = React.useMemo(
    () =>
      sections.flatMap((section) =>
        section.items.filter((item) => item.children?.length)
      ),
    [sections]
  )

  const viewParent =
    (openKey && parents.find((item) => item.key === openKey)) || null

  const handleSelect = (item: NavAction) => {
    if (item.children?.length) {
      setDirection("forward")
      setOpenKey(item.key)
      return
    }
    item.onSelect?.()
    // Leaf actions leave the sidebar: on mobile close the sheet so the
    // result is visible on the page.
    setOpenMobile(false)
  }

  const handleBack = () => {
    setDirection("back")
    setOpenKey(null)
  }

  const viewKey = viewParent?.key ?? "root"

  const content = viewParent ? (
    <SidebarGroup className="px-4 py-0">
      <SidebarMenu>
        {viewParent.children!.map((child) => (
          <ActionRow key={child.key} item={child} onSelect={handleSelect} />
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
          {section.label && (
            <div className="px-2 pt-3 pb-1 text-[11px] font-medium tracking-wide text-sidebar-foreground/40">
              {section.label}
            </div>
          )}
          <SidebarMenu>
            {section.items.map((item) => (
              <ActionRow key={item.key} item={item} onSelect={handleSelect} />
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
          className="min-h-0 overflow-y-auto"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
