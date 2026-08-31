import { cookies } from "next/headers"

import { AppShell } from "@/components/app-shell"
import { RequireAuth } from "@/components/auth-bootstrap"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Session-cookie PRESENCE is enforced by proxy.ts. This gate additionally
  // catches cookies that exist but are expired/revoked: once /admin/me
  // answers 401 the client redirects to /auth.
  return (
    <RequireAuth>
      <AppLayoutInner>{children}</AppLayoutInner>
    </RequireAuth>
  )
}

async function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar-open")?.value !== "false"

  return <AppShell defaultOpen={defaultOpen}>{children}</AppShell>
}
