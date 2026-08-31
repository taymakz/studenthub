"use client"

import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"

import { fetchOfferingTerms } from "@/lib/api"
import { findNewerSemesterCode } from "@/lib/term"
import { useProfileStore } from "@/stores/profile-store"
import { toastManager } from "@workspace/ui/components/toast"

export function NewTermToast() {
  const profile = useProfileStore((s) => s.profile)
  const hasShownRef = useRef(false)

  const termsQuery = useQuery({
    queryKey: [
      "offering-terms",
      profile?.universitySlug,
      profile?.majorSlug,
      "new-term-toast",
    ],
    queryFn: async () =>
      (await fetchOfferingTerms(profile!.universitySlug!, profile!.majorSlug!))
        .data.terms,
    enabled: Boolean(profile?.universitySlug && profile?.majorSlug),
  })

  useEffect(() => {
    if (hasShownRef.current) return
    if (!profile?.currentSemesterCode || !termsQuery.data) return

    const codes = termsQuery.data.map((t) => t.termCode)
    const newerCode = findNewerSemesterCode(profile.currentSemesterCode, codes)
    if (!newerCode) return

    hasShownRef.current = true

    // Show once per full mount, open semester drawer directly in same page (like courses page)
    const timer = setTimeout(() => {
      toastManager.add({
        type: "info",
        title: `نیمسال ${newerCode} اضافه شد.`,
        description: "برای تغییر کلیک کنید.",
        data: { variant: "x", hideClose: true },
        actionProps: {
          children: "تغییر",
          className: "rounded-full px-4 h-7 text-xs",
          onClick: () => {
            window.dispatchEvent(
              new CustomEvent("open-profile-semester-drawer")
            )
          },
        },
      })
    }, 800)

    return () => clearTimeout(timer)
  }, [profile?.currentSemesterCode, termsQuery.data])

  return null
}
