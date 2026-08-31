"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CalendarClock,
  ChevronLeft,
  CircleCheck,
  GraduationCap,
  Hash,
} from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { Badge } from "@workspace/ui/components/badge"

import {
  fetchMe,
  fetchMajors,
  fetchOfferingTerms,
  fetchUniversities,
  type OfferingTerm,
} from "@/lib/api"
import { apiClient } from "@/lib/request"
import { cn } from "@workspace/ui/lib/utils"
import { SettingsRow } from "@/components/app/theme/settings-row"
import { IsLastTermDrawer } from "./is-last-term-drawer"
import { SemesterDrawer } from "@/components/app/semester-drawer"
import { findNewerSemesterCode } from "@/lib/term"

const SEMESTER_FA: Record<string, string> = {
  MEHR: "مهر",
  BAHMAN: "بهمن",
  SUMMER: "تابستان",
}

/** "[1402-1403]" -> «1402 تا 1403», "1402" -> "1402". */
function formatYearRange(range: string) {
  const match = /^\[(\d{4})-(\d{4})\]$/.exec(range)
  return match ? `${match[1]} تا ${match[2]}` : range
}

/** Editable row - same flat look plus icon tile and chevron. */
function EditRow({
  icon,
  label,
  value,
  badge,
  multiline = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  badge?: React.ReactNode
  /** Allow the value to wrap instead of truncating (long combined values). */
  multiline?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/40"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span
          className={cn(
            "block text-xs text-muted-foreground",
            multiline ? "leading-5 break-words" : "truncate"
          )}
        >
          {value}
        </span>
      </span>
      {badge}
      <ChevronLeft className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
    </button>
  )
}

