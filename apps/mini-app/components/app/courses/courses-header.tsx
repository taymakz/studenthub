"use client"

import * as React from "react"
import { AnimatePresence, m } from "motion/react"
import type { ComponentType } from "react"
import { SearchIcon } from "lucide-react"
import { Filter3, Search3, SliderVertical2 } from "reicon-react"

import { Card } from "@workspace/ui/components/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { cn } from "@workspace/ui/lib/utils"
import { useIsRoutePreview } from "@/lib/route-preview-context"

function CellIcon({
  icon: Icon,
}: {
  icon: ComponentType<{ className?: string; weight?: "Filled" | "Outline" }>
}) {
  return <Icon weight="Outline" className="size-8 opacity-80" />
}

/**
 * Old courses hero, copied exactly: title on a faint grid, then three round
 * tool cells - an expandable search (layout spring), filter (count badge) and
 * view-mode. Icons are reicon (Outline) like the rest of the app.
 */
export function CoursesHeader({
  search,
  onSearchChange,
  filterCount,
  resultCount,
  onOpenFilter,
  onOpenViewMode,
}: {
  search: string
  onSearchChange: (v: string) => void
  filterCount: number
  resultCount: number
  onOpenFilter: () => void
  onOpenViewMode: () => void
}) {
  const isRoutePreview = useIsRoutePreview()
  const [expanded, setExpanded] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (expanded) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [expanded])

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false)
      }
    }
    if (expanded) document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [expanded])

  return (
    <div className="bg-grid-black/3 dark:bg-grid-white/5 relative flex h-80 flex-col items-center justify-center bg-neutral-100 safe-top-padding dark:bg-neutral-900">
      <h1 className="z-10 mb-6 font-semibold tracking-[0.35em] text-slate-800/60 uppercase dark:text-slate-200/60">
        Courses
      </h1>

      <div className="relative z-10 mx-auto grid max-w-80 grid-cols-3 gap-8">
        {/* Search — round cell that expands into a full input card */}
        <div className="z-20 flex flex-col items-center gap-2.5">
          <div className="size-16">
            <AnimatePresence mode="popLayout" initial={false}>
              {!expanded ? (
                <m.button
                  key="search-btn"
                  initial={false}
                  layoutId={isRoutePreview ? undefined : "courses-search"}
                  className="flex size-16 cursor-pointer items-center justify-center rounded-full bg-neutral-200 dark:bg-secondary/80"
                  onClick={() => setExpanded(true)}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                >
                  <m.span
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Search3
                      size={24}
                      className={cn(
                        "opacity-80",
                        search ? "text-primary" : "text-foreground"
                      )}
                    />
                  </m.span>
                </m.button>
              ) : (
                <m.div
                  key="search-input"
                  ref={containerRef}
                  layoutId={isRoutePreview ? undefined : "courses-search"}
                  className="absolute start-0 top-0 z-50 w-full"
                  transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                >
                  <Card className="gap-2.5 border bg-card p-2 shadow-xl">
                    <InputGroup>
                      <InputGroupInput
                        ref={inputRef}
                        value={search}
                        onChange={(e) => onSearchChange(e.currentTarget.value)}
                        placeholder="جستجو کنید ..."
                        dir="rtl"
                      />
                      <InputGroupAddon>
                        <SearchIcon />
                      </InputGroupAddon>
                      <InputGroupAddon align="inline-end">
                        {resultCount} نتیجه
                      </InputGroupAddon>
                    </InputGroup>
                    <p className="text-right text-sm text-muted-foreground">
                      بر اساس نام درس، استاد، کد و روز برگزاری
                    </p>
                  </Card>
                </m.div>
              )}
            </AnimatePresence>
          </div>
          <AnimatePresence initial={false}>
            {!expanded && (
              <m.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 0.8, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-sm font-medium opacity-80"
              >
                جستجو
              </m.p>
            )}
          </AnimatePresence>
        </div>

        <ViewCell
          title="فیلتر"
          count={filterCount}
          onClick={onOpenFilter}
          icon={Filter3}
        />
        <ViewCell
          title="حالت نمایش"
          onClick={onOpenViewMode}
          icon={SliderVertical2}
        />
      </div>
    </div>
  )
}

function ViewCell({
  title,
  count,
  onClick,
  icon,
}: {
  title: string
  count?: number
  onClick: () => void
  icon: ComponentType<{ className?: string; weight?: "Filled" | "Outline" }>
}) {
  return (
    <button
      type="button"
      className="flex cursor-pointer flex-col items-center gap-2.5"
      onClick={onClick}
    >
      <div className="relative flex size-16 items-center justify-center rounded-full bg-neutral-200 dark:bg-secondary/80">
        <CellIcon icon={icon} />
        {count !== undefined && count > 0 && (
          <span className="absolute top-0 -left-1 flex size-6 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
            {count}
          </span>
        )}
      </div>
      <p className="text-sm font-medium opacity-80">{title}</p>
    </button>
  )
}
