"use client"

import { useState } from "react"
import { AnimatePresence, m } from "motion/react"

import { Card } from "@workspace/ui/components/card"

import type { Offering, OfferingChangedField } from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"
import { useTimeAgo } from "@/hooks/use-time-ago"
import { CourseChangesSkeleton } from "./section-skeleton"
import { CourseDetailDrawer } from "@/components/app/courses/course-detail-drawer"
import { ProfessorDrawer } from "@/components/app/courses/professor-drawer"
import { useCourseChangesData } from "./course-changes/use-course-changes"
import { ChangesTabs } from "./course-changes/course-changes-tabs"
import { TabContent } from "./course-changes/tab-content"

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
          <m.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.1 }}>
            <TabContent tab={tab} added={added} updated={updated} removed={removed} setSelected={setSelected} setSelectedChanges={setSelectedChanges} />
          </m.div>
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
