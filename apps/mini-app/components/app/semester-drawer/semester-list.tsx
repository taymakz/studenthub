"use client"

import { Badge } from "@workspace/ui/components/badge"
import type { OfferingTerm } from "@/lib/api"

function termLabel(sem: string) {
  if (sem === "MEHR") return "مهر"
  if (sem === "BAHMAN") return "بهمن"
  return "تابستان"
}

export function SemesterList({
  terms,
  currentCode,
  newerCode,
  onSelect,
  isLoading,
}: {
  terms: OfferingTerm[]
  currentCode?: string | null
  newerCode?: string | null
  onSelect: (code: string) => void
  isLoading: boolean
}) {
  if (isLoading) return <p className="py-6 text-center text-sm text-muted-foreground">در حال بارگذاری…</p>
  if (terms.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">نیم‌سالی یافت نشد</p>
  const sorted = terms.toSorted((a, b) => b.termCode.localeCompare(a.termCode))
  return (
    <>
      {sorted.map((t) => (
        <button
          key={t.termCode}
          type="button"
          onClick={() => onSelect(t.termCode)}
          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start transition-colors ${t.termCode === currentCode ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40"}`}
        >
          <span className="text-sm tabular-nums">{t.termCode} {termLabel(t.semester)}</span>
          {t.termCode === currentCode ? <Badge variant="secondary" className="h-5 px-1.5 text-xs">فعلی</Badge> : t.termCode === newerCode ? <Badge className="h-5 px-1.5 text-xs">جدید</Badge> : null}
        </button>
      ))}
    </>
  )
}
