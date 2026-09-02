"use client"

import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Plus, Replace, Trash2 } from "lucide-react"

type Tab = "new" | "changed" | "removed"

export function ChangesTabs({
  tab,
  setTab,
  addedLen,
  updatedLen,
  removedLen,
}: {
  tab: Tab
  setTab: (v: Tab) => void
  addedLen: number
  updatedLen: number
  removedLen: number
}) {
  const valueStyles: Record<string, { indicator: string; trigger: string }> = {
    new: { indicator: "bg-success/10", trigger: "data-[active]:text-success" },
    changed: { indicator: "bg-info/10", trigger: "data-[active]:text-info" },
    removed: { indicator: "bg-destructive/10", trigger: "data-[active]:text-destructive" },
  }
  const tabs: Array<{ key: Tab; label: string; count: number; Icon: typeof Plus }> = [
    { key: "new", label: "جدید", count: addedLen, Icon: Plus },
    { key: "changed", label: "تغییر جزئیات", count: updatedLen, Icon: Replace },
    { key: "removed", label: "حذف", count: removedLen, Icon: Trash2 },
  ]
  return (
    <Tabs defaultValue="new" value={tab} onValueChange={(v) => setTab(v as Tab)} valueStyles={valueStyles}>
      <TabsList className="grid w-full grid-cols-3 gap-1 text-sm">
        {tabs.map(({ key, label, count, Icon }) => (
          <TabsTrigger key={key} value={key} className="gap-1.5">
            <Icon className="size-3.5" />
            {label} {count}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