/** Term number 1..12 grid. */
function TermNumberPicker({
  value,
  onSelect,
}: {
  value: number | null
  onSelect: (n: number) => void
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2 p-4">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(n)}
          className={`flex size-12 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors ${
            value === n
              ? "border-primary bg-primary text-primary-foreground"
              : "bg-card hover:border-primary/50"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

/**
 * نیم‌سال picker - ONLY the terms that actually exist as offering snapshots
 * for the student's uni/major (from /app/offerings/terms).
 */
function SemesterPicker({
  terms,
  value,
  onSelect,
}: {
  terms: OfferingTerm[]
  value: string | null
  onSelect: (term: OfferingTerm) => void
}) {
  return (
    <div className="space-y-2 p-4">
      {terms.map((term) => {
        const active = value === term.termCode
        return (
          <button
            key={term.termCode}
            type="button"
            onClick={() => onSelect(term)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start transition-colors ${
              active
                ? "border-primary bg-primary/5"
                : "bg-card hover:border-primary/40"
            }`}
          >
            <span className="flex items-center gap-2 text-sm">
              {term.label}
            </span>
            {active ? (
              <CircleCheck className="size-5 text-success" />
            ) : (
              <span className="text-xs opacity-80">انتخاب</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function StudentAccount({
  children,
}: {
  children?: React.ReactElement
}) {
  const [open, setOpen] = useState(false)
  const [termOpen, setTermOpen] = useState(false)
  const [semesterOpen, setSemesterOpen] = useState(false)
  const router = useRouter()
  const qc = useQueryClient()

  // Allow profile page toast to open the semester drawer
  useEffect(() => {
    const handler = () => {
      setOpen(true)
      setSemesterOpen(true)
    }
    window.addEventListener("open-semester-drawer", handler)
    return () => window.removeEventListener("open-semester-drawer", handler)
  }, [])

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe })
  const profile = meQuery.data?.data?.profile ?? null
  const user = meQuery.data?.data?.user ?? null

  const unisQuery = useQuery({
    queryKey: ["universities"],
    queryFn: async () => (await fetchUniversities()).data.universities,
    enabled: open,
  })
  const majorsQuery = useQuery({
    queryKey: ["majors", profile?.universitySlug],
    queryFn: async () =>
      (await fetchMajors(profile!.universitySlug!)).data.majors,
    enabled: open && Boolean(profile?.universitySlug),
  })

  // Allowed نیم‌سال values for this uni/major - drives the picker + badge.
  const termsQuery = useQuery({
    queryKey: ["offering-terms", profile?.universitySlug, profile?.majorSlug],
    queryFn: async () =>
      (await fetchOfferingTerms(profile!.universitySlug!, profile!.majorSlug!))
        .data.terms,
    enabled: open && Boolean(profile?.universitySlug && profile?.majorSlug),
  })
  const terms = [...(termsQuery.data ?? [])].sort((a, b) =>
    a.termCode.localeCompare(b.termCode)
  )
  const availableCodes = terms.map((t) => t.termCode)
  const selectedTerm = terms.find(
    (t) => t.termCode === profile?.currentSemesterCode
  )
  const newerCode = findNewerSemesterCode(
    profile?.currentSemesterCode,
    availableCodes
  )
  const newerTerm = newerCode
    ? terms.find((t) => t.termCode === newerCode)
    : null

  const uniName =
    unisQuery.data?.find((u) => u.slug === profile?.universitySlug)?.name.fa ??
    profile?.universitySlug ??
    "—"
  const major =
    majorsQuery.data?.find((m) => m.slug === profile?.majorSlug) ?? null
  const majorName = major?.name.fa ?? profile?.majorSlug ?? "—"
  const degreeName =
    major?.degrees.find((d) => d.slug === profile?.degree)?.name.fa ??
    profile?.degree ??
    undefined

  const patchMut = useMutation({
    mutationFn: async (input: {
      termNumber?: number
      currentSemesterCode?: string
      isLastTerm?: boolean
    }) =>
      (await apiClient.patch<{ profile: unknown }>("/me/profile", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      setTermOpen(false)
      setSemesterOpen(false)
    },
  })

  const trigger = children ?? (
    <SettingsRow
      icon={<GraduationCap className="size-5" />}
      title="حساب دانشجویی"
      description="سال و نیم‌سال ورود، مقطع و ..."
    />
  )

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger render={trigger} />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle className="flex w-full items-center justify-center gap-2">
            جزئیات دانشجویی
            {user?.isContributor && (
              <Badge variant="secondary" className="text-[10px]">
                مشارکت‌کننده پروژه
              </Badge>
            )}
          </DrawerTitle>
          <DrawerDescription>
            برای تغییر هر مورد، روی آن کلیک کنید
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <div className="divide-y">
            {/* Everything the setup wizard owns - one row, edits via /setup */}
            <EditRow
              icon={<GraduationCap className="size-4" />}
              label="دانشگاه و رشته"
              multiline
              value={[
                uniName,
                majorName,
                degreeName,
                profile?.entryYearRange
                  ? formatYearRange(profile.entryYearRange)
                  : undefined,
                profile?.entrySemester
                  ? SEMESTER_FA[profile.entrySemester]
                  : undefined,
              ]
                .filter(Boolean)
                .join(" — ")}
              onClick={() => router.push("/setup")}
            />

            <Drawer open={termOpen} onOpenChange={setTermOpen}>
              <DrawerTrigger
                render={
                  <EditRow
                    icon={<Hash className="size-4" />}
                    label="ترم"
                    value={
                      profile?.termNumber
                        ? `ترم ${profile.termNumber}`
                        : "انتخاب نشده"
                    }
                    onClick={() => setTermOpen(true)}
                  />
                }
              />
              <DrawerPopup variant="inset" showBar>
                <DrawerHeader>
                  <DrawerTitle>انتخاب ترم</DrawerTitle>
                  <DrawerDescription>
                    ترم فعلی خود را انتخاب کنید (۱ تا ۱۲)
                  </DrawerDescription>
                </DrawerHeader>
                <DrawerPanel className="p-0">
                  <TermNumberPicker
                    value={profile?.termNumber ?? null}
                    onSelect={(n) => patchMut.mutate({ termNumber: n })}
                  />
                  {patchMut.isPending && (
                    <p className="pb-4 text-center text-xs text-muted-foreground">
                      در حال ذخیره…
                    </p>
                  )}
                </DrawerPanel>
              </DrawerPopup>
            </Drawer>

            <SemesterDrawer
              open={semesterOpen}
              onOpenChange={setSemesterOpen}
              trigger={
                <EditRow
                  icon={<CalendarClock className="size-4" />}
                  label="نیم سال"
                  value={
                    selectedTerm?.label ??
                    profile?.currentSemesterCode ??
                    "انتخاب نشده"
                  }
                  badge={
                    newerTerm ? (
                      <Badge className="shrink-0 text-[10px]">
                        نیم سال جدید موجود است
                      </Badge>
                    ) : undefined
                  }
                  onClick={() => setSemesterOpen(true)}
                />
              }
            />

            <IsLastTermDrawer />
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
