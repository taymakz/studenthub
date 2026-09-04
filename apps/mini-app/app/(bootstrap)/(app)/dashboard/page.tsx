import {
  Archive,
  BookOpen,
  GraduationCap,
  Megaphone,
  Search,
} from "lucide-react"

import ContentLayout from "@/components/app/content-layout"
import { Badge } from "@workspace/ui/components/badge"
import { LightRays } from "@/components/ui/light-rays"
import ChartDrawer from "./_components/chart-drawer"

const items = [
  {
    to: "/dashboard/vahedyar",
    title: "واحدیار (آزمایشی)",
    Icon: Search,
    color: "text-green-500",
  },
  {
    to: "/dashboard/professors",
    title: "اساتید",
    Icon: GraduationCap,
    color: "text-yellow-500",
  },
  {
    to: "/dashboard/archives",
    title: "آرشیوها",
    Icon: Archive,
    color: "text-orange-500",
  },
  {
    to: "/dashboard/sources",
    title: "منبع‌ها",
    Icon: BookOpen,
    color: "text-red-500",
  },
  {
    to: "/dashboard/social-groups",
    title: "گروه‌ها و کانال‌ها",
    Icon: Megaphone,
    color: "text-blue-500",
  },
]

export default function DashboardPage() {
  return (
    <>
      <div className="relative flex h-70 items-center justify-center safe-top-padding pb-[calc(var(--tg-safe-area-inset-top)+var(--tg-content-safe-area-inset-top))]">
        <h1 className="z-10 font-semibold tracking-[0.35em] text-slate-800/60 uppercase dark:text-slate-200/60">
          Dashboard
        </h1>
        <LightRays />
      </div>
      <ContentLayout>
        <div className="container mx-auto grid grid-cols-4 gap-x-4 gap-y-8 px-4 pt-6">
          {items.map((item) => (
            <div
              key={item.title}
              className="relative flex flex-col items-center gap-3.5 text-center opacity-60"
              aria-disabled
            >
              <div className="relative mx-auto flex aspect-square max-h-32 w-full max-w-32 items-center justify-center rounded-lg border bg-card">
                <item.Icon className={`size-8 ${item.color} opacity-70`} />
                <Badge className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">
                  بزودی
                </Badge>
              </div>
              <div className="w-full text-sm text-muted-foreground">
                {item.title}
              </div>
            </div>
          ))}
          <ChartDrawer />
        </div>
      </ContentLayout>
    </>
  )
}
