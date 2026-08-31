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
} from "@workspace/ui/components/drawer"
import { fetchOfferingTerms } from "@/lib/api"
import { findNewerSemesterCode } from "@/lib/term"
import { useProfileStore } from "@/stores/profile-store"
import { toastManager } from "@workspace/ui/components/toast"

export function ProfileSemesterDrawer() {
  const [open, setOpen] = useState(false)
  const profile = useProfileStore((s) => s.profile)

  const termsQuery = useQuery({
    queryKey: [
      "offering-terms",
      profile?.universitySlug,
      profile?.majorSlug,
      "profile-drawer",
    ],
    queryFn: async () =>
      (await fetchOfferingTerms(profile!.universitySlug!, profile!.majorSlug!))
        .data.terms,
    enabled: Boolean(profile?.universitySlug && profile?.majorSlug),
  })

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener("open-profile-semester-drawer", handler)
    return () =>
      window.removeEventListener("open-profile-semester-drawer", handler)
  }, [])

  const terms = [...(termsQuery.data ?? [])].sort((a, b) =>
    a.termCode.localeCompare(b.termCode)
  )

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

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>انتخاب نیم‌سال</DrawerTitle>
          <DrawerDescription>نیم‌سال مورد نظر را انتخاب کنید</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          {termsQuery.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              در حال بارگذاری…
            </p>
          ) : terms.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              نیم‌سالی یافت نشد
            </p>
          ) : (
            <div className="space-y-2">
              {terms
                .slice()
                .sort((a, b) => b.termCode.localeCompare(a.termCode))
                .map((t) => {
                  const active = profile?.currentSemesterCode === t.termCode
                  return (
                    <button
                      key={t.termCode}
                      type="button"
                      onClick={() => handleSelect(t.termCode)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-start transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "bg-card hover:border-primary/40"
                      }`}
                    >
                      <span className="text-sm">{t.label}</span>
                      {active && (
                        <span className="text-xs text-primary">فعلی</span>
                      )}
                    </button>
                  )
                })}
            </div>
          )}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
