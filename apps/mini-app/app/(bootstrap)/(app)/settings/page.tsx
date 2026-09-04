"use client"

import ContentLayout from "@/components/app/content-layout"
import { LightRays } from "@/components/ui/light-rays"

import StudentAccount from "@/components/app/settings/student-account"
import ChangeTheme from "@/components/app/theme/change-theme"
import ColorPalette from "@/components/app/theme/color-palette"
import Effects from "@/components/app/settings/effects"
import SettingsStack from "@/components/app/settings/stack"
import SettingsDevelopers from "@/components/app/settings/developers"
import SettingsFooter from "@/components/app/settings/footer"
import TermsAndConditions from "@/components/app/settings/terms-and-conditions"
import ContactSupport from "@/components/app/settings/contact-support"
import Faq from "@/components/app/settings/faq"
import CourseVisibility from "@/components/app/settings/course-visibility"
import Feedback from "@/components/app/settings/feedback"
import LogoutRow from "@/components/app/settings/logout"
import { GraduationCap } from "lucide-react"
import { SettingsRow } from "@/components/app/theme/settings-row"
import { useIsRoutePreview } from "@/lib/route-preview-context"

export default function SettingsPage() {
  const isRoutePreview = useIsRoutePreview()
  const studentAccountRow = (
    <SettingsRow
      icon={<GraduationCap className="size-5" />}
      title="حساب دانشجویی"
      description="سال و نیم‌سال ورود، مقطع و ..."
    />
  )

  return (
    <>
      <div className="relative flex h-70 items-center justify-center safe-top-padding pb-[calc(var(--tg-safe-area-inset-top)+var(--tg-content-safe-area-inset-top))]">
        <h1 className="z-10 font-semibold tracking-[0.35em] text-slate-800/60 uppercase dark:text-slate-200/60">
          Settings
        </h1>
        <LightRays count={isRoutePreview ? 0 : 5} />
      </div>
      <ContentLayout>
        <div className="mx-auto max-w-screen-sm space-y-6 pt-4">
          {/* عمومی */}
          <div>
            <h2 className="mb-2 px-6 text-sm font-medium text-muted-foreground">
              عمومی
            </h2>
            {isRoutePreview ? (
              studentAccountRow
            ) : (
              <StudentAccount>{studentAccountRow}</StudentAccount>
            )}
            <CourseVisibility />
            {!isRoutePreview && <LogoutRow />}
          </div>

          {/* شخصی‌سازی */}
          <div>
            <h2 className="mb-2 px-6 text-sm font-medium text-muted-foreground">
              شخصی‌سازی
            </h2>
            <ChangeTheme />
            <ColorPalette />
            <Effects />
          </div>

          {/* راهنما */}
          <div>
            <h2 className="mb-2 px-6 text-sm font-medium text-muted-foreground">
              راهنما
            </h2>
            <Faq />
            <Feedback />
            <TermsAndConditions />
            <ContactSupport />
          </div>

          {/* درباره */}
          <div>
            <h2 className="mb-2 px-6 text-sm font-medium text-muted-foreground">
              درباره
            </h2>
            <SettingsStack />
            <SettingsDevelopers />
            <SettingsFooter />
          </div>
        </div>
      </ContentLayout>
    </>
  )
}
