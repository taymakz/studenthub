"use client"

import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import {
  Download,
  Eraser,
  GraduationCap,
  LayoutGrid,
  RotateCcw,
  Rows3,
} from "lucide-react"

import { ProfileSwitcher } from "@/components/profile-switcher"
import { useChartStore } from "@/components/chart-store"
import { ThemeSwitcher } from "@/components/theme-switcher"
import {
  SidebarDrillDownNav,
  type NavSection,
} from "@/components/drill-down-nav"
import { useSidebarDialogStore } from "@/components/sidebar-dialog-store"
import { DEGREE_OPTIONS } from "@/lib/chart"
import { toFaDigits } from "@/lib/jalali"

/** Action-based sidebar - no page links. Scope/meta options drill in with
    the same animation as the old link nav; destructive/global actions live
    in the footer. */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const {
    pool,
    chart,
    scope,
    setMode,
    setDegree,
    setTermCount,
    shrinkTermCount,
  } = useChartStore()
  const setExportOpen = useSidebarDialogStore((s) => s.setExportOpen)
  const requestConfirm = useSidebarDialogStore((s) => s.requestConfirm)
  const requestTermCountConfirm = useSidebarDialogStore(
    (s) => s.requestTermCountConfirm
  )

  /** Decreasing the term count only asks for confirmation when a removed
      term actually holds courses; empty terms shrink silently. */
  const selectTermCount = (count: number) => {
    if (count >= chart.termCount) {
      setTermCount(count)
      return
    }
    let doomedHasCourses = false
    for (let term = chart.termCount; term > count; term--) {
      if ((chart.terms[term] ?? []).length > 0) {
        doomedHasCourses = true
        break
      }
    }
    if (doomedHasCourses) requestTermCountConfirm(count)
    else shrinkTermCount(count)
  }

  const hasAnyCourses =
    pool.courses.length > 0 ||
    Object.values(chart.terms).some((courses) => courses.length > 0) ||
    chart.moaref.length > 0 ||
    chart.unknown.length > 0 ||
    chart.electives.length > 0

  const modeLabel = scope.mode === "normal" ? "عادی" : "پیشرفته"
  const degreeLabel =
    DEGREE_OPTIONS.find((d) => d.slug === chart.degree)?.label ?? chart.degree

  const sections: NavSection[] = [
    {
      items: [
        {
          key: "mode",
          label: "حالت چارت",
          icon: LayoutGrid,
          disabled: !hasAnyCourses,
          summary: modeLabel,
          children: [
            {
              key: "mode-normal",
              label: "عادی",
              checked: scope.mode === "normal",
              onSelect: () => setMode("normal"),
            },
            {
              key: "mode-advanced",
              label: "پیشرفته",
              checked: scope.mode === "advanced",
              onSelect: () => setMode("advanced"),
            },
          ],
        },
        {
          key: "term-count",
          label: "تعداد ترم‌ها",
          icon: Rows3,
          disabled: !hasAnyCourses,
          summary: toFaDigits(chart.termCount),
          children: Array.from({ length: 8 }, (_, i) => i + 1).map((count) => ({
            key: `terms-${count}`,
            label: `ترم ${toFaDigits(count)}`,
            badge: toFaDigits(count),
            checked: chart.termCount === count,
            onSelect: () => selectTermCount(count),
          })),
        },
        {
          key: "degree",
          label: "مقطع",
          icon: GraduationCap,
          disabled: !hasAnyCourses,
          summary: degreeLabel,
          children: DEGREE_OPTIONS.map((degree) => ({
            key: `degree-${degree.slug}`,
            label: degree.label,
            checked: chart.degree === degree.slug,
            onSelect: () => setDegree(degree.slug),
          })),
        },
      ],
    },
  ]

  return (
    <Sidebar collapsible="offcanvas" className="border-e-0!" {...props}>
      <SidebarHeader className="p-0">
        <ProfileSwitcher />
        <ThemeSwitcher />
      </SidebarHeader>
      <SidebarContent className="pt-4">
        <SidebarDrillDownNav sections={sections} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        <div
          aria-live="polite"
          className="mb-1 flex items-center justify-center rounded-md bg-sidebar-accent/50 px-2 py-1.5 text-[11px] font-medium text-muted-foreground tabular-nums"
        >
          {pool.courses.length > 0
            ? `${toFaDigits(pool.courses.length)} درس از ${toFaDigits(pool.totalOfferings)} ارائه`
            : "هنوز درسی وارد نشده"}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled={!hasAnyCourses}
              onClick={() => setExportOpen(true)}
              tooltip="خروجی چارت"
              className="text-muted-foreground"
            >
              <Download />
              <span>خروجی چارت</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled={!hasAnyCourses}
              onClick={() => requestConfirm("clear")}
              tooltip="حذف همه دروس"
              className="text-destructive/80 hover:bg-destructive/10 hover:text-destructive active:text-destructive data-[active=true]:text-destructive"
            >
              <Eraser />
              <span>حذف همه دروس</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled={!hasAnyCourses}
              onClick={() => requestConfirm("reset")}
              tooltip="ریست چارت"
              className="text-destructive/80 hover:bg-destructive/10 hover:text-destructive active:text-destructive data-[active=true]:text-destructive"
            >
              <RotateCcw />
              <span>ریست چارت</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
