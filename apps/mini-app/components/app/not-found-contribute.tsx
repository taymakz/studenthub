"use client"

import { ExternalLink, LifeBuoy } from "lucide-react"

import { GITHUB_REPO_URL } from "@/constants"

const SUPPORT_URL = "https://t.me/studenthubir?direct"

/**
 * «didn't find your …?» fallback shown at the end of the wizard's registry
 * steps. Two actions: contact support (same link as Settings → پشتیبانی) and
 * self-contribute via GitHub.
 */
export function NotFoundContribute({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed p-4 text-center">
      <p className="text-sm text-muted-foreground">
        {label} خود را پیدا نکردید؟
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
        >
          <LifeBuoy className="size-4" aria-hidden />
          ارتباط با پشتیبانی
        </a>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ExternalLink className="size-4" aria-hidden />
          خودم برنامه نویسم اضافه میکنم
        </a>
      </div>
    </div>
  )
}
