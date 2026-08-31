import { DashboardBody } from "@/components/dashboard-body"
import { PageHeader } from "@/components/page-header"

export default function Page() {
  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="داشبورد" />
      <DashboardBody />
    </div>
  )
}
