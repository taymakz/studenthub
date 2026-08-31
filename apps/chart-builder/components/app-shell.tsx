"use client"

import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import {
  useAuthBootstrap,
  startAuthBootstrap,
} from "@/components/auth-bootstrap"
import { BootstrapLoading } from "@/components/bootstrap-loading"
import { SidebarDialogs } from "@/components/sidebar-dialogs"
import { useSidebarPeekStore } from "@workspace/ui/components/sidebar-peek-store"
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
import { CircleHelp } from "lucide-react"

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
      className="inset-s-0 fixed inset-y-0 z-30 hidden w-2 xl:block"
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
              aria-label="راهنما"
              className="size-7 rounded-full text-muted-foreground"
            />
          }
        >
          <CircleHelp />
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-72 p-3">
          <p className="text-sm font-medium">ابزار ساخت چارت</p>
          <p className="mt-1 text-xs text-muted-foreground">
            چارت درسی بسازید و به رجیستری دانشجویار اضافه کنید.
          </p>
          <Separator className="my-3" />
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                باز و بسته کردن سایدبار
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Ctrl</Kbd>
                <Kbd>B</Kbd>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">تغییر تم</span>
              <span className="flex items-center gap-1">
                <Kbd>D</Kbd>
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </footer>
  )
}

/** Ctrl+B toggles the sidebar. */
function KeyboardShortcuts() {
  const { open, setOpen } = useSidebar()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(!open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, setOpen])

  return null
}

export function AppShell({
  defaultOpen = true,
  children,
}: {
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const peeking = useSidebarPeekStore((s) => s.peeking)
  const setPeeking = useSidebarPeekStore((s) => s.setPeeking)
  const booting = useAuthBootstrap()

  // Fake auth handshake; content stays mounted but hidden while it runs.
  React.useEffect(() => startAuthBootstrap(), [])

  // Persist toggle state and mirror it onto <html> so the bootstrap
  // silhouette (and every sidebar-collapse: variant) tracks the real panel.
  const handleOpenChange = React.useCallback((open: boolean) => {
    document.cookie = `sidebar-open=${open}; path=/; max-age=31536000; samesite=lax`
    document.documentElement.classList.toggle("sidebar-collapsed", !open)
  }, [])

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

  return (
    <div className="flex h-svh overflow-hidden">
      {booting && <BootstrapLoading />}
      <SidebarProvider
        defaultOpen={defaultOpen}
        onOpenChange={handleOpenChange}
      >
        {/* Expanding the sidebar dismisses the peek, so the overlay can't
            linger over the now-docked panel. */}
        <PeekDismissOnExpand />
        <EdgeHoverZone />
        <div
          aria-hidden="true"
          onClick={() => setPeeking(false)}
          className={cn(
            // Peek overlay (collapsed + hover only): plain dim, no blur.
            "fixed inset-0 z-5 hidden bg-black/20 transition-opacity duration-150 xl:block",
            peeking ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
        <AppSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col">
          <SidebarInset className="lg:sidebar-collapse:ms-2 flex min-h-0 w-auto flex-col overflow-hidden bg-secondary transition-[margin] duration-100 ease-linear lg:me-2 lg:mt-2 lg:rounded-xl lg:border lg:border-border/60">
            <main className="content-scroll min-h-0 flex-1 overflow-y-auto">
              {/* Children stay mounted while booting; the BootstrapLoading
                  overlay hides them instead of omitting them. */}
              <div
                inert={booting}
                aria-hidden={booting}
                className={
                  booting
                    ? "invisible flex min-h-full flex-col"
                    : "visible flex min-h-full flex-col"
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
        <KeyboardShortcuts />
        <SidebarDialogs />
      </SidebarProvider>
    </div>
  )
}
