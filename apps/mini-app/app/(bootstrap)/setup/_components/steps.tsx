"use client"

import { Virtuoso } from "react-virtuoso"

import { cn } from "@workspace/ui/lib/utils"
import { NotFoundContribute } from "@/components/app/not-found-contribute"
import { UniversityTypeIcon } from "@/components/app/university-type-icon"
import type { MajorIndexEntry, UniversityIndexEntry } from "@/lib/api"

import { ListSearch } from "./list-search"
import { OptionGrid } from "./option-grid"
import { OptionRow } from "./option-row"

const SEMESTER_LABEL = { MEHR: "مهر", BAHMAN: "بهمن", SUMMER: "تابستان" } as const

export function UniversityStep({
  universities,
  filteredUnis,
  visibleUnis,
  uniSearch,
  setUniSearch,
  selectedSlug,
  onSelect,
  onDoubleClick,
  onLoadMore,
  isLoading,
}: {
  universities: UniversityIndexEntry[]
  filteredUnis: UniversityIndexEntry[]
  visibleUnis: UniversityIndexEntry[]
  uniSearch: string
  setUniSearch: (v: string) => void
  selectedSlug?: string
  onSelect: (u: UniversityIndexEntry) => void
  onDoubleClick: (u: UniversityIndexEntry) => void
  onLoadMore: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-2.5">
      {universities.length > 10 && (
        <div className="pb-3">
          <ListSearch value={uniSearch} onChange={setUniSearch} resultCount={filteredUnis.length} />
        </div>
      )}
      {isLoading && universities.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : filteredUnis.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">نتیجه‌ای یافت نشد.</p>
      ) : (
        <Virtuoso
          useWindowScroll
          data={visibleUnis}
          computeItemKey={(_, u) => u.slug}
          endReached={onLoadMore}
          itemContent={(_, u) => (
            <div className="pb-2.5">
              <OptionRow
                title={u.name?.fa ?? u.slug}
                subtitle={u.location?.fa}
                leading={<UniversityTypeIcon type={u.type} className="size-7" />}
                selected={selectedSlug === u.slug}
                onClick={() => onSelect(u)}
                onDoubleClick={() => onDoubleClick(u)}
              />
            </div>
          )}
        />
      )}
      <NotFoundContribute label="دانشگاه" />
    </div>
  )
}

export function MajorStep({
  allMajors,
  filteredMajors,
  visibleMajors,
  majorSearch,
  setMajorSearch,
  selectedSlug,
  onSelect,
  onDoubleClick,
  onLoadMore,
  isLoading,
}: {
  allMajors: MajorIndexEntry[]
  filteredMajors: MajorIndexEntry[]
  visibleMajors: MajorIndexEntry[]
  majorSearch: string
  setMajorSearch: (v: string) => void
  selectedSlug?: string
  onSelect: (m: MajorIndexEntry) => void
  onDoubleClick: (m: MajorIndexEntry) => void
  onLoadMore: () => void
  isLoading: boolean
}) {
  return (
    <div className="space-y-2.5">
      {allMajors.length > 10 && (
        <div className="pb-3">
          <ListSearch value={majorSearch} onChange={setMajorSearch} resultCount={filteredMajors.length} />
        </div>
      )}
      {isLoading && allMajors.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : allMajors.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          رشته‌ای برای این دانشگاه ثبت نشده — دانشگاه دیگری را امتحان کنید یا در گیت‌هاب مشارکت کنید.
        </p>
      ) : filteredMajors.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">نتیجه‌ای یافت نشد.</p>
      ) : (
        <Virtuoso
          useWindowScroll
          data={visibleMajors}
          computeItemKey={(_, m) => `${m.uniSlug}:${m.slug}`}
          endReached={onLoadMore}
          itemContent={(_, m) => (
            <div className="pb-2.5">
              <OptionRow
                title={m.name?.fa ?? m.slug}
                selected={selectedSlug === m.slug}
                onClick={() => onSelect(m)}
                onDoubleClick={() => onDoubleClick(m)}
              />
            </div>
          )}
        />
      )}
      <NotFoundContribute label="رشته" />
    </div>
  )
}

export function DegreeStep({
  degrees,
  selected,
  onSelect,
  onDoubleClick,
}: {
  degrees: Array<{ slug: string; name?: { fa: string } }>
  selected?: string
  onSelect: (slug: string, name?: string) => void
  onDoubleClick: (slug: string, name?: string) => void
}) {
  return (
    <div className="space-y-2.5">
      {degrees.map((d) => (
        <OptionRow
          key={d.slug}
          title={d.name?.fa ?? d.slug}
          selected={selected === d.slug}
          onClick={() => onSelect(d.slug, d.name?.fa)}
          onDoubleClick={() => onDoubleClick(d.slug, d.name?.fa)}
        />
      ))}
      <NotFoundContribute label="مقطع" />
    </div>
  )
}

