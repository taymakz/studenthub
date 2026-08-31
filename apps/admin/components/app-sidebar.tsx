"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import { useAuthBootstrap } from "@/components/auth-bootstrap"
import { SidebarDrillDownNav } from "@/components/drill-down-nav"
import { SidebarProfileHeader } from "@/components/user-dropdown"
import { useAuth } from "@/hooks/use-auth"
import { navSections, profileNavSections } from "@/lib/fake-data"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const booting = useAuthBootstrap()
  const inProfileArea =
    pathname.startsWith("/settings/account") ||
    pathname.startsWith("/settings/preferences")
  const { user } = useAuth()
  const sections = React.useMemo(() => {
    if (inProfileArea) return profileNavSections
    if (!user) return navSections
    const isSuperAdmin = user.role === "SUPERADMIN"
    // Filter items by role: NOTIFICATIONER/USER only see dashboard; adminOnly items only visible to SUPERADMIN
    if (user.role === "NOTIFICATIONER" || user.role === "USER") {
      return navSections
        .map((s) => ({
          ...s,
          items: s.items.filter((i) => i.key === "dashboard"),
        }))
        .filter((s) => s.items.length > 0)
    }
    return navSections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => !i.adminOnly || isSuperAdmin),
      }))
      .filter((s) => s.items.length > 0)
  }, [inProfileArea, user])

  // While booting we render the same Sidebar shell with empty regions, so
  // the persisted collapsed/expanded state applies identically.
  return (
    <Sidebar collapsible="offcanvas" className="border-e-0!" {...props}>
      <SidebarHeader className="p-0">
        {!booting && <SidebarProfileHeader />}
      </SidebarHeader>
      <SidebarContent className="pt-4">
        {!booting && (
          <SidebarDrillDownNav
            sections={sections}
            back={
              inProfileArea
                ? { href: "/", label: "بازگشت به داشبورد" }
                : undefined
            }
          />
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
