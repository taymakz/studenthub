"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Sidebar2 } from "reicon/icons/Sidebar2"

import { useSidebarPeekStore } from "@/components/sidebar-peek-store"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useSidebar } from "@workspace/ui/components/sidebar"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@workspace/ui/lib/utils"

const toggleClasses =
  "inline-flex size-7 shrink-0  items-center justify-center rounded-full px-0.5 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground [&_svg]:size-4"

const cloneClasses =
  "fixed z-50 inline-flex size-7 shrink-0  items-center justify-center rounded-full px-0.5 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground [&_svg]:size-4"

function ToggleIcon() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex"
      style={{ transform: "scaleX(-1)" }}
      dangerouslySetInnerHTML={{ __html: Sidebar2.toSvg({ size: 16 }) }}
    />
  )
}

/** Icon button that toggles the app sidebar (open/closed, any viewport).
    Hovering it while the sidebar is hidden previews the panel as a
    floating card.

    During the preview the in-page trigger ends up beneath the floating
    panel no matter its z-index, so an identical body-level clone takes
    over: it is pinned to the trigger's measured viewport rect (immune to
    collapse margins, borders and RTL), hides the original instantly, and
    offers a "Click to expand sidebar" tooltip. Clicking pins the sidebar
    open. */
export function SidebarToggle({ className }: { className?: string }) {
  const { state, toggleSidebar, isMobile } = useSidebar()
  const peeking = useSidebarPeekStore((s) => s.peeking)
  const setPeeking = useSidebarPeekStore((s) => s.setPeeking)
  const collapsed = state === "collapsed"
  const desktop = useMediaQuery("lg")
  const sourceRef = React.useRef<HTMLButtonElement>(null)
  const cloneRef = React.useRef<HTMLButtonElement>(null)
  const cloneVisible = desktop && collapsed && peeking
  // On desktop an expanded panel occupies its own space, making the
  // trigger redundant -- hide it there (the rail / Ctrl+B collapse it).
  // Mobile always shows it: the Sheet needs an opener.
  const redundant = !isMobile && state === "expanded"

  // Copy the trigger's live viewport position onto the clone -- class-based
  // guesses drift (collapse adds an 8px margin + 1px border; RTL mirrors),
  // the rect cannot.
  React.useLayoutEffect(() => {
    if (!cloneVisible) return
    const rect = sourceRef.current?.getBoundingClientRect()
    const clone = cloneRef.current
    if (!rect || !clone) return
    clone.style.top = `${rect.top}px`
    clone.style.left = `${rect.left}px`
  }, [cloneVisible])

  const label = collapsed ? "Show sidebar" : "Hide sidebar"

  return (
    <>
      <button
        ref={sourceRef}
        type="button"
        aria-label={label}
        title={label}
        onClick={toggleSidebar}
        onMouseEnter={collapsed ? () => setPeeking(true) : undefined}
        className={cn(
          toggleClasses,
          className,
          // Peek swap: keep layout so the clone can copy this button's rect.
          cloneVisible && "invisible",
          // Redundant on desktop while expanded: out of the flow entirely,
          // so the header content shifts left into the freed space.
          redundant && !cloneVisible && "hidden"
        )}
      >
        <ToggleIcon />
      </button>

      {cloneVisible &&
        createPortal(
          <TooltipProvider delay={1000}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    ref={cloneRef}
                    type="button"
                    aria-label={label}
                    data-peek-anchor=""
                    onClick={toggleSidebar}
                    className={cloneClasses}
                  />
                }
              >
                <ToggleIcon />
              </TooltipTrigger>
              <TooltipContent side="bottom" data-peek-anchor="">
                برای باز کردن نوار کناری کلیک کنید
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>,
          document.body
        )}
    </>
  )
}
