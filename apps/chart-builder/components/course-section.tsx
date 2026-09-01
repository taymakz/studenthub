"use client"

import * as React from "react"
import { PlusIcon, SearchIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { useChartStore } from "@/components/chart-store"
import { CoursePickerDialog } from "@/components/course-picker-dialog"
import { toastManager } from "@/components/toast"
import { UnitsBadge } from "@/components/units-badge"
import { Input } from "@workspace/ui/components/input"
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogDescription,
  ResponsiveDialogDesktopOnly,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogPopup,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import type { ChartCourse, RequisiteValue } from "@/lib/chart"
import { courseUnits, totalUnits } from "@/lib/chart"
import { poolToChartCourse } from "@/lib/pool"
import { toFaDigits } from "@/lib/jalali"

export type RequisiteKind = "prerequisites" | "corequisites"

const KIND_LABELS: Record<RequisiteKind, string> = {
  prerequisites: "پیش‌نیاز",
  corequisites: "همنیاز",
}

/** Forgiving Persian comparison for search: homoglyphs + ZWNJ + casing. */
function normalize(value: string): string {
  return value
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u064A/g, "\u06CC")
    .replace(/[\u200c\u200d\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim()
}

/** Requisite picker candidates: everything known (pool first), deduped by name. */
export function useRequisiteCandidates(): ChartCourse[] {
  const { pool, chart } = useChartStore()
  return React.useMemo(() => {
    const seen = new Map<string, ChartCourse>()
    for (const c of pool.courses) {
      if (!seen.has(c.name)) seen.set(c.name, poolToChartCourse(c))
    }
    for (const courses of Object.values(chart.terms)) {
      for (const c of courses) if (!seen.has(c.name)) seen.set(c.name, c)
    }
    for (const c of chart.moaref) {
      if (!seen.has(c.name)) seen.set(c.name, c)
    }
    return [...seen.values()]
  }, [pool.courses, chart.terms, chart.moaref])
}

/** A پیش‌نیاز/همنیاز cell: dashed add-button when empty, chips + edit
    otherwise. For پیش‌نیاز an empty value first asks whether the requirement
    is a COURSE (opens the picker) or a minimum UNIT count (number dialog);
    an existing unit threshold re-opens the number dialog directly. */
function RequisiteCell({
  courseName,
  kind,
  value,
  candidates,
  onApply,
}: {
  courseName: string
  kind: RequisiteKind
  /** پیش‌نیاز may be a unit threshold; همنیاز is always course names. */
  value: RequisiteValue
  candidates: ChartCourse[]
  onApply: (value: RequisiteValue) => void
}) {
  type OpenDialog = null | "choice" | "units" | "courses"
  const [openDialog, setOpenDialog] = React.useState<OpenDialog>(null)
  const [draft, setDraft] = React.useState<string[]>([])
  const [unitsDraft, setUnitsDraft] = React.useState("")

  const isUnits = kind === "prerequisites" && typeof value === "number"
  // همنیاز (and course-based پیش‌نیاز) work on plain name lists.
  const names = typeof value === "number" ? [] : value

  const openPicker = () => {
    setDraft([])
    setOpenDialog("courses")
  }

  const plusClick = () => {
    if (kind === "prerequisites" && typeof value === "number") {
      setUnitsDraft(String(value))
      setOpenDialog("units")
      return
    }
    if (kind === "prerequisites" && names.length === 0) {
      setOpenDialog("choice")
      return
    }
    openPicker()
  }

  const confirmUnits = () => {
    const units = Number.parseInt(unitsDraft, 10)
    if (!Number.isFinite(units) || units <= 0) return
    onApply(units)
    setOpenDialog(null)
  }

  // Single stable list in candidate order: applied + drafted rows highlight
  // IN PLACE instead of being excluded/reordered the moment they're picked.
  const pickable = candidates.filter((c) => c.name !== courseName)
  const selectedNames = [...names, ...draft]

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {isUnits && (
          <span className="group relative inline-flex">
            <Badge variant="warning" className="max-w-40">
              <span className="truncate">
                گذراندن {toFaDigits(value as number)} واحد
              </span>
            </Badge>
            {/* Hover overlay: destructive surface + dashed primary border,
                click removes the value instantly (no confirm). */}
            <button
              type="button"
              onClick={() => onApply([])}
              aria-label="حذف شرط واحد"
              title="حذف شرط واحد"
              className="absolute inset-0 z-10 hidden items-center justify-center rounded-full border border-dashed border-primary bg-destructive text-[11px] font-medium text-white group-hover:inline-flex group-focus-visible:inline-flex"
            >
              حذف
            </button>
          </span>
        )}
        {names.map((name) => (
          <span key={name} className="group relative inline-flex">
            <Badge
              variant={kind === "prerequisites" ? "destructive" : "info"}
              className="max-w-32"
            >
              <span className="truncate">{name}</span>
            </Badge>
            <button
              type="button"
              onClick={() => onApply(names.filter((n) => n !== name))}
              aria-label={`حذف ${name}`}
              title={`حذف ${name}`}
              className="absolute inset-0 z-10 hidden items-center justify-center rounded-full border border-dashed border-primary bg-destructive text-[11px] font-medium text-white group-hover:inline-flex group-focus-visible:inline-flex"
            >
              حذف
            </button>
          </span>
        ))}
        {!isUnits && (
          <button
            type="button"
            onClick={plusClick}
            aria-label={`${KIND_LABELS[kind]} برای ${courseName}`}
            title={KIND_LABELS[kind]}
            className="inline-flex size-6 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary focus-visible:outline-none"
          >
            <PlusIcon className="size-3.5" />
          </button>
        )}
      </div>

      {/* Step 1 (پیش‌نیاز only): course or unit count? */}
      <ResponsiveDialog
        open={openDialog === "choice"}
        onOpenChange={(open) => {
          if (!open) setOpenDialog(null)
        }}
      >
        <ResponsiveDialogPopup className="sm:max-w-xs">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>نوع پیش‌نیاز</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              این درس به چه پیش‌نیازی نیاز دارد؟
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <div className="flex flex-col gap-2 px-6 pb-6">
            <Button onClick={openPicker}>انتخاب درس</Button>
            <Button
              variant="outline"
              onClick={() => {
                setUnitsDraft("")
                setOpenDialog("units")
              }}
            >
              تعداد واحد
            </Button>
            <ResponsiveDialogDesktopOnly>
              <ResponsiveDialogClose
                render={<Button variant="ghost">انصراف</Button>}
              />
            </ResponsiveDialogDesktopOnly>
          </div>
        </ResponsiveDialogPopup>
      </ResponsiveDialog>

      {/* Unit-count variant: a single number input. */}
      <ResponsiveDialog
        open={openDialog === "units"}
        onOpenChange={(open) => {
          if (!open) setOpenDialog(null)
        }}
      >
        <ResponsiveDialogPopup className="sm:max-w-xs">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              حداقل واحد گذرانده‌شده
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              پیش‌نیاز این درس، گذراندن چند واحد است؟
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              confirmUnits()
            }}
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <div className="px-6">
              <Input
                dir="ltr"
                inputMode="numeric"
                value={unitsDraft}
                onChange={(e) =>
                  setUnitsDraft(e.target.value.replace(/\D/g, ""))
                }
                placeholder="مثلاً 100"
                autoFocus
              />
            </div>
            <ResponsiveDialogFooter>
              <ResponsiveDialogDesktopOnly>
                <ResponsiveDialogClose
                  render={<Button variant="outline">انصراف</Button>}
                />
              </ResponsiveDialogDesktopOnly>
              <Button type="submit" disabled={!unitsDraft}>
                ثبت
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogPopup>
      </ResponsiveDialog>

      <CoursePickerDialog
        open={openDialog === "courses"}
        onOpenChange={(next) => {
          if (!next) setOpenDialog(null)
        }}
        title={`${KIND_LABELS[kind]}: ${courseName}`}
        description="درس‌های انتخاب‌شده به این درس اختصاص می‌یابند."
        courses={pickable}
        selectedNames={selectedNames}
        onSelectedChange={(next) => {
          // Keep previously-applied values fixed; toggle only new picks.
          const applied = new Set(names)
          setDraft(next.filter((n) => !applied.has(n)))
        }}
        onConfirm={() => {
          onApply([...names, ...draft])
          setOpenDialog(null)
        }}
        confirmLabel="ثبت"
      />
    </>
  )
}

