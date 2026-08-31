import { Suspense } from "react"
import { cookies } from "next/headers"

import { AppShell } from "@/components/app-shell"
import { BuilderContent } from "@/components/builder-content"
import { ChartDocImport } from "@/components/chart-doc-import"
import { ChartStoreSync } from "@/components/chart-store"
import { PageHeader } from "@/components/page-header"

export default async function Page() {
  return (
    <Suspense fallback={null}>
      <PageInner />
    </Suspense>
  )
}

async function PageInner() {
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar-open")?.value !== "false"

  return (
    <>
      <ChartStoreSync />
      <AppShell defaultOpen={defaultOpen}>
        <div className="flex min-h-full flex-1 flex-col">
          <PageHeader title="ابزار ساخت چارت">
            <ChartDocImport scope="global" />
          </PageHeader>
          <BuilderContent />
        </div>
      </AppShell>
    </>
  )
}
