"use client"

import { useEffect, useState } from "react"

import { getBannedReason } from "@/lib/request"
import { useProfileStore } from "@/stores/profile-store"

/**
 * Standalone banned route. AppBootstrap redirects here via client-side
 * router when the profile store detects 403 { banned: true } from /me.
 * The route sits OUTSIDE the (bootstrap) group so it never re-triggers hydration.
 */
export default function BannedPage() {
  const storeReason = useProfileStore((s) => s.bannedReason)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const reason = storeReason ?? getBannedReason()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        {/* Status badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-[10px] tracking-[0.25em] text-destructive uppercase">
          <span className="relative inline-flex size-2">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-destructive/60" />
            <span className="relative inline-flex size-2 rounded-full bg-destructive" />
          </span>
          دسترسی مسدود
        </div>

        {/* Icon */}
        <div className="mt-8 flex size-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
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
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="mt-6 text-2xl leading-tight font-semibold">
          حساب شما مسدود شده است
        </h1>

        {/* Description */}
        <p className="mt-2 max-w-sm text-sm text-balance text-muted-foreground">
          {reason ||
            "دسترسی شما به این برنامه به دلیل نقض قوانین مسدود شده است."}
        </p>

        <p className="mt-2 max-w-sm text-xs text-balance text-muted-foreground">
          اگر فکر می‌کنید اشتباهی رخ داده است، با پشتیبانی تماس بگیرید.
        </p>

        <a
          href="https://t.me/studenthubir?direct"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md transition-opacity hover:opacity-90"
        >
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
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
          </svg>
          تماس با پشتیبانی
        </a>

        <p className="mt-8 text-xs text-muted-foreground/60">
          شناسه شما برای پیگیری نگه داشته شده است.
        </p>
      </div>
    </div>
  )
}
