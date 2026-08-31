"use client"

import { useEffect, useState, type ReactNode } from "react"

/** Simulated app-shell bootstrap duration before page content mounts. */
const BOOTSTRAP_MS = 1600

function BootSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3 lg:p-6">
      {[0, 1, 2].map((index) => (
        <div
          className="rounded-xl bg-card ring-1 ring-foreground/10"
          key={index}
        >
          <div className="h-[148px] animate-pulse rounded-xl bg-muted/50" />
        </div>
      ))}
    </div>
  )
}

/**
 * Simulates the app bootstrap phase. Children (and their data loads)
 * mount only after the skeleton has been shown for BOOTSTRAP_MS.
 */
export function DashboardBoot({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), BOOTSTRAP_MS)
    return () => clearTimeout(timer)
  }, [])

  return <>{booted ? children : <BootSkeleton />}</>
}
