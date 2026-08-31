import Link from "next/link"

import { Card } from "@workspace/ui/components/card"
import { BadgePercent } from "reicon/icons/BadgePercent"
import { BagShopping } from "reicon/icons/BagShopping"
import { Box } from "reicon/icons/Box"
import { ChartBarTrendUp } from "reicon/icons/ChartBarTrendUp"
import { Tuning2 } from "reicon/icons/Tuning2"
import { Users } from "reicon/icons/Users"

const quickActions = [
  {
    href: "/products",
    title: "محصولات",
    description: "مدیریت کاتالوگ فروشگاه",
    icon: Box,
  },
  {
    href: "/orders",
    title: "سفارش‌ها",
    description: "پیگیری و ارسال سفارش‌ها",
    icon: BagShopping,
  },
  {
    href: "/customers",
    title: "مشتریان",
    description: "حساب خریداران",
    icon: Users,
  },
  {
    href: "/discounts",
    title: "تخفیف‌ها",
    description: "کدها و کمپین‌های تخفیف",
    icon: BadgePercent,
  },
  {
    href: "/analytics",
    title: "تحلیل‌ها",
    description: "گزارش فروش و بازدید",
    icon: ChartBarTrendUp,
  },
  {
    href: "/settings",
    title: "تنظیمات",
    description: "پیکربندی فروشگاه",
    icon: Tuning2,
  },
]

/** First dashboard row: six shortcut cards into the store sections. */
export function QuickActions() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {quickActions.map((action) => (
        <Link className="group" href={action.href} key={action.href}>
          <Card className="h-full gap-2 px-4 py-4 transition-colors group-hover:bg-foreground/[0.02]">
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted/60 transition-colors group-hover:bg-foreground/[0.06]">
              <span
                aria-hidden="true"
                className="inline-flex text-muted-foreground transition-colors group-hover:text-foreground [&_svg]:size-3.5"
                dangerouslySetInnerHTML={{
                  __html: action.icon.toSvg({ size: 14 }),
                }}
              />
            </div>
            <div>
              <p className="text-xs font-medium">{action.title}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {action.description}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
