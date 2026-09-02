"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock, GraduationCap, Hash } from "lucide-react"

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

import { SettingsRow } from "@/components/app/theme/settings-row"
import { IsLastTermDrawer } from "./is-last-term-drawer"
import { SemesterDrawer } from "@/components/app/semester-drawer"
import { TermNumberPicker } from "./term-number-picker"
import { EditRow } from "./student-account/account-rows"
import { formatYearRange, SEMESTER_FA } from "./student-account/account-format"
import { useStudentAccountData, useStudentPatch } from "./student-account-hooks"

function StudentAccountContent({
  open,
  profile,
  unisQuery,
  majorsQuery,
  terms,
  newerCode,
  selectedTerm,
  newerTerm,
  patchMut,
  termOpen,
  setTermOpen,
  semesterOpen,
  setSemesterOpen,
  router,
}: {
  open: boolean
  profile: ReturnType<typeof useStudentAccountData>["profile"]
  unisQuery: ReturnType<typeof useStudentAccountData>["unisQuery"]
  majorsQuery: ReturnType<typeof useStudentAccountData>["majorsQuery"]
  terms: ReturnType<typeof useStudentAccountData>["terms"]
  newerCode: string | null | undefined
  selectedTerm: ReturnType<typeof useStudentAccountData>["terms"][number] | undefined
  newerTerm: ReturnType<typeof useStudentAccountData>["terms"][number] | null | undefined
  patchMut: ReturnType<typeof useStudentPatch>
  termOpen: boolean
  setTermOpen: (v: boolean) => void
  semesterOpen: boolean
  setSemesterOpen: (v: boolean) => void
  router: ReturnType<typeof useRouter>
}) {
  const uniName = unisQuery.data?.find((u) => u.slug === profile?.universitySlug)?.name.fa ?? "—"
  const major = majorsQuery.data?.find((m) => m.slug === profile?.majorSlug) ?? null
  const majorName = major?.name.fa ?? "—"
  const degreeName = major?.degrees.find((d) => d.slug === profile?.degree)?.name.fa
  return (
    <div className="divide-y">
      <EditRow icon={<GraduationCap className="size-4" />} label="دانشگاه و رشته" multiline value={[uniName, majorName, degreeName, profile?.entryYearRange ? formatYearRange(profile.entryYearRange) : undefined, profile?.entrySemester ? SEMESTER_FA[profile.entrySemester] : undefined].filter(Boolean).join(" — ")} onClick={() => router.push("/setup")} />
      <TermRow profile={profile} patchMut={patchMut} termOpen={termOpen} setTermOpen={setTermOpen} />
      <SemesterRow profile={profile} selectedTerm={selectedTerm} newerTerm={newerTerm} semesterOpen={semesterOpen} setSemesterOpen={setSemesterOpen} />
      <IsLastTermDrawer />
    </div>
  )
}

function TermRow({ profile, patchMut, termOpen, setTermOpen }: { profile: ReturnType<typeof useStudentAccountData>["profile"]; patchMut: ReturnType<typeof useStudentPatch>; termOpen: boolean; setTermOpen: (v: boolean) => void }) {
  return (
    <Drawer open={termOpen} onOpenChange={setTermOpen}>
      <DrawerTrigger render={<EditRow icon={<Hash className="size-4" />} label="ترم" value={profile?.termNumber ? `ترم ${profile.termNumber}` : "انتخاب نشده"} onClick={() => setTermOpen(true)} />} />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader><DrawerTitle>انتخاب ترم</DrawerTitle><DrawerDescription>ترم فعلی خود را انتخاب کنید</DrawerDescription></DrawerHeader>
        <DrawerPanel className="p-0"><TermNumberPicker value={profile?.termNumber ?? null} onSelect={(n) => patchMut.mutate({ termNumber: n })} disabled={patchMut.isPending} pendingValue={patchMut.isPending ? (patchMut.variables as { termNumber?: number })?.termNumber ?? null : null} /></DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

function SemesterRow({ profile, selectedTerm, newerTerm, semesterOpen, setSemesterOpen }: { profile: ReturnType<typeof useStudentAccountData>["profile"]; selectedTerm: ReturnType<typeof useStudentAccountData>["terms"][number] | undefined; newerTerm: ReturnType<typeof useStudentAccountData>["terms"][number] | null | undefined; semesterOpen: boolean; setSemesterOpen: (v: boolean) => void }) {
  return (
    <SemesterDrawer open={semesterOpen} onOpenChange={setSemesterOpen} trigger={<EditRow icon={<CalendarClock className="size-4" />} label="نیم سال" value={selectedTerm?.label ?? profile?.currentSemesterCode ?? "انتخاب نشده"} badge={newerTerm ? <Badge className="shrink-0 text-[10px]">نیم سال جدید موجود است</Badge> : undefined} onClick={() => setSemesterOpen(true)} />} />
  )
}

export default function StudentAccount({ children }: { children?: React.ReactElement }) {
  const [open, setOpen] = useState(false)
  const [termOpen, setTermOpen] = useState(false)
  const [semesterOpen, setSemesterOpen] = useState(false)
  const router = useRouter()
  useEffect(() => { const h = () => { setOpen(true); setSemesterOpen(true) }; window.addEventListener("open-semester-drawer", h); return () => window.removeEventListener("open-semester-drawer", h) }, [])
  const { profile, user, unisQuery, majorsQuery, terms, newerCode } = useStudentAccountData(open)
  // Close the pickers when the underlying profile identity changes (e.g. a
  // patch from another surface refreshed /me). Render-phase adjustment per
  // react.dev "you might not need an effect" — no setState-in-effect.
  const profileIdentity = [
    profile?.universitySlug,
    profile?.majorSlug,
    profile?.entryYearRange,
    profile?.termNumber,
    profile?.currentSemesterCode,
  ].join("|")
  const [prevIdentity, setPrevIdentity] = useState(profileIdentity)
  if (prevIdentity !== profileIdentity) {
    setPrevIdentity(profileIdentity)
    setOpen(false)
    setTermOpen(false)
    setSemesterOpen(false)
  }
  const selectedTerm = terms.find((t) => t.termCode === profile?.currentSemesterCode)
  const newerTerm = newerCode ? terms.find((t) => t.termCode === newerCode) : null
  const patchMut = useStudentPatch(() => { setTermOpen(false); setSemesterOpen(false) })

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
            {user?.isContributor && <Badge variant="secondary" className="text-[10px]">مشارکت‌کننده پروژه</Badge>}
          </DrawerTitle>
          <DrawerDescription>برای تغییر هر مورد، روی آن کلیک کنید</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <StudentAccountContent open={open} profile={profile} unisQuery={unisQuery} majorsQuery={majorsQuery} terms={terms} newerCode={newerCode} selectedTerm={selectedTerm} newerTerm={newerTerm} patchMut={patchMut} termOpen={termOpen} setTermOpen={setTermOpen} semesterOpen={semesterOpen} setSemesterOpen={setSemesterOpen} router={router} />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
