"use client"

import { forwardRef, useCallback, useImperativeHandle, useState } from "react"

import { Button } from "@workspace/ui/components/button"
import { ElasticSlider } from "@workspace/ui/components/elastic-slider"
import { toastManager } from "@workspace/ui/components/toast"

import { saveVote } from "@/lib/api"

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

export const ProfessorFields = forwardRef<
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

  const handleSubmit = useCallback(async () => {
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
  }, [
    formData,
    majorSlug,
    mandatoryAttendance,
    mode,
    onLoadingChange,
    onSuccess,
    professorSlug,
    providesNotes,
    providesSampleQuestions,
    universitySlug,
  ])

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

      <BooleanToggles
        providesSampleQuestions={providesSampleQuestions}
        providesNotes={providesNotes}
        mandatoryAttendance={mandatoryAttendance}
        onToggleSample={() => setProvidesSampleQuestions((v) => !v)}
        onToggleNotes={() => setProvidesNotes((v) => !v)}
        onToggleAttendance={() => setMandatoryAttendance((v) => !v)}
      />
    </div>
  )
})

function BooleanToggles({
  providesSampleQuestions,
  providesNotes,
  mandatoryAttendance,
  onToggleSample,
  onToggleNotes,
  onToggleAttendance,
}: {
  providesSampleQuestions: boolean
  providesNotes: boolean
  mandatoryAttendance: boolean
  onToggleSample: () => void
  onToggleNotes: () => void
  onToggleAttendance: () => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2 pt-2">
      <Button
        variant={providesSampleQuestions ? "default" : "outline"}
        size="sm"
        onClick={onToggleSample}
        className="text-xs"
      >
        ارائه نمونه سوال
      </Button>
      <Button
        variant={providesNotes ? "default" : "outline"}
        size="sm"
        onClick={onToggleNotes}
        className="text-xs"
      >
        ارائه جزوه
      </Button>
      <Button
        variant={mandatoryAttendance ? "default" : "outline"}
        size="sm"
        onClick={onToggleAttendance}
        className="text-xs"
      >
        حضور اجباری
      </Button>
    </div>
  )
}
