"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

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

import { fetchOfferingTerms } from "@/lib/api"
import { findNewerSemesterCode } from "@/lib/term"
import { useProfileStore } from "@/stores/profile-store"
import { toastManager } from "@workspace/ui/components/toast"

interface SemesterDrawerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement
  children?: React.ReactElement
}

export function SemesterDrawer({
  open: controlledOpen,
  onOpenChange,
  trigger,
  children,
}: SemesterDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const profile = useProfileStore((s) => s.profile)

  const termsQuery = useQuery({
    queryKey: ["offering-terms", profile?.universitySlug, profile?.majorSlug],
    queryFn: async () =>
      (await fetchOfferingTerms(profile!.universitySlug!, profile!.majorSlug!))
        .data.terms,
    enabled: Boolean(profile?.universitySlug && profile?.majorSlug) && open,
  })

  const terms = [...(termsQuery.data ?? [])].sort((a, b) =>
    a.termCode.localeCompare(b.termCode)
  )
  const newerCode = findNewerSemesterCode(
    profile?.currentSemesterCode,
    terms.map((t) => t.termCode)
  )
  const newerTerm = newerCode
    ? terms.find((t) => t.termCode === newerCode)
    : null

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-profile-semester-drawer", handler)
    window.addEventListener("open-semester-drawer", handler)
    return () => {
      window.removeEventListener("open-profile-semester-drawer", handler)
      window.removeEventListener("open-semester-drawer", handler)
    }
  }, [setOpen])

  const handleSelect = async (code: string) => {
    try {
      await useProfileStore.getState().setSemester(code)
      toastManager.add({
        type: "success",
        title: "نیم‌سال تغییر کرد",
        data: { variant: "x" },
      })
      setOpen(false)
    } catch {
      toastManager.add({
        type: "error",
        title: "خطا در تغییر نیم‌سال",
        data: { variant: "x" },
      })
    }
  }

  const content = (
    <Drawer open={open} onOpenChange={setOpen}>
      {trigger && <DrawerTrigger render={trigger} />}
      {children && <DrawerTrigger render={children} />}
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>انتخاب نیم‌سال</DrawerTitle>
          <DrawerDescription>نیم‌سال مورد نظر را انتخاب کنید</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-2 p-4">
          {termsQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              در حال بارگذاری…
            </p>
          ) : terms.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              نیم‌سالی یافت نشد
            </p>
          ) : (
            terms
              .slice()
              .sort((a, b) => b.termCode.localeCompare(a.termCode))
              .map((t) => (
                <button
                  key={t.termCode}
                  type="button"
                  onClick={() => handleSelect(t.termCode)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start transition-colors ${
                    t.termCode === profile?.currentSemesterCode
                      ? "border-primary bg-primary/5"
                      : "bg-card hover:border-primary/40"
                  }`}
                >
                  <span className="text-sm tabular-nums">
                    {t.termCode}{" "}
                    {t.semester === "MEHR"
                      ? "مهر"
                      : t.semester === "BAHMAN"
                        ? "بهمن"
                        : "تابستان"}
                  </span>
                  {t.termCode === profile?.currentSemesterCode ? (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      فعلی
                    </Badge>
                  ) : t.termCode === newerCode ? (
                    <Badge className="h-5 px-1.5 text-xs">جدید</Badge>
                  ) : null}
                </button>
              ))
          )}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )

  // If controlled without trigger, just render drawer (for programmatic open)
  if (controlledOpen !== undefined && !trigger && !children) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle>انتخاب نیم‌سال</DrawerTitle>
            <DrawerDescription>
              نیم‌سال مورد نظر را انتخاب کنید
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-2 p-4">
            {termsQuery.isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                در حال بارگذاری…
              </p>
            ) : terms.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                نیم‌سالی یافت نشد
              </p>
            ) : (
              terms
                .slice()
                .sort((a, b) => b.termCode.localeCompare(a.termCode))
                .map((t) => (
                  <button
                    key={t.termCode}
                    type="button"
                    onClick={() => handleSelect(t.termCode)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start transition-colors ${
                      t.termCode === profile?.currentSemesterCode
                        ? "border-primary bg-primary/5"
                        : "bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="text-sm tabular-nums">
                      {t.termCode}{" "}
                      {t.semester === "MEHR"
                        ? "مهر"
                        : t.semester === "BAHMAN"
                          ? "بهمن"
                          : "تابستان"}
                    </span>
                    {t.termCode === profile?.currentSemesterCode ? (
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        فعلی
                      </Badge>
                    ) : t.termCode === newerCode ? (
                      <Badge className="h-5 px-1.5 text-xs">جدید</Badge>
                    ) : null}
                  </button>
                ))
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>
    )
  }

  return content
}