export function EntryYearStep({
  yearOptions,
  selected,
  onSelect,
  onDoubleClick,
  isLoading,
}: {
  yearOptions: Array<{ range: string; label: string }>
  selected?: string
  onSelect: (range: string) => void
  onDoubleClick: (range: string) => void
  isLoading: boolean
}) {
  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</p>
  if (yearOptions.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">چارتی برای این مقطع یافت نشد.</p>
  return (
    <div className="space-y-2.5">
      {yearOptions.map((y) => (
        <OptionRow
          key={y.range}
          title={y.label}
          selected={selected === y.range}
          onClick={() => onSelect(y.range)}
          onDoubleClick={() => onDoubleClick(y.range)}
        />
      ))}
      <NotFoundContribute label="سال ورود" />
    </div>
  )
}

export function SemesterStep({
  availableSemesters,
  selected,
  onSelect,
}: {
  availableSemesters: Array<"MEHR" | "BAHMAN" | "SUMMER">
  selected?: string
  onSelect: (v: "MEHR" | "BAHMAN" | "SUMMER") => void
}) {
  return (
    <OptionGrid
      columns={2}
      options={availableSemesters.map((s) => ({ value: s, label: SEMESTER_LABEL[s] }))}
      value={selected}
      onSelect={(v) => onSelect(v as "MEHR" | "BAHMAN" | "SUMMER")}
      onCommit={(v) => {
        onSelect(v as "MEHR" | "BAHMAN" | "SUMMER")
        setTimeout(() => {}, 0)
      }}
    />
  )
}

export function GenderStep({ selected, onSelect }: { selected?: string; onSelect: (v: "MALE" | "FEMALE") => void }) {
  return (
    <OptionGrid
      columns={2}
      options={[
        { value: "MALE", label: "پسر" },
        { value: "FEMALE", label: "دختر" },
      ]}
      value={selected}
      onSelect={(v) => onSelect(v as "MALE" | "FEMALE")}
      onCommit={(v) => onSelect(v as "MALE" | "FEMALE")}
    />
  )
}

export function TermStep({
  degree,
  selected,
  onSelect,
  onDoubleClick,
}: {
  degree?: { termCount?: number; maxTermCount?: number }
  selected?: number
  onSelect: (n: number) => void
  onDoubleClick?: (n: number) => void
}) {
  const degreeTermCount = degree?.termCount ?? 8
  const maxTerm = degree?.maxTermCount ?? 12
  const normal = Array.from({ length: degreeTermCount }, (_, i) => degreeTermCount - i)
  const extended = maxTerm > degreeTermCount ? Array.from({ length: maxTerm - degreeTermCount }, (_, i) => maxTerm - i) : []
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">ترم‌های اصلی (۱ تا {degreeTermCount})</p>
        <OptionGrid
          columns={4}
          options={normal.map((n) => ({ value: String(n), label: String(n) }))}
          value={selected !== undefined ? String(selected) : undefined}
          onSelect={(v) => onSelect(Number(v))}
          onDoubleClick={(v) => (onDoubleClick ?? onSelect)(Number(v))}
        />
      </div>
      {extended.length > 0 && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium text-amber-600 dark:text-amber-400">سنوات مجاز ({degreeTermCount + 1} تا {maxTerm})</p>
          <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(4, minmax(0,1fr))` }}>
            {extended.map((n) => {
              const sel = selected === n
              return (
                <button
                  key={n}
                  onClick={() => onSelect(n)}
                  onDoubleClick={() => (onDoubleClick ?? onSelect)(n)}
                  className={cn(
                    "rounded-full border bg-card px-4 py-2.5 text-center text-sm tabular-nums transition-colors",
                    sel ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 hover:border-amber-300 dark:border-amber-900/50"
                  )}
                >
                  {n}
                </button>
              )
            })}
          </div>
          <p className="px-1 text-[11px] leading-4 text-muted-foreground">
            کارشناسی پیوسته نهایت {degreeTermCount} ترمه؛ {degreeTermCount + 1} تا {maxTerm} سنوات محسوب می‌شود
          </p>
        </div>
      )}
    </div>
  )
}

export function CurrentSemesterStep({
  terms,
  selected,
  onSelect,
  onDoubleClick,
  isLoading,
}: {
  terms: Array<{ termCode: string; semester: string }>
  selected?: string
  onSelect: (v: string) => void
  onDoubleClick?: (v: string) => void
  isLoading: boolean
}) {
  if (isLoading) return <p className="py-10 text-center text-sm text-muted-foreground">در حال بارگذاری…</p>
  if (terms.length === 0)
    return <p className="py-10 text-center text-sm text-muted-foreground">نیم‌سالی برای این رشته یافت نشد — بعداً در تنظیمات می‌توانید انتخاب کنید.</p>
  return (
    <>
      <OptionGrid
        columns={2}
        options={terms
          .toSorted((a, b) => b.termCode.localeCompare(a.termCode))
          .map((t) => ({ value: t.termCode, label: `${t.termCode} ${SEMESTER_LABEL[t.semester as keyof typeof SEMESTER_LABEL]}` }))}
        value={selected}
        onSelect={onSelect}
        onDoubleClick={onDoubleClick ?? onSelect}
      />
      <div className="pt-2">
        <NotFoundContribute label="نیم‌سال" />
      </div>
    </>
  )
}

export function IsLastTermStep({ selected, onSelect }: { selected?: boolean; onSelect: (v: boolean) => void }) {
  return (
    <OptionGrid
      columns={2}
      options={[
        { value: "true", label: "بله" },
        { value: "false", label: "خیر" },
      ]}
      value={selected !== undefined ? String(selected) : undefined}
      onSelect={(v) => onSelect(v === "true")}
      onCommit={(v) => onSelect(v === "true")}
    />
  )
}
