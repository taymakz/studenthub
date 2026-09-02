"use client"

import type { Offering, OfferingUpdated } from "@/lib/api"
import { OfferingCarousel } from "./offering-carousel"
import { ChangedCarousel } from "./changed-carousel"

export function TabContent({
  tab,
  added,
  updated,
  removed,
  setSelected,
  setSelectedChanges,
}: {
  tab: "new" | "changed" | "removed"
  added: Offering[]
  updated: OfferingUpdated[]
  removed: Offering[]
  setSelected: (o: Offering) => void
  setSelectedChanges: (c: OfferingUpdated["changes"]) => void
}) {
  if (tab === "new") return added.length === 0 ? <Empty text="درس جدیدی فعلا ثبت نشده" /> : <OfferingCarousel items={added} tone="added" onOpen={setSelected} />
  if (tab === "changed") return updated.length === 0 ? <Empty text="جزئیات درسی فعلا تغییر نکرده" /> : <ChangedCarousel items={updated} onOpen={(item) => { setSelected(item.after); setSelectedChanges(item.changes) }} />
  return removed.length === 0 ? <Empty text="درسی فعلا حذف نشده" /> : <OfferingCarousel items={removed} tone="removed" />
}

function Empty({ text }: { text: string }) {
  return <div className="mt-6 text-center text-sm text-muted-foreground">{text}</div>
}
