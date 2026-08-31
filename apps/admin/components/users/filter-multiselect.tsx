"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"

export interface FilterOption {
  value: string
  label: string
}

export function FilterMultiSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "جستجو...",
  emptyText = "موردی یافت نشد",
}: {
  options: FilterOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder: string
  searchPlaceholder?: string
  emptyText?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    )
  }, [options, search])

  const toggle = (val: string) => {
    if (value.includes(val)) onChange(value.filter((v) => v !== val))
    else onChange([...value, val])
  }

  const labelFor = (val: string) =>
    options.find((o) => o.value === val)?.label ?? val

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="h-8 max-w-[260px] min-w-[160px] justify-between gap-2 px-3 text-sm font-normal"
          />
        }
      >
        <span className="truncate">
          {value.length === 0
            ? placeholder
            : value.length === 1
              ? labelFor(value[0]!)
              : `${value.length} انتخاب`}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2">
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <ScrollArea className="max-h-[260px]">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </p>
            ) : (
              filtered.map((opt) => {
                const selected = value.includes(opt.value)
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                      selected && "bg-accent/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      )}
                    >
                      {selected && <Check className="size-3" />}
                    </span>
                    <span className="flex-1 truncate text-right">
                      {opt.label}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </ScrollArea>
        {value.length > 0 && (
          <div className="flex items-center justify-between border-t p-2">
            <span className="text-xs text-muted-foreground">
              {value.length} انتخاب
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange([])}
            >
              پاک کردن
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
