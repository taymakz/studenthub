"use client"

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  Star,
  Trash2,
  Pencil,
  Users,
  Check,
  X,
} from "lucide-react"

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
import { ElasticSlider } from "@workspace/ui/components/elastic-slider"
import { Spinner } from "@workspace/ui/components/spinner"
import { toastManager } from "@workspace/ui/components/toast"

import {
  deleteVote,
  fetchProfessorVotes,
  fetchProfessors,
  fetchVote,
  saveVote,
  type Offering,
} from "@/lib/api"
import { useProfileStore } from "@/stores/profile-store"

// ─── helpers (mirrors frontend-next/components/app/professor/sections/information.tsx) ───

function getRatingColor(value: number) {
  if (value >= 4) return "text-success"
  if (value >= 3) return "text-warning"
  return "text-destructive"
}

function formatRating(value: number) {
  return value.toFixed(1)
}

// ─── Information (exact copy of previous project's ProfessorInformation) ───

function ProfessorInformation({
  professorName,
  total,
  averages,
  hideName,
  hasVoted,
}: {
  professorName: string
  total: number
  averages: {
    examDifficulty: number | null
    teachingQuality: number | null
    mastery: number | null
    leniency: number | null
    questionSimilarity: number | null
    providesSampleQuestions?: number | null
    providesNotes?: number | null
    mandatoryAttendance?: number | null
  } | null
  hideName?: boolean
  hasVoted?: boolean
}) {
  return (
    <div className="space-y-3">
      <div
        className={`flex items-center ${hideName ? "justify-center" : "justify-between"}`}
      >
        {!hideName && (
          <h3 className="line-clamp-1 text-sm font-medium text-primary">
            {professorName}
          </h3>
        )}
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="size-4" />
            {total} رأی
          </span>
          {hasVoted && (
            <span className="rounded-full bg-warning/10 px-2 py-px text-xs text-warning">
              رأی داده شده
            </span>
          )}
        </div>
      </div>

      {/* Boolean Attributes — mirrors previous project's information.tsx */}
      {(averages?.providesSampleQuestions != null ||
        averages?.providesNotes != null ||
        averages?.mandatoryAttendance != null) && (
        <div className="flex min-h-6 flex-wrap gap-2 text-sm">
          {(averages?.providesSampleQuestions ?? 0) > 0.5 && (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-success">
              <Check className="size-3" />
              نمونه سوال
            </span>
          )}
          {(averages?.providesNotes ?? 0) > 0.5 && (
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-success">
              <Check className="size-3" />
              جزوه
            </span>
          )}
          {(averages?.mandatoryAttendance ?? 0) > 0.5 && (
            <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-destructive">
              <X className="size-3" />
              حضور اجباری
            </span>
          )}
        </div>
      )}

      {/* Ratings Grid — mirrors old information.tsx but mapped to new 5 fields */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="col-span-2 flex items-center justify-between rounded bg-muted/30 p-2">
          <span className="text-muted-foreground">تسلط</span>
          <span
            className={`font-medium ${averages?.mastery != null ? getRatingColor(averages.mastery) : ""}`}
          >
            {averages?.mastery != null ? formatRating(averages.mastery) : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded bg-muted/30 p-2">
          <span className="text-muted-foreground">سختی امتحان</span>
          <span
            className={`font-medium ${averages?.examDifficulty != null ? getRatingColor(5 - averages.examDifficulty) : ""}`}
          >
            {averages?.examDifficulty != null
              ? formatRating(averages.examDifficulty)
              : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded bg-muted/30 p-2">
          <span className="text-muted-foreground">نمره‌دهی</span>
          <span
            className={`font-medium ${averages?.leniency != null ? getRatingColor(averages.leniency) : ""}`}
          >
            {averages?.leniency != null ? formatRating(averages.leniency) : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded bg-muted/30 p-2">
          <span className="text-muted-foreground">کیفیت تدریس</span>
          <span
            className={`font-medium ${averages?.teachingQuality != null ? getRatingColor(averages.teachingQuality) : ""}`}
          >
            {averages?.teachingQuality != null
              ? formatRating(averages.teachingQuality)
              : "—"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded bg-muted/30 p-2">
          <span className="text-muted-foreground">شباهت سوالات</span>
          <span
            className={`font-medium ${averages?.questionSimilarity != null ? getRatingColor(averages.questionSimilarity) : ""}`}
          >
            {averages?.questionSimilarity != null
              ? formatRating(averages.questionSimilarity)
              : "—"}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Fields (mirrors frontend-next/components/app/professor/sections/actions/fields.tsx) ───

const sliderFields = [
  { key: "mastery" as const, label: "تسلط", inverted: false },
  { key: "leniency" as const, label: "نمره‌دهی", inverted: false },
  { key: "teachingQuality" as const, label: "کیفیت تدریس", inverted: false },
  {
    key: "questionSimilarity" as const,
    label: "شباهت سوالات",
    inverted: false,
  },
  { key: "examDifficulty" as const, label: "سختی امتحان", inverted: true },
] as const

function getSliderTheme(value: number, inverted: boolean) {
  const v = inverted ? 6 - value : value
  // 1=red, 2=orange, 3=yellow, 4=lime, 5=green
  if (v >= 5)
    return "[--elastic-slider-fill:var(--color-success)] [--elastic-slider-fill-active:var(--color-success)]"
  if (v >= 4)
    return "[--elastic-slider-fill:oklch(0.72_0.14_145)] [--elastic-slider-fill-active:oklch(0.72_0.14_145)]"
  if (v >= 3)
    return "[--elastic-slider-fill:var(--color-warning)] [--elastic-slider-fill-active:var(--color-warning)]"
  if (v >= 2)
    return "[--elastic-slider-fill:oklch(0.7_0.19_45)] [--elastic-slider-fill-active:oklch(0.7_0.19_45)]"
  return "[--elastic-slider-fill:var(--color-destructive)] [--elastic-slider-fill-active:var(--color-destructive)]"
}

export type ProfessorFieldsHandle = {
  submit: () => Promise<void>
  isSubmitting: boolean
}

const ProfessorFields = forwardRef<
  ProfessorFieldsHandle,
  {
    professorSlug: string
    universitySlug: string
    majorSlug: string
    initialVote: Record<string, unknown> | null
    mode: "create" | "update"
    onSuccess?: () => void
    onLoadingChange?: (loading: boolean) => void
  }
>(function ProfessorFields(
  {
    professorSlug,
    universitySlug,
    majorSlug,
    initialVote,
    mode,
    onSuccess,
    onLoadingChange,
  },
  ref
) {
  const [formData, setFormData] = useState<Record<string, number>>({
    mastery: Number(initialVote?.mastery ?? 3),
    examDifficulty: Number(initialVote?.examDifficulty ?? 3),
    leniency: Number(initialVote?.leniency ?? 3),
    teachingQuality: Number(initialVote?.teachingQuality ?? 3),
    questionSimilarity: Number(initialVote?.questionSimilarity ?? 3),
  })
  const [providesSampleQuestions, setProvidesSampleQuestions] =
    useState<boolean>(Boolean(initialVote?.providesSampleQuestions ?? false))
  const [providesNotes, setProvidesNotes] = useState<boolean>(
    Boolean(initialVote?.providesNotes ?? false)
  )
  const [mandatoryAttendance, setMandatoryAttendance] = useState<boolean>(
    Boolean(initialVote?.mandatoryAttendance ?? false)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      onLoadingChange?.(true)
      await saveVote({
        universitySlug,
        majorSlug,
        professorSlug,
        examDifficulty: formData.examDifficulty ?? 3,
        teachingQuality: formData.teachingQuality ?? 3,
        mastery: formData.mastery ?? 3,
        leniency: formData.leniency ?? 3,
        questionSimilarity: formData.questionSimilarity ?? 3,
        providesSampleQuestions,
        providesNotes,
        mandatoryAttendance,
      })
      toastManager.add({
        type: "success",
        title:
          mode === "create"
            ? "رأی شما با موفقیت ثبت شد"
            : "رأی شما با موفقیت ویرایش شد",
        data: { variant: "x" },
      })
      onSuccess?.()
    } catch {
      toastManager.add({
        type: "error",
        title: "خطا در ثبت رأی",
        data: { variant: "x" },
      })
    } finally {
      setIsSubmitting(false)
      setTimeout(() => onLoadingChange?.(false), 300)
    }
  }

  useImperativeHandle(ref, () => ({ submit: handleSubmit, isSubmitting }), [
    handleSubmit,
    isSubmitting,
  ])

  return (
    <div className="space-y-6">
      {sliderFields.map((field) => (
        <div key={field.key}>
          <ElasticSlider
            label={field.label}
            min={1}
            max={5}
            step={1}
            value={formData[field.key] ?? 3}
            onValueChange={(v) =>
              setFormData((prev) => ({ ...prev, [field.key]: v }))
            }
            className={getSliderTheme(formData[field.key] ?? 3, field.inverted)}
          />
        </div>
      ))}

      <div className="grid grid-cols-3 gap-2 pt-2">
        <Button
          variant={providesSampleQuestions ? "default" : "outline"}
          size="sm"
          onClick={() => setProvidesSampleQuestions((v) => !v)}
          className="text-xs"
        >
          ارائه نمونه سوال
        </Button>
        <Button
          variant={providesNotes ? "default" : "outline"}
          size="sm"
          onClick={() => setProvidesNotes((v) => !v)}
          className="text-xs"
        >
          ارائه جزوه
        </Button>
        <Button
          variant={mandatoryAttendance ? "default" : "outline"}
          size="sm"
          onClick={() => setMandatoryAttendance((v) => !v)}
          className="text-xs"
        >
          حضور اجباری
        </Button>
      </div>
    </div>
  )
})

// ─── Main Drawer ───

export function ProfessorDrawer({
  open,
  onOpenChange,
  professorName,
  uni,
  major,
  currentCourseIndex,
  onCourseSelected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  professorName: string
  uni: string
  major: string
  currentCourseIndex?: string | null
  onCourseSelected?: (offering: Offering) => void
}) {
  const qc = useQueryClient()
  const [voteOpen, setVoteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const voteFieldsRef = useRef<ProfessorFieldsHandle>(null)
  const editFieldsRef = useRef<ProfessorFieldsHandle>(null)
  const [voteSubmitting, setVoteSubmitting] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const slugQuery = useQuery({
    queryKey: ["professors", uni, major],
    queryFn: async () => (await fetchProfessors(uni, major)).data.professors,
    enabled: open,
  })
  const slug = useMemo(
    () => slugQuery.data?.find((p) => p.name === professorName)?.slug ?? null,
    [slugQuery.data, professorName]
  )

  const votesQuery = useQuery({
    queryKey: ["professor-votes", uni, major, slug],
    queryFn: async () => (await fetchProfessorVotes(uni, major, slug!)).data,
    enabled: open && !!slug,
  })
  const ownQuery = useQuery({
    queryKey: ["my-vote", slug],
    queryFn: async () => (await fetchVote(slug!)).data.vote,
    enabled: open && !!slug,
    retry: false,
  })
  const own = ownQuery.data as Record<string, unknown> | null
  const hasVoted = !!own

  const handleDelete = async () => {
    if (!slug) return
    try {
      setIsDeleting(true)
      await deleteVote(slug)
      toastManager.add({
        type: "success",
        title: "رأی شما با موفقیت حذف شد",
        data: { variant: "x" },
      })
      ownQuery.refetch()
      votesQuery.refetch()
      qc.invalidateQueries({ queryKey: ["professor-votes", uni, major, slug] })
      setDeleteOpen(false)
    } catch {
      toastManager.add({
        type: "error",
        title: "خطا در حذف رأی",
        data: { variant: "x" },
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const otherOfferings = useProfileStore((s) => s.offerings)
  const otherCourses = useMemo(
    () =>
      otherOfferings.filter((o) => {
        const name =
          typeof o.professor === "string"
            ? o.professor
            : (o.professor as { fa?: string } | null)?.fa
        return name === professorName && o.index !== currentCourseIndex
      }),
    [otherOfferings, professorName, currentCourseIndex]
  )

  const total = votesQuery.data?.total ?? 0
  const averages = votesQuery.data?.averages ?? null
  const isSlugLoading = slugQuery.isLoading
  const isVotesLoading = votesQuery.isLoading
  const isOwnLoading = ownQuery.isLoading
  const isInitialLoading =
    isSlugLoading || (!!slug && (isVotesLoading || isOwnLoading))

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle>{professorName}</DrawerTitle>
            <DrawerDescription>
              {isInitialLoading ? "در حال بارگذاری…" : `${total} نظر`}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-4 p-4">
            {isInitialLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Spinner />
                <p className="text-sm text-muted-foreground">
                  در حال بارگذاری...
                </p>
              </div>
            ) : (
              <>
                {(!uni || !major) && (
                  <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-center text-xs text-muted-foreground">
                    پروفایل دانشگاهی ناقص است — برای رأی دادن پروفایل را کامل
                    کنید.
                  </div>
                )}
                {/* Information — exact copy of previous project's ProfessorInformation */}
                <ProfessorInformation
                  professorName={professorName}
                  total={total}
                  averages={averages}
                  hideName
                  hasVoted={hasVoted}
                />

                {/* Actions — mirrors frontend-next/components/app/professor/sections/actions/index.tsx */}
                <div className="space-y-2">
                  {!hasVoted ? (
                    <Button
                      className="w-full gap-2"
                      onClick={() => setVoteOpen(true)}
                      disabled={!uni || !major}
                    >
                      <Star className="size-5" />
                      رأی دادن به استاد
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => setEditOpen(true)}
                        disabled={!uni || !major}
                      >
                        <Pencil className="size-5" />
                        ویرایش رأی
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full gap-2"
                        onClick={() => setDeleteOpen(true)}
                        disabled={!uni || !major}
                      >
                        <Trash2 className="size-5" />
                        حذف رأی
                      </Button>
                    </>
                  )}
                </div>

                {/* Other Courses — mirrors ProfessorOtherCourses */}
                {otherCourses.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-px w-fit grow rounded-full bg-border" />
                      <div className="text-center text-sm text-muted-foreground">
                        دروس دیگر این استاد
                      </div>
                      <div className="h-px w-fit grow rounded-full bg-border" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {otherCourses.map((course) => (
                        <div
                          key={course.index}
                          className="cursor-pointer rounded-lg bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                          onClick={() => {
                            onOpenChange(false)
                            onCourseSelected?.(course)
                          }}
                        >
                          <div className="flex justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {course.courseName}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                                {course.classSchedule && (
                                  <>
                                    <span>{course.classSchedule}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Vote — mirrors frontend-next/components/app/professor/sections/actions/vote.tsx */}
      <Drawer open={voteOpen} onOpenChange={setVoteOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle className="text-base">
              رأی دادن به {professorName}
            </DrawerTitle>
          </DrawerHeader>
          <DrawerPanel className="p-4">
            {slug ? (
              <ProfessorFields
                ref={voteFieldsRef}
                professorSlug={slug}
                universitySlug={uni}
                majorSlug={major}
                initialVote={null}
                mode="create"
                onSuccess={() => {
                  setVoteOpen(false)
                  ownQuery.refetch()
                  votesQuery.refetch()
                  qc.invalidateQueries({ queryKey: ["my-vote", slug] })
                }}
                onLoadingChange={setVoteSubmitting}
              />
            ) : null}
          </DrawerPanel>
          <DrawerFooter>
            <Button
              className="w-full"
              onClick={() => voteFieldsRef.current?.submit()}
              disabled={voteSubmitting}
            >
              {voteSubmitting ? "در حال ثبت..." : "ثبت رای"}
            </Button>
          </DrawerFooter>
        </DrawerPopup>
      </Drawer>

      {/* Edit — mirrors update.tsx */}
      <Drawer open={editOpen} onOpenChange={setEditOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle className="text-base">
              ویرایش رأی {professorName}
            </DrawerTitle>
          </DrawerHeader>
          <DrawerPanel className="p-4">
            {slug && own ? (
              <ProfessorFields
                ref={editFieldsRef}
                professorSlug={slug}
                universitySlug={uni}
                majorSlug={major}
                initialVote={own}
                mode="update"
                onSuccess={() => {
                  setEditOpen(false)
                  ownQuery.refetch()
                  votesQuery.refetch()
                  qc.invalidateQueries({ queryKey: ["my-vote", slug] })
                }}
                onLoadingChange={setEditSubmitting}
              />
            ) : null}
          </DrawerPanel>
          <DrawerFooter>
            <Button
              className="w-full"
              onClick={() => editFieldsRef.current?.submit()}
              disabled={editSubmitting}
            >
              {editSubmitting ? "در حال ثبت..." : "ثبت رای"}
            </Button>
          </DrawerFooter>
        </DrawerPopup>
      </Drawer>

      {/* Delete — mirrors delete.tsx */}
      <Drawer open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle>حذف رأی</DrawerTitle>
            <DrawerDescription>
              آیا از حذف رأی خود برای استاد {professorName} اطمینان دارید؟ این
              عملیات قابل بازگشت نیست.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex gap-2 p-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "در حال حذف..." : "حذف رأی"}
            </Button>
          </div>
        </DrawerPopup>
      </Drawer>
    </>
  )
}
