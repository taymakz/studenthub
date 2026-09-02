"use client"

import { useState } from "react"
import { X } from "lucide-react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
  DrawerFooter,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { Card } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Switch } from "@workspace/ui/components/switch"
import { Badge } from "@workspace/ui/components/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { cn } from "@workspace/ui/lib/utils"

export interface CoursesFilters {
  professors: string[]
  onlyMoaref: boolean
  ignoreMoaref: boolean
  showPassed: boolean
  onlyCanTake: boolean
  units: string[]
  chartTerms: number[]
  days: string[]
}

const DAYS = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه شنبه",
  "چهارشنبه",
  "پنج شنبه",
  "جمعه",
] as const

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 cursor-pointer items-center justify-center rounded-md border px-3 font-medium transition-all duration-300",
        active && "bg-primary text-primary-foreground"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function SwitchCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Card
      className="flex flex-col gap-1 p-4 text-sm"
      onClick={() => onChange(!checked)}
    >
      <div className="flex flex-row items-center justify-between">
        <p className="font-medium">{label}</p>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </Card>
  )
}

export function FilterDrawer({
  open,
  onOpenChange,
  filters,
  onChange,
  options,
  resultLength,
  isChartComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: CoursesFilters
  onChange: (next: CoursesFilters) => void
  options: { professors: string[]; units: string[]; chartTerms: number[] }
  resultLength: number
  isChartComplete?: boolean
}) {
  const [searchProfessor, setSearchProfessor] = useState("")
  const [professorsOpen, setProfessorsOpen] = useState(
    () => filters.professors.length > 0
  )
  const set = (patch: Partial<CoursesFilters>) =>
    onChange({ ...filters, ...patch })
  const toggle = <T extends string | number>(
    key: "professors" | "units" | "chartTerms" | "days",
    v: T
  ) =>
    set({
      [key]: (filters[key] as unknown as T[]).includes(v)
        ? (filters[key] as unknown as T[]).filter((x) => x !== v)
        : [...(filters[key] as unknown as T[]), v],
    } as Partial<CoursesFilters>)

  const active =
    filters.professors.length > 0 ||
    filters.onlyMoaref ||
    filters.ignoreMoaref ||
    filters.showPassed ||
    filters.onlyCanTake ||
    filters.units.length > 0 ||
    filters.chartTerms.length > 0 ||
    filters.days.length > 0
  const clear = () =>
    onChange({
      professors: [],
      onlyMoaref: false,
      ignoreMoaref: false,
      showPassed: false,
      onlyCanTake: false,
      units: [],
      chartTerms: [],
      days: [],
    })

  const searchedProfessors = options.professors.filter((p) =>
    searchProfessor
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .every((w) => p.toLowerCase().includes(w))
  )

  const units = options.units.length ? options.units : ["1", "2", "3", "4", "6"]

  // Constant-time lookups inside the loops below.
  const selectedProfessors = new Set(filters.professors)
  const selectedUnits = new Set(filters.units)
  const selectedChartTerms = new Set(filters.chartTerms)
  const selectedDays = new Set(filters.days)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle className="mb-2">فیلتر</DrawerTitle>
          <DrawerDescription>{resultLength} نتیجه</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-4 p-4">
          {/* Professors — accordion with scroll-area + fade */}
          <Card className="p-0">
            <Accordion
              multiple
              value={professorsOpen ? ["professors"] : []}
              onValueChange={(v) =>
                setProfessorsOpen(Array.isArray(v) && v.includes("professors"))
              }
            >
              <AccordionItem value="professors">
                <AccordionTrigger className="p-4 text-sm">
                  بر اساس استاد
                </AccordionTrigger>
                <AccordionContent className="px-2 pt-2">
                  <ScrollArea className="max-h-[315px]">
                    <div className="px-2 pr-2 pb-2">
                      <Input
                        value={searchProfessor}
                        onChange={(e) => setSearchProfessor(e.target.value)}
                        className="mb-4 h-10 text-sm"
                        placeholder="جستجو کنید..."
                      />
                      {filters.professors.length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2">
                          {filters.professors.map((item) => (
                            <Badge
                              key={item}
                              variant="outline"
                              className="cursor-pointer gap-1 py-1"
                              onClick={() => toggle("professors", item)}
                            >
                              {item || "بدون نام"}
                              <X className="size-4" />
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        {searchedProfessors.map((item) => (
                          <button
                            type="button"
                            key={item}
                            className={cn(
                              "w-full cursor-pointer rounded-md border px-3 py-2 text-start text-sm transition-all duration-300",
                              selectedProfessors.has(item) &&
                                "bg-primary text-primary-foreground"
                            )}
                            onClick={() => toggle("professors", item)}
                          >
                            {item || "بدون نام"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>

          {/* Units */}
          <Card className="p-4">
            <p className="mb-4 text-sm">بر اساس تعداد واحد</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {units.map((v) => (
                <Chip
                  key={v}
                  active={selectedUnits.has(v)}
                  onClick={() => toggle("units", v)}
                >
                  {v}
                </Chip>
              ))}
            </div>
          </Card>

          {/* Chart terms */}
          {options.chartTerms.length > 0 && (
            <Card className="p-4">
              <p className="mb-4 text-sm">بر اساس دروس چارت (ترم)</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {options.chartTerms.map((t) => (
                  <Chip
                    key={t}
                    active={selectedChartTerms.has(t)}
                    onClick={() => toggle("chartTerms", t)}
                  >
                    {t}
                  </Chip>
                ))}
              </div>
            </Card>
          )}

          {/* Days */}
          <Card className="p-4">
            <p className="mb-4 text-sm">بر اساس روز برگزاری</p>
            <div className="flex flex-wrap gap-2 text-sm">
              {DAYS.map((d) => (
                <Chip
                  key={d}
                  active={selectedDays.has(d)}
                  onClick={() => toggle("days", d)}
                >
                  {d}
                </Chip>
              ))}
            </div>
          </Card>

          <SwitchCard
            label="فقط دروس معارف"
            checked={filters.onlyMoaref}
            onChange={(v) =>
              set({
                onlyMoaref: v,
                ignoreMoaref: v ? false : filters.ignoreMoaref,
              })
            }
          />
          <SwitchCard
            label="دروس معارف رو نشون نده"
            checked={filters.ignoreMoaref}
            onChange={(v) =>
              set({
                ignoreMoaref: v,
                onlyMoaref: v ? false : filters.onlyMoaref,
              })
            }
          />
          <SwitchCard
            label="دروس پاس شده هم نشون بده"
            checked={filters.showPassed}
            onChange={(v) => set({ showPassed: v })}
          />
          {isChartComplete && (
            <SwitchCard
              label="فقط دروس قابل اخذ"
              description="فقط دروسی که پیش‌نیاز و هم‌نیازشان رعایت شده"
              checked={filters.onlyCanTake}
              onChange={(v) => set({ onlyCanTake: v })}
            />
          )}
        </DrawerPanel>
        <DrawerFooter>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              نمایش {resultLength} نتیجه
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              disabled={!active}
              onClick={clear}
            >
              پاک کردن
            </Button>
          </div>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  )
}
