"use client"

import { useEffect, useState } from "react"
import { LogOut } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { StatusButton } from "@workspace/ui/components/status-button"

import { SettingsRow } from "@/components/app/theme/settings-row"
import { buildApiUrl } from "@/lib/request"
import { clearWebToken } from "@/lib/auth/web-token"

/** Detect whether we run inside Telegram Mini App. Module-scope so the
    dynamic import + nested fallbacks stay out of the Compiler's graph, and
    memoized so every settings mount (canonical + swipe preview) reuses the
    same resolved answer instead of re-detecting and flashing the row. */
let tmaDetection: Promise<boolean> | null = null
function detectIsTMA(): Promise<boolean> {
  tmaDetection ??= (async () => {
    try {
      const { isTMA: check } = await import("@tma.js/bridge")
      // Prefer complete mode for reliable detection (100ms), fallback to simple
      try {
        return await (check as unknown as (
          mode: string,
          opts?: { timeout: number }
        ) => Promise<boolean>)("complete", { timeout: 120 })
      } catch {
        try {
          return (check as unknown as () => boolean)()
        } catch {
          return false
        }
      }
    } catch {
      return false
    }
  })()
  return tmaDetection
}

export default function LogoutRow() {
  const [open, setOpen] = useState(false)
  const [isTMA, setIsTMA] = useState<boolean | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    void detectIsTMA().then((inside) => {
      if (!cancelled) setIsTMA(inside)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Only Web version — inside TMA (initData) hide the row
  if (isTMA === null || isTMA === true) return null

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await fetch(buildApiUrl("/auth/telegram/logout"), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      })
    } catch {}
    try {
      clearWebToken()
    } catch {}
    try {
      sessionStorage.removeItem("sh_bypass_maintenance")
    } catch {}
    // Let StatusButton show success, then hard reload so AppBootstrap sees no auth
    await new Promise<void>((r) => setTimeout(r, 400))
    window.location.assign("/")
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<LogOut className="size-5 text-destructive" />}
            title="خروج از حساب"
            description="خروج از نسخه وب"
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader className="text-center">
          <DrawerTitle>خروج از حساب</DrawerTitle>
          <DrawerDescription>آیا مطمئن هستید می‌خواهید خارج شوید؟</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={loggingOut}>
              انصراف
            </Button>
            <StatusButton variant="destructive" className="flex-1" onClick={handleLogout} successLabel="خارج شدید">
              خروج
            </StatusButton>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
