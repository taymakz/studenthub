"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

import { useMounted } from "@/hooks/use-mounted"
import { getMaintenanceCanBypass, getMaintenanceReason } from "@/lib/request"
import { useProfileStore } from "@/stores/profile-store"

/** Re-probe /me and leave the page if maintenance cleared. Module-scope:
    try/finally + navigation stay out of the Compiler's component graph. */
async function runMaintenanceCheck(
  router: { refresh: () => void },
  onDone: () => void
) {
  try {
    await useProfileStore.getState().refresh()
    const s = useProfileStore.getState()
    // If maintenance cleared (or bypass now valid), leave the page.
    // Use hard navigation so AppBootstrap re-gates from "/".
    if (!s.maintenance) {
      // Clear any stale session flag that might keep us here
      try {
        sessionStorage.removeItem("sh_maintenance_reason")
      } catch {}
      window.location.assign("/")
      return
    }
    // Still in maintenance — force a full revalidation of the route as well
    router.refresh()
  } finally {
    onDone()
  }
}

/**
 * Standalone maintenance route. AppBootstrap redirects here via client-side
 * router when the profile store detects 503 { maintenance: true } from /me.
 * The route sits OUTSIDE the (bootstrap) group so it never re-triggers hydration.
 */
export default function MaintenancePage() {
  const router = useRouter()
  const storeReason = useProfileStore((s) => s.maintenanceReason)
  const user = useProfileStore((s) => s.user)
  const maintenance = useProfileStore((s) => s.maintenance)
  const hydrated = useProfileStore((s) => s.hydrated)
  const maintenanceCanBypass = useProfileStore((s) => s.maintenanceCanBypass)
  const [bypassing, setBypassing] = useState(false)
  const [checking, setChecking] = useState(false)
  const mounted = useMounted()

  // If this page is ever reached via hard refresh (e.g. direct link), ensure
  // we actually probe /me — the store starts unhydrated and would otherwise
  // show stale sessionStorage forever.
  useEffect(() => {
    if (!hydrated && !checking) {
      void useProfileStore.getState().refresh()
    }
  }, [hydrated, checking])
  // Fallback: if the store hasn't hydrated yet (e.g. hard-nav), read from
  // sessionStorage where request.ts persists the 503 metadata.
  const maintenanceReason = storeReason ?? getMaintenanceReason()

  // Superadmins always get canBypass — check the store, the resolved user
  // role, or the persisted sessionStorage flag (survives hard-nav/reload).
  const canBypassMaintenance =
    mounted &&
    (maintenanceCanBypass ||
      user?.role === "SUPERADMIN" ||
      getMaintenanceCanBypass())

  const handleBypass = () => {
    setBypassing(true)
    try {
      sessionStorage.setItem("sh_bypass_maintenance", "1")
    } catch {}
    // Hard-navigate to / so AppBootstrap re-hydrates with the bypass header.
    // /maintenance sits outside the (bootstrap) group, so reloading here
    // would never re-run the /me fetch — the user stays stuck.
    window.location.assign("/")
  }

  const handleCheckAgain = () => {
    if (checking) return
    setChecking(true)
    void runMaintenanceCheck(router, () => setChecking(false))
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        {/* Status badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
          <span className="relative inline-flex size-2">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-amber-500/60" />
            <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
          </span>
          در حال تعمیر و نگهداری
        </div>

        {/* Icon */}
        <div className="mt-8 flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-foreground shadow-xs/5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="mt-6 text-2xl leading-tight font-semibold">
          به زودی برمی‌گردیم.
        </h1>

        {/* Description */}
        <p className="mt-2 max-w-sm text-sm text-balance text-muted-foreground">
          {maintenanceReason ||
            "برنامه در حال به‌روزرسانی و تعمیر است. تمام اطلاعات شما محفوظ است و هیچ داده‌ای از بین نمی‌رود."}
        </p>

        {canBypassMaintenance ? (
          <button
            onClick={handleBypass}
            disabled={bypassing}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {bypassing ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                در حال ورود…
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" x2="3" y1="12" y2="12" />
                </svg>
                ورود به عنوان سوپرادمین
              </>
            )}
          </button>
        ) : null}

        {/* Retry hint */}
        <p className="mt-8 text-xs text-muted-foreground/60">
          لطفاً بعداً دوباره تلاش کنید.
        </p>
        <button
          onClick={() => void handleCheckAgain()}
          disabled={checking}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 disabled:opacity-60"
        >
          {checking ? (
            <>
              <span className="size-3 animate-spin rounded-full border border-muted-foreground/30 border-t-muted-foreground" />
              در حال بررسی…
            </>
          ) : (
            "بررسی مجدد"
          )}
        </button>
        {hydrated && maintenance === false ? (
          <p className="mt-2 text-xs font-medium text-emerald-600">
            تعمیرات به پایان رسید — در حال انتقال…
          </p>
        ) : null}
      </div>
    </div>
  )
}
