"use client"

import { useQuery } from "@tanstack/react-query"

import { fetchMajors } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"

type TermNumberPickerProps = {
  value: number | null
  onSelect: (n: number) => void
  disabled?: boolean
  pendingValue?: number | null
}

export function TermNumberPicker({ value, onSelect, disabled, pendingValue }: TermNumberPickerProps) {
  const profile = useProfileStore((s) => s.profile)
  const majorsQuery = useQuery({
    queryKey: ["majors", profile?.universitySlug],
    queryFn: async () => (await fetchMajors(profile!.universitySlug!)).data.majors,
    enabled: Boolean(profile?.universitySlug),
  })
  const selectedMajor = majorsQuery.data?.find((m) => m.slug === profile?.majorSlug)
  const degree = selectedMajor?.degrees.find((d) => d.slug === profile?.degree)
  const degreeTermCount = degree?.termCount ?? 8
  const maxTerm = degree?.maxTermCount ?? 12
  const normal = Array.from({ length: degreeTermCount }, (_, i) => degreeTermCount - i)
  const extended = maxTerm > degreeTermCount ? Array.from({ length: maxTerm - degreeTermCount }, (_, i) => maxTerm - i) : []

  const isPending = pendingValue != null

  const renderGrid = (terms: number[], isExtended = false) => (
    <div className="flex flex-wrap justify-center gap-2">
      {terms.map((n) => {
        const isSelected = value === n
        const isLoading = isPending && pendingValue === n
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(n)}
            className={`flex size-12 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors ${
              isSelected
                ? isExtended
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-primary bg-primary text-primary-foreground"
                : isExtended
                  ? "border-amber-200 hover:border-amber-300 dark:border-amber-900/50"
                  : "bg-card hover:border-primary/50"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${isLoading ? "animate-pulse" : ""}`}
          >
            {isLoading ? "..." : n}
          </button>
        )
      })}
    </div>
  )

  if (majorsQuery.isLoading && !selectedMajor) {
    return <div className="p-4 text-center text-sm text-muted-foreground">در حال بارگذاری…</div>
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">ترم‌های اصلی (۱ تا {degreeTermCount})</p>
        {renderGrid(normal)}
      </div>
      {extended.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium text-amber-600 dark:text-amber-400">سنوات مجاز ({degreeTermCount + 1} تا {maxTerm})</p>
          {renderGrid(extended, true)}
        </div>
      )}
    </div>
  )
}