/** One course-group card: header (title / action / bulk delete / count),
    optional search, and a fixed-layout table identical to the moaref one.
    Used by both the term rows (searchless) and معارف/نامشخص globals. */
export function CourseSection({
  title,
  courses,
  emptyLabel,
  headerAction,
  searchable = false,
  showRequisites = false,
  candidates = [],
  onRemove,
  onRemoveMany,
  onSetRequisites,
}: {
  title: string
  courses: ChartCourse[]
  emptyLabel: string
  headerAction?: React.ReactNode
  /** Shows the multi-word search input above the table. */
  searchable?: boolean
  showRequisites?: boolean
  candidates?: ChartCourse[]
  onRemove: (index: number) => void
  onRemoveMany: (names: string[]) => void
  onSetRequisites?: (
    index: number,
    kind: RequisiteKind,
    value: RequisiteValue
  ) => void
}) {
  const [selected, setSelected] = React.useState<string[]>([])
  const [query, setQuery] = React.useState("")

  // Every whitespace-separated word must appear in name (order-independent, prefix-friendly).
  const filtered = React.useMemo(() => {
    if (!searchable) return courses
    const words = normalize(query).split(/\s+/).filter(Boolean)
    if (words.length === 0) return courses
    return courses.filter((c) => {
      const hay = normalize(c.name)
      const hayWords = hay.split(/\s+/)
      return words.every((w) => hayWords.some((hw) => hw.startsWith(w)))
    })
  }, [courses, query, searchable])

  const visibleSelected = filtered.filter((c) =>
    selected.includes(c.name)
  ).length
  const allSelected = filtered.length > 0 && visibleSelected === filtered.length
  const someSelected = visibleSelected > 0 && !allSelected
  const unitsTotal = totalUnits(courses)

  const removeSelected = () => {
    if (selected.length === 0) return
    onRemoveMany(selected)
    toastManager.add({
      type: "success",
      title: `${toFaDigits(selected.length)} درس حذف شد`,
    })
    setSelected([])
  }

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? filtered.map((c) => c.name) : [])

  return (
    // Section card sits on a bg-background wrapper; secondary surface keeps
    // it distinct without painting its own border/ring.
    <Card className="rounded-xl bg-secondary shadow-none ring-0">
      <CardHeader>
        <CardTitle>
          {title}
          <span className="ms-2 text-sm font-normal text-muted-foreground">
            ({toFaDigits(unitsTotal)} واحد)
          </span>
        </CardTitle>
        <CardAction className="flex items-center gap-2">
          {headerAction}
          {selected.length > 0 && (
            <Button variant="destructive" size="sm" onClick={removeSelected}>
              حذف ({toFaDigits(selected.length)})
            </Button>
          )}
          <Badge variant="secondary" className="tabular-nums">
            {toFaDigits(courses.length)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          // Fit-height empty card instead of a tall skeleton table.
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 py-6">
            <span className="text-sm text-muted-foreground">{emptyLabel}</span>
          </div>
        ) : (
          <>
            {/* Search */}
            {searchable && (
              <div className="relative mb-3">
                <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`جستجو در ${title}…`}
                  className="h-9 w-full rounded-lg border border-border bg-card ps-9 pe-3 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring"
                />
              </div>
            )}

            {/* table-fixed + colgroup px widths: columns are EXACTLY this wide
            (fixed layout ignores th min-width, but obeys <col>), so long
            names can never reflow or crush other columns. */}
            <div className="-mx-1 overflow-x-auto px-1">
              <Table
                variant="card"
                className={cn(
                  "w-full table-fixed",
                  showRequisites ? "min-w-[660px]" : "min-w-[410px]"
                )}
              >
                <colgroup>
                  <col className="w-[300px]" />
                  <col className="w-[56px]" />
                  {showRequisites && (
                    <>
                      <col className="w-[170px]" />
                      <col className="w-[170px]" />
                    </>
                  )}
                  <col className="w-[44px]" />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          onCheckedChange={(checked) =>
                            toggleAll(checked === true)
                          }
                          aria-label={`انتخاب همه ${title}`}
                          disabled={filtered.length === 0}
                        />
                        <span>درس</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      واحد
                    </TableHead>
                    {showRequisites && (
                      <>
                        <TableHead className="text-muted-foreground">
                          همنیاز
                        </TableHead>
                        <TableHead className="text-muted-foreground">
                          پیش‌نیاز
                        </TableHead>
                      </>
                    )}
                    <TableHead className="w-10 text-end">
                      <span className="sr-only">عملیات</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    // Only reachable when courses exist but the search matched none.
                    <TableRow>
                      <TableCell
                        colSpan={showRequisites ? 5 : 3}
                        className="h-32 text-center"
                      >
                        <span className="text-sm text-muted-foreground">
                          درسی مطابق جستجو پیدا نشد.
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((course) => {
                      const index = courses.indexOf(course)
                      return (
                        <TableRow
                          key={`${course.name}-${index}`}
                          data-state={
                            selected.includes(course.name)
                              ? "selected"
                              : undefined
                          }
                        >
                          <TableCell>
                            <div className="flex min-w-0 items-start gap-3">
                              <Checkbox
                                className="mt-0.5 shrink-0"
                                checked={selected.includes(course.name)}
                                onCheckedChange={(checked) =>
                                  setSelected((current) =>
                                    checked
                                      ? [...current, course.name]
                                      : current.filter((n) => n !== course.name)
                                  )
                                }
                                aria-label={`انتخاب ${course.name}`}
                              />
                              <div className="flex min-w-0 flex-col gap-1">
                                <span className="truncate font-normal">
                                  {course.name}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <UnitsBadge units={courseUnits(course)} />
                          </TableCell>
                          {showRequisites && onSetRequisites && (
                            <>
                              <TableCell>
                                <RequisiteCell
                                  courseName={course.name}
                                  kind="corequisites"
                                  value={course.corequisites}
                                  candidates={candidates}
                                  onApply={(v) =>
                                    onSetRequisites(index, "corequisites", v)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <RequisiteCell
                                  courseName={course.name}
                                  kind="prerequisites"
                                  value={course.prerequisites}
                                  candidates={candidates}
                                  onApply={(v) =>
                                    onSetRequisites(index, "prerequisites", v)
                                  }
                                />
                              </TableCell>
                            </>
                          )}
                          <TableCell className="text-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`حذف ${course.name}`}
                              onClick={() => onRemove(index)}
                            >
                              <Trash2Icon />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
