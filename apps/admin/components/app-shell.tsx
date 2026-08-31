"use client"

import * as React from "react"

import { CircleQuestionMark } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { BootstrapLoading } from "@/components/bootstrap-loading"
import { useAuthBootstrap } from "@/components/auth-bootstrap"
import { CommandPalette } from "@/components/command-palette"
import { useSidebarPeekStore } from "@/components/sidebar-peek-store"
import { Button } from "@workspace/ui/components/button"
import { Kbd } from "@workspace/ui/components/kbd"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { cn } from "@workspace/ui/lib/utils"

/** Dismisses the peek preview whenever the sidebar becomes expanded, so the
    overlay can't linger over the now-docked panel. */
function PeekDismissOnExpand() {
  const { state } = useSidebar()
  const setPeeking = useSidebarPeekStore((s) => s.setPeeking)

  React.useEffect(() => {
    if (state === "expanded") setPeeking(false)
  }, [state, setPeeking])

  return null
}

/** Start-edge hover zone that previews a hidden sidebar. Rendered only while
    the sidebar is collapsed, so grazing the edge over the docked panel can
    never dim the screen. Lives inside the provider to read sidebar state. */
function EdgeHoverZone() {
  const { state } = useSidebar()
  const setPeeking = useSidebarPeekStore((s) => s.setPeeking)
  if (state !== "collapsed") return null
  return (
    <div
      aria-hidden="true"
      onMouseEnter={() => setPeeking(true)}
      className="fixed inset-y-0 inset-s-0 z-30 hidden w-2 lg:block"
    />
  )
}

function HelpFooter() {
  return (
    <footer className="hidden h-8 shrink-0 items-center justify-end px-1.5 py-0.5 lg:flex">
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="باز کردن راهنما"
              className="size-7 rounded-full text-muted-foreground"
            />
          }
        >
          <CircleQuestionMark />
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-72 p-3">
          <p className="text-sm font-medium">ولین</p>
          <p className="mt-1 text-xs text-muted-foreground">
            قالب مدیریت ولین — همه داده‌ها در این نسخه نمایشی هستند.
          </p>
          <Separator className="my-3" />
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">نوار کناری</span>
              <span className="flex items-center gap-1">
                <Kbd>Ctrl</Kbd>
                <Kbd>B</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">پالت فرمان</span>
              <span className="flex items-center gap-1">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </div>
          </div>
          <Separator className="my-3" />
          <Button variant="outline" size="sm" className="h-7 w-full text-xs">
            تماس با پشتیبانی
          </Button>
        </PopoverContent>
      </Popover>
    </footer>
  )
}

export function AppShell({
  defaultOpen = true,
  children,
}: {
  defaultOpen?: boolean
  children?: React.ReactNode
}) {
  return <AppShellInner defaultOpen={defaultOpen}>{children}</AppShellInner>
}

function AppShellInner({
  defaultOpen = true,
  children,
}: {
  defaultOpen?: boolean
  children?: React.ReactNode
}) {
  const booting = useAuthBootstrap()
  const [commandOpen, setCommandOpen] = React.useState(false)
  const peeking = useSidebarPeekStore((s) => s.peeking)
  const setPeeking = useSidebarPeekStore((s) => s.setPeeking)

  // Escape dismisses the peek preview (never the pinned state).
  React.useEffect(() => {
    if (!peeking) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPeeking(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [peeking, setPeeking])

  // So does the pointer leaving the browser window entirely: mouseleave on
  // <html> fires only for real viewport exits, not element transitions.
  React.useEffect(() => {
    if (!peeking) return
    const root = document.documentElement
    function onMouseLeave() {
      setPeeking(false)
    }
    root.addEventListener("mouseleave", onMouseLeave)
    return () => root.removeEventListener("mouseleave", onMouseLeave)
  }, [peeking, setPeeking])

  const handleOpenChange = React.useCallback((open: boolean) => {
    document.cookie = `sidebar-open=${open}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.classList.toggle("sidebar-collapsed", !open)
  }, [])

  // Keep <html> in sync with the server-provided initial state (the inline
  // script normally handles this; this covers any edge where it did not run).
  React.useEffect(() => {
    document.documentElement.classList.toggle("sidebar-collapsed", !defaultOpen)
  }, [defaultOpen])

  // ⌘K / Ctrl+K opens the command palette
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setCommandOpen((open) => !open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <div className="flex h-svh overflow-hidden">
      {booting && <BootstrapLoading />}
      <SidebarProvider
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
      >
        {/* Expanding the sidebar (icon click / Ctrl+B) dismisses the peek,
            so the overlay can't linger over the now-docked panel. */}
        <PeekDismissOnExpand />
        <EdgeHoverZone />
        <div
          aria-hidden="true"
          onClick={() => setPeeking(false)}
          className={cn(
            // Peek overlay: above header (z-30) + filter (z-20) + content, below the floating peek card (z-50).
            // Fixed viewport overlay, hidden on small screens (peek only on lg).
            "fixed inset-0 z-40 hidden bg-black/20 backdrop-blur-[2px] transition-opacity duration-150 lg:block",
            peeking ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
        <AppSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <SidebarInset className="lg:sidebar-collapse:ms-2 flex min-h-0 w-auto flex-col overflow-hidden bg-secondary transition-[margin] duration-100 ease-linear lg:me-2 lg:mt-2 lg:rounded-xl lg:border lg:border-border/60">
            <main className="content-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              {/* Children stay mounted (instant-navigation validation walks
                  the tree); the BootstrapLoading overlay hides them while
                  booting instead of omitting them. */}
              <div
                inert={booting}
                aria-hidden={booting}
                className={
                  booting ? "invisible min-h-full" : "visible min-h-full"
                }
              >
                {children}
              </div>
            </main>
          </SidebarInset>
          {/* Same footer strip during bootstrap, just empty: keeps the
              layout identical so nothing shifts when content arrives. */}
          {booting ? (
            <footer className="hidden h-8 shrink-0 lg:flex" />
          ) : (
            <HelpFooter />
          )}
        </div>
      </SidebarProvider>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  )
}
