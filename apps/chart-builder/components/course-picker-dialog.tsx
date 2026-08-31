"use client"

import * as React from "react"

import { Button } from "@workspace/ui/components/button"
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogDesktopOnly,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogPopup,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { SearchIcon } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

import { UnitsBadge } from "@/components/units-badge"
import { courseUnits, type ChartCourse } from "@/lib/chart"
import { toFaDigits } from "@/lib/jalali"

/** Normalizes for forgiving Persian search: homoglyphs, digits, spacing. */
function normalize(value: string): string {
  return value
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u064A/g, "\u06CC")
    .toLowerCase()
    .trim()
}

/** Multi-select course picker: sticky search on top, scrollable list with
    edge fades, primary-bordered selected rows, confirm footer. Candidates
    are already filtered by the caller. */
export function CoursePickerDialog({
  open,
  onOpenChange,
  title,
  description,
  courses,
  selectedNames,
  onSelectedChange,
  onConfirm,
  confirmLabel = "افزودن",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  courses: ChartCourse[]
  selectedNames: string[]
  onSelectedChange: (names: string[]) => void
  onConfirm: () => void
  confirmLabel?: string
}) {
  const [query, setQuery] = React.useState("")

  // Reset search whenever the dialog closes, regardless of how it was closed
  // (confirm button does setPickerTerm(null) directly, not via handleOpenChange).
  React.useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("")
    onOpenChange(next)
  }

  const normalized = normalize(query)
  const visible = normalized
    ? courses.filter((c) => normalize(c.name).includes(normalized))
    : courses

  const toggle = (name: string) =>
    onSelectedChange(
      selectedNames.includes(name)
        ? selectedNames.filter((n) => n !== name)
        : [...selectedNames, name]
    )

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogPopup className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
          {description && (
            <ResponsiveDialogDescription>
              {description}
            </ResponsiveDialogDescription>
          )}
        </ResponsiveDialogHeader>

        {/* Body has NO horizontal padding: the scroll area bleeds to the
            popup edges so the thumb rides the border; sections inside carry
            their own insets. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="px-4 sm:px-6">
            {/* Inner relative box so start-3 anchors to the input itself,
                not to the padded section wrapper. */}
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی درس…"
                className="h-9 w-full rounded-lg border border-border bg-card ps-9 pe-3 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
            </div>
          </div>

          {/* Scrollable list: full-bleed; min-w-0 on the content slot kills
              phantom x-overflow so only the vertical thumb shows. */}
          <ScrollArea className="h-72 border-y border-border/60 [&_[data-slot=scroll-area-content]]:min-w-0">
            {visible.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
                {query ? "درسی مطابق جستجو پیدا نشد." : "درسی موجود نیست."}
              </p>
            ) : (
              <div className="space-y-1 px-1.5 py-1 sm:px-2">
                {visible.map((course, idx) => {
                  const selected = selectedNames.includes(course.name)
                  // Use code+name+index as key — pool may contain same name with
                  // different codes (e.g. multiple “پایان نامه” sections) that
                  // collapse to the same ChartCourse name after poolToChartCourse.
                  const key = `${course.name}__${courseUnits(course)}__${idx}`
                  return (
                    <button
                      key={key}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => toggle(course.name)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-start transition-colors duration-150 ease-out",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-muted/50"
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-start gap-2">
                        {/* Badge leads, then the name with its code stacked
                            beneath. */}
                        <UnitsBadge units={courseUnits(course)} />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="max-w-[250px] truncate font-normal">
                            {course.name}
                          </span>
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <ResponsiveDialogFooter>
          {/* Cancel leads so RTL puts it on the right, primary last (left);
              cancel is desktop-only (mobile drawers dismiss by swipe /
              backdrop per the registry pattern). */}
          <ResponsiveDialogDesktopOnly>
            <ResponsiveDialogClose
              render={<Button variant="outline">انصراف</Button>}
            />
          </ResponsiveDialogDesktopOnly>
          <Button onClick={onConfirm}>
            {confirmLabel}
            {selectedNames.length > 0 &&
              ` (${toFaDigits(selectedNames.length)})`}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogPopup>
    </ResponsiveDialog>
  )
}
