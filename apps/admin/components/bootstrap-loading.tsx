"use client"

import { AppLogo } from "@workspace/ui/components/app-logo"

/** Full-screen bootstrap screen shown while the auth session handshake runs.
    Mirrors the real shell's silhouette (sidebar + inset content card + footer
    strip) so the swap to the live layout is seamless. The `sidebar-collapse:`
    variants track the persisted sidebar state exactly like the real shell.
    Only reached when a session cookie exists - otherwise the layout redirects
    to /auth before this renders. */
export function BootstrapLoading() {
  return (
    <div
      role="status"
      aria-label="در حال بارگذاری فضای کاری شما"
      className="fixed inset-0 z-50 flex overflow-hidden bg-background"
    >
      {/* Sidebar silhouette (w-64 = 16rem = --sidebar-width; hides when
          collapsed). Gated at lg like the real sidebar, which does not
          exist below that breakpoint. */}
      <div className="sidebar-collapse:w-0 hidden h-full w-64 shrink-0 flex-col bg-background lg:flex">
        <div className="px-4 pt-6 pb-2">
          <div className="h-5" />
        </div>
        <div className="min-h-0 flex-1 px-4 pt-4" />
        <div className="pb-5" />
      </div>

      {/* Content column with the same inset card + footer strip as the shell;
          the brand mark + status line sit at its center. */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="lg:sidebar-collapse:ms-2 flex min-h-0 w-auto flex-1 items-center justify-center overflow-hidden rounded-none border-border/60 bg-secondary lg:me-2 lg:mt-2 lg:rounded-xl lg:border">
          <div className="flex flex-col items-center gap-5">
            <AppLogo className="size-[33.6px] w-auto" />
            <p className="animate-pulse text-sm text-muted-foreground">
              در حال بررسی نشست شما…
            </p>
          </div>
        </div>
        <footer className="hidden h-8 shrink-0 lg:flex" />
      </div>
    </div>
  )
}
