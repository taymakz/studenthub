"use client"

import { Ring } from "@workspace/ui/components/charts/ring"
import { RingCenter } from "@workspace/ui/components/charts/ring-center"
import { RingChart } from "@workspace/ui/components/charts/ring-chart"
import { faPercent } from "@/lib/format"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { UniversityShare } from "@/services/dashboard.service"

const RING_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
]

/** Channel-breakdown card, now showing REAL university user share:
    top 4 universities + «سایر». */
export function ChannelsRingCard({
  universities,
}: {
  universities: UniversityShare[] | null
}) {
  // Top 4 + aggregate the rest into «سایر».
  const withRest = (() => {
    if (!universities) return null
    if (universities.length <= 4) return universities
    const top = universities.slice(0, 4)
    const restCount = universities.slice(4).reduce((sum, u) => sum + u.count, 0)
    return [...top, { slug: "others", name: "سایر", count: restCount }]
  })()

  const channels =
    withRest?.map((u, index) => ({
      name: u.name,
      value: u.count,
      maxValue: Math.max(...withRest.map((x) => x.count)),
      color: RING_COLORS[index % RING_COLORS.length],
    })) ?? null

  const total = channels?.reduce((sum, channel) => sum + channel.value, 0) ?? 0

  return (
    <Card className="flex h-[320px] w-full flex-col gap-0 py-0">
      <CardHeader className="px-4 py-2">
        <CardTitle className="text-xs text-muted-foreground">
          کانال‌های ورودی
        </CardTitle>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 pb-3">
        {channels && channels.length > 0 && total > 0 ? (
          <>
            <RingChart
              data={channels.map(({ name, value, maxValue, color }) => ({
                label: name,
                value,
                maxValue,
                color,
              }))}
              size={150}
            >
              {channels.map((channel, index) => (
                <Ring
                  color={channel.color}
                  index={index}
                  key={channel.name}
                  lineCap="round"
                  showGlow
                />
              ))}
              <RingCenter
                defaultLabel="کل کاربران"
                formatOptions={{ maximumFractionDigits: 0 }}
                labelClassName="mt-0 text-[11px]"
                valueClassName="text-xl font-semibold leading-none tracking-tight"
              />
            </RingChart>

            <ul className="w-full max-w-[220px] space-y-1">
              {channels.map((channel) => {
                const share = Math.round((channel.value / total) * 100)
                return (
                  <li
                    className="flex items-center gap-2 text-xs"
                    key={channel.name}
                  >
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: channel.color }}
                    />
                    <span className="truncate text-muted-foreground">
                      {channel.name}
                    </span>
                    <span className="ms-auto font-medium">
                      {faPercent(share)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            هنوز کاربری با دانشگاه ثبت‌شده وجود ندارد
          </p>
        )}
      </CardContent>
    </Card>
  )
}
