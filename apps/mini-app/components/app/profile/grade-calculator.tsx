"use client"

import { useState } from "react"

import {
  Drawer,
  DrawerPopup,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
  DrawerFooter,
} from "@workspace/ui/components/drawer"
import { Input } from "@workspace/ui/components/input"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { Plus, Trash2 } from "lucide-react"

import { ToolButton } from "./tool-card"
import { CalculatorGradeIcon } from "./tool-icons"
import { useNotedOfferings } from "./use-noted-offerings"
import { GptDrawer, loadGpt, saveGpt } from "./gpt-drawer"
import type { Offering } from "@/lib/api"

interface Row {
  id: number
  name: string
  unit: string
  grade: string
}

type Gpt = 10 | 12 | 20

const ROWS_KEY = "user-grade-calculator-rows"

function toEn(str: string): string {
  const map: Record<string, string> = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  }
  return str.replace(/[۰-۹]/g, (c) => map[c] ?? c)
}

const validGrade = (unit: string, grade: string): boolean => {
  const u = Number(toEn(unit))
  const g = Number(toEn(grade))
  if (!Number.isFinite(u) || !Number.isFinite(g) || u <= 0) return false
  return u === 1 ? g >= 12 : g >= 10
}

function loadRows(): Row[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(ROWS_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : []
  } catch {
    return []
  }
}

/** Average + allowed-units + tone derived from the valid rows. Module-scope:
    keeps the ternary chains out of the React component. */
function computeAverageStats(rows: Row[]) {
  const validRows = rows.filter((r) => validGrade(r.unit, r.grade))
  const totalUnits = validRows.reduce(
    (s, r) => s + Number(toEn(r.unit) || 0),
    0
  )
  const weighted = validRows.reduce(
    (s, r) => s + Number(toEn(r.unit) || 0) * Number(toEn(r.grade) || 0),
    0
  )
  const average =
    totalUnits <= 0 ? 0 : Number.parseFloat((weighted / totalUnits).toFixed(2))
  const availableUnit =
    average === 0 ? 0 : average < 12 ? 14 : average < 17 ? 20 : average <= 20 ? 24 : 0
  const avgTone = average === 0
    ? ""
    : average < 12
      ? "text-warning border-warning/20 bg-warning/5"
      : average < 17
        ? "text-blue-500 border-blue-500/20 bg-blue-500/5"
        : "text-success border-success/20 bg-success/5"
  return { average, availableUnit, avgTone }
}

/** Merge noted offerings into the calculator rows (update units or append). */
function mergeNotedIntoRows(rows: Row[], notedOfferings: Offering[]): Row[] {
  const base = rows.filter((r) => r.name.trim() !== "" || r.unit || r.grade)
  const next = [...base]
  for (const o of notedOfferings) {
    const units = (o.theoreticalUnits ?? 0) + (o.practicalUnits ?? 0)
    const existing = next.find((r) => r.name === o.courseName)
    if (existing) {
      existing.unit = String(units)
    } else {
      next.push({
        id: Date.now() + next.length,
        name: o.courseName,
        unit: String(units),
        grade: "",
      })
    }
  }
  return next
}

export function GradeCalculator() {
  const [open, setOpen] = useState(false)
  const [gptOpen, setGptOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>(loadRows)
  const [gpt, setGpt] = useState<Gpt | null>(() => loadGpt())
  const { notedOfferings } = useNotedOfferings()

  const persistRows = (next: Row[]) => {
    setRows(next)
    try {
      localStorage.setItem(ROWS_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
  }

  const setGptPersist = (next: Gpt | null) => {
    setGpt(next)
    saveGpt(next)
  }

  const { average, availableUnit, avgTone } = computeAverageStats(rows)

  const addRow = () =>
    persistRows([...rows, { id: Date.now(), name: "", unit: "", grade: "" }])
  const removeRow = (id: number) => persistRows(rows.filter((r) => r.id !== id))
  const clearRows = () =>
    persistRows([{ id: 1, name: "", unit: "", grade: "" }])
  const updateRow = (
    id: number,
    field: "name" | "unit" | "grade",
    value: string
  ) =>
    persistRows(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)))

  const addAllInNotedList = () => {
    persistRows(mergeNotedIntoRows(rows, notedOfferings))
    setActionsOpen(false)
  }

  const submitGpt = () => {
    setGptPersist(average < 12 ? 10 : average < 17 ? 12 : 20)
    setActionsOpen(false)
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={<ToolButton title="معدل" icon={CalculatorGradeIcon} />}
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>محاسبه و ثبت معدل نیم‌سال</DrawerTitle>
          <DrawerDescription>
            برای کارایی بهتر اپلیکیشن می‌توانید معدل خود را این‌جا محاسبه و ثبت
            کنید
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-4 p-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setGptOpen(true)}
          >
            <CalculatorGradeIcon className="size-4" />
            ثبت معدل نیم‌سال
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <div
              className={cn(
                "flex h-11 items-center justify-center rounded-md border bg-card px-3 text-sm",
                avgTone
              )}
            >
              معدل: {average.toFixed(average % 1 !== 0 ? 2 : 0)}
            </div>
            <div
              className={cn(
                "flex h-11 items-center justify-center rounded-md border bg-card px-3 text-sm",
                avgTone
              )}
            >
              واحد مجاز: {availableUnit}
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => setActionsOpen(true)}
          >
            عملیات
          </Button>

          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex gap-2 rounded-md border bg-card p-2"
              >
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(row.id, "name", e.target.value)}
                    placeholder="نام درس"
                    className="col-span-2"
                  />
                  <Input
                    value={row.unit}
                    onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                    placeholder="واحد"
                    inputMode="decimal"
                  />
                  <Input
                    value={row.grade}
                    onChange={(e) => updateRow(row.id, "grade", e.target.value)}
                    placeholder="نمره"
                    inputMode="decimal"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => removeRow(row.id)}
                  aria-label="حذف ردیف"
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        </DrawerPanel>
        <DrawerFooter>
          <Button variant="outline" className="w-full" onClick={addRow}>
            <Plus /> افزودن ردیف
          </Button>
        </DrawerFooter>

        {/* Nested: ثبت معدل نیم‌سال (مشروط / متوسط / الف) */}
        <GptDrawer
          open={gptOpen}
          onOpenChange={(o) => {
            setGptOpen(o)
            if (!o) setGpt(loadGpt())
          }}
        />

        {/* Nested: عملیات */}
        <Drawer open={actionsOpen} onOpenChange={setActionsOpen}>
          <DrawerPopup variant="inset" showBar>
            <DrawerHeader>
              <DrawerTitle>عملیات</DrawerTitle>
            </DrawerHeader>
            <DrawerPanel className="space-y-2 p-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={addAllInNotedList}
              >
                افزودن دروس یادداشت شده
              </Button>
              <Button variant="outline" className="w-full" onClick={clearRows}>
                پاک کردن همه
              </Button>
              <Button className="w-full" onClick={submitGpt}>
                ثبت معدل
              </Button>
            </DrawerPanel>
          </DrawerPopup>
        </Drawer>
      </DrawerPopup>
    </Drawer>
  )
}
