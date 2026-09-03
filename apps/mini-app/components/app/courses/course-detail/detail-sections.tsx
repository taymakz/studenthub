"use client"

import { useState } from "react"

import { Badge } from "@workspace/ui/components/badge"
import { ChevronDown } from "lucide-react"

import type { Offering, OfferingChangedField } from "@/lib/api"
import { RequisiteOfferingsDrawer } from "./prereq-drawer"

function Divider({ label }: { label: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <div className="h-px w-fit grow rounded-full bg-border" />
      <div className="text-center text-sm text-muted-foreground">{label}</div>
      <div className="h-px w-fit grow rounded-full bg-border" />
    </div>
  )
}

export function PrereqSection({
  chart,
  chartCourse,
  passedNames,
  failedNames,
  passedUnits,
  onSelectCourse,
}: {
  chart: { isCompleted?: boolean } | null
  chartCourse: unknown
  passedNames: Set<string>
  failedNames: Set<string>
  passedUnits: number
  onSelectCourse?: (offering: Offering) => void
}) {
  const [offeringsFor, setOfferingsFor] = useState<string | null>(null)
  if (!chart?.isCompleted || !chartCourse) return null
  const prereqs = (chartCourse as { prerequisites?: string[] | number })?.prerequisites
  const isUnits = typeof prereqs === "number"
  const list = Array.isArray(prereqs) ? prereqs : []
  if (!isUnits && list.length === 0) return null
  return (
    <div className="space-y-2">
      <Divider label="پیش‌نیاز" />
      {isUnits ? (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={passedUnits >= (prereqs as number) ? "success" : "destructive"} className="px-2 py-1 text-xs">
            حداقل {prereqs as number} واحد
          </Badge>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((name) => {
            const isPassed = passedNames.has(name as string)
            const isFailed = failedNames.has(name as string)
            return (
              <button
                key={name as string}
                type="button"
                onClick={() => setOfferingsFor(name as string)}
                className="cursor-pointer transition-transform active:scale-95"
                aria-label={`مشاهده کلاس‌های ${name as string}`}
              >
                <Badge
                  variant={isPassed ? "success" : isFailed ? "warning" : "destructive"}
                  className="px-2 py-1 text-xs"
                >
                  {name as string}
                </Badge>
              </button>
            )
          })}
        </div>
      )}
      <RequisiteOfferingsDrawer
        courseName={offeringsFor}
        open={offeringsFor !== null}
        onOpenChange={(o) => !o && setOfferingsFor(null)}
        onSelectCourse={(c) => {
          if (onSelectCourse) onSelectCourse(c)
        }}
      />
    </div>
  )
}

export function CoreqSection({
  chart,
  chartCourse,
  passedNames,
  onSelectCourse,
}: {
  chart: { isCompleted?: boolean } | null
  chartCourse: unknown
  passedNames: Set<string>
  onSelectCourse?: (offering: Offering) => void
}) {
  const [offeringsFor, setOfferingsFor] = useState<string | null>(null)
  if (!chart?.isCompleted || !chartCourse) return null
  const coreqs = (chartCourse as { corequisites?: string[] })?.corequisites
  if (!coreqs || coreqs.length === 0) return null
  return (
    <div className="space-y-2">
      <Divider label="همنیاز" />
      <div className="flex flex-wrap gap-1.5">
        {coreqs.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setOfferingsFor(name)}
            className="cursor-pointer transition-transform active:scale-95"
            aria-label={`مشاهده کلاس‌های ${name}`}
          >
            <Badge variant={passedNames.has(name) ? "success" : "warning"} className="px-2 py-1 text-xs">
              {name}
            </Badge>
          </button>
        ))}
      </div>
      <RequisiteOfferingsDrawer
        courseName={offeringsFor}
        open={offeringsFor !== null}
        onOpenChange={(o) => !o && setOfferingsFor(null)}
        onSelectCourse={(c) => {
          if (onSelectCourse) onSelectCourse(c)
        }}
      />
    </div>
  )
}

export function ChangesSection({ changes }: { changes?: OfferingChangedField[] }) {
  if (!changes || changes.length === 0) return null
  return (
    <div className="space-y-2">
      <Divider label="تغییرات" />
      <div className="space-y-2 text-sm">
        {changes.map((ch) => (
          <div key={ch.field} className="rounded-md bg-info/5 px-3 py-2">
            <p className="mb-1.5 text-xs text-muted-foreground">{ch.label}</p>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-destructive/70 line-through">{ch.before ?? "-"}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{ch.after ?? "-"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
