"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { Card } from "@workspace/ui/components/card"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel"
import { cn } from "@workspace/ui/lib/utils"

import type { Offering, OfferingChangedField, OfferingUpdated } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { useTimeAgo } from "@/hooks/use-time-ago"
import { CourseChangesSkeleton } from "./section-skeleton"
import { CourseDetailDrawer } from "@/components/app/courses/course-detail-drawer"
import { ProfessorDrawer } from "@/components/app/courses/professor-drawer"
import { useCourseChangesData } from "./course-changes/use-course-changes"
import { ChangesTabs } from "./course-changes/course-changes-tabs"

type Tab = "new" | "changed" | "removed"

export function CourseChanges() {
  const { complete, isLoading, termCode, added, removed, updated, changes, detail } = useCourseChangesData()
  const noted = useProfileStore((s) => s.noted)
  const passed = useProfileStore((s) => s.passed)
  const profile = useProfileStore((s) => s.profile)
  const [tab, setTab] = useState<Tab>("new")
  const [selected, setSelected] = useState<Offering | null>(null)
  const [selectedChanges, setSelectedChanges] = useState<OfferingChangedField[]>([])
  const [professor, setProfessor] = useState<{ name: string; uni: string; major: string } | null>(null)

  const isNoted = (o: Offering) => noted.some((n) => !n.isDeleted && n.courseIndex === o.index)

  const lastUpdated = useTimeAgo(changes?.scrapedAt ? Date.parse(changes.scrapedAt) : null)

  if (!complete) return null
  if (isLoading) return <CourseChangesSkeleton />
  if (!termCode) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        نیم‌سالی برای نمایش تغییرات انتخاب نشده است
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex h-5 items-center justify-between text-sm text-muted-foreground">
        <p>لیست تغییرات دروس</p>
        <p>آخرین بروزرسانی {lastUpdated}</p>
      </div>

      <ChangesTabs tab={tab} setTab={setTab} addedLen={added.length} updatedLen={updated.length} removedLen={removed.length} />

      <div className="min-h-30">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.1 }}>
            <TabContent tab={tab} added={added} updated={updated} removed={removed} setSelected={setSelected} setSelectedChanges={setSelectedChanges} />
          </motion.div>
        </AnimatePresence>
      </div>

      <CourseDetailDrawer
        offering={selected}
        isNoted={selected ? isNoted(selected) : false}
        isPassed={selected ? passed.some((p) => p.courseName === selected.courseName) : false}
        isNew={selected ? new Set((detail?.added ?? []).map((o) => o.index)).has(selected.index) : false}
        changes={selectedChanges.length > 0 ? selectedChanges : undefined}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onToggleNote={(index) => useProfileStore.getState().toggleNote(index)}
        onTogglePassed={(name) => useProfileStore.getState().togglePassed(name)}
        onOpenProfessor={(name) => setProfessor({ name, uni: profile?.universitySlug ?? "", major: profile?.majorSlug ?? "" })}
        onSelectCourse={(course) => setSelected(course)}
      />
      <ProfessorDrawer
        open={!!professor}
        onOpenChange={(o) => !o && setProfessor(null)}
        professorName={professor?.name ?? ""}
        uni={professor?.uni ?? ""}
        major={professor?.major ?? ""}
        currentCourseIndex={selected?.index ?? null}
        onCourseSelected={(course) => { setProfessor(null); setSelected(course) }}
      />
    </div>
  )
}

function TabContent({
  tab,
  added,
  updated,
  removed,
  setSelected,
  setSelectedChanges,
}: {
  tab: Tab
  added: import("@/lib/api").Offering[]
  updated: import("@/lib/api").OfferingUpdated[]
  removed: import("@/lib/api").Offering[]
  setSelected: (o: import("@/lib/api").Offering) => void
  setSelectedChanges: (c: import("@/lib/api").OfferingChangedField[]) => void
}) {
  if (tab === "new") return added.length === 0 ? <Empty text="درس جدیدی فعلا ثبت نشده" /> : <OfferingCarousel items={added} tone="added" onOpen={setSelected} />
  if (tab === "changed") return updated.length === 0 ? <Empty text="جزئیات درسی فعلا تغییر نکرده" /> : <ChangedCarousel items={updated} onOpen={(item) => { setSelected(item.after); setSelectedChanges(item.changes) }} />
  return removed.length === 0 ? <Empty text="درسی فعلا حذف نشده" /> : <OfferingCarousel items={removed} tone="removed" />
}

function Empty({ text }: { text: string }) {
  return <div className="mt-6 text-center text-sm text-muted-foreground">{text}</div>
}

export function OfferingCarousel({
  items,
  tone,
  onOpen,
}: {
  items: Offering[]
  tone: "added" | "removed"
  onOpen?: (o: Offering) => void
}) {
  const single = items.length === 1
  return (
    <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
      <CarouselContent className="ms-0">
        {items.map((o) => (
          <CarouselItem
            key={o.index}
            className={cn("px-2 py-2", single ? "basis-full" : "basis-[91%]")}
          >
            <SimpleCard offering={o} tone={tone} onOpen={onOpen} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden" />
      <CarouselNext className="hidden" />
    </Carousel>
  )
}

export function ChangedCarousel({
  items,
  onOpen,
}: {
  items: OfferingUpdated[]
  onOpen?: (item: OfferingUpdated) => void
}) {
  const single = items.length === 1
  return (
    <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
      <CarouselContent className="ms-0">
        {items.map((item) => (
          <CarouselItem
            key={item.after.index}
            className={cn("px-2 py-2", single ? "basis-full" : "basis-[91%]")}
          >
            <ChangedCard item={item} onOpen={() => onOpen?.(item)} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden" />
      <CarouselNext className="hidden" />
    </Carousel>
  )
}

function SimpleCard({
  offering,
  tone,
  onOpen,
}: {
  offering: Offering
  tone: "added" | "removed"
  onOpen?: (o: Offering) => void
}) {
  return (
    <Card
      className={cn(
        "min-h-20 gap-1 p-3",
        tone === "added" && "ring-success/40",
        tone === "removed" && "border-destructive/30 ring-destructive/40",
        onOpen && "cursor-pointer"
      )}
      onClick={onOpen ? () => onOpen(offering) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{offering.courseName}</p>
          <p className="text-xs text-muted-foreground">{offering.courseCode}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-xs",
            tone === "added"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {tone === "added" ? "جدید" : "حذف"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        {(() => {
          const name =
            typeof offering.professor === "string"
              ? offering.professor
              : (offering.professor as { fa?: string } | null)?.fa
          return name ? <span>استاد: {name}</span> : null
        })()}
        {offering.location && <span>محل: {offering.location}</span>}
      </div>
    </Card>
  )
}

function ChangedCard({
  item,
  onOpen,
}: {
  item: OfferingUpdated
  onOpen?: () => void
}) {
  return (
    <Card
      className="min-h-20 cursor-pointer gap-1.5 p-3 ring-info/40"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{item.after.courseName}</p>
          <p className="text-xs text-muted-foreground">
            {item.after.courseCode}
          </p>
        </div>
        <span className="shrink-0 rounded bg-info/10 px-2 py-0.5 text-xs text-info">
          تغییر
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {item.changes.map((ch) => (
          <span
            key={ch.field}
            className="rounded bg-info/10 px-2 py-0.5 text-info"
          >
            {ch.label}
          </span>
        ))}
      </div>
    </Card>
  )
}
