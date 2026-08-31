"use client"

import * as React from "react"
import { Minus } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

// ─── Action cards (Vercel-style banners below the links) ─────────────────────

type ActionCardData = {
  id: string
  title: string
  body: string
  cta: string
  tone: "amber" | "sky"
}

const initialActionCards: ActionCardData[] = [
  {
    id: "low-stock",
    title: "موجودی انبار کم است",
    body: "۴ محصول به آستانه موجودی رسیده‌اند؛ همین امروز سفارش خرید ثبت کنید.",
    cta: "مشاهده محصولات",
    tone: "amber",
  },
  {
    id: "monthly-report",
    title: "گزارش ماهانه آماده است",
    body: "خلاصه عملکرد مرداد با رشد ۱۲٪ درآمد آماده مشاهده است.",
    cta: "مشاهده گزارش",
    tone: "sky",
  },
]

const cardTone: Record<
  ActionCardData["tone"],
  {
    icon: React.ComponentType<{ className?: string }>
    chip: string
    borderTo: string
  }
> = {
  amber: {
    icon: ({ className }) => (
      <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
        <path d="M8.56.5c.57 0 1.1.33 1.35.85l5.9 12.22a1 1 0 0 1-.9 1.43H1.09a1 1 0 0 1-.9-1.43L6.1 1.35A1.5 1.5 0 0 1 7.44.5zM8 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-.75-1.25h1.5v-4h-1.5z" />
      </svg>
    ),
    chip: "text-amber-600 dark:text-amber-400",
    borderTo: "gradient-border-to-amber-500",
  },
  sky: {
    icon: ({ className }) => (
      <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1m.75 3v4.5h-1.5V4zm0 8.5h-1.5V11h1.5z" />
      </svg>
    ),
    chip: "text-sky-600 dark:text-sky-400",
    borderTo: "gradient-border-to-sky-500",
  },
}

// Gradient starts at the theme border color and ends in the card's tone.
const cardBorder =
  "gradient-border gradient-border-to-r gradient-border-from-border"

function ActionCardShell({
  card,
  className,
  children,
}: {
  card: ActionCardData
  className?: string
  children: React.ReactNode
}) {
  const tone = cardTone[card.tone]
  return (
    <div
      className={cn(
        "group/card relative rounded-lg bg-background p-2.5",
        cardBorder,
        tone.borderTo,
        className
      )}
    >
      {children}
    </div>
  )
}

function ActionCardBody({
  card,
  onDismiss,
}: {
  card: ActionCardData
  onDismiss?: (id: string) => void
}) {
  const tone = cardTone[card.tone]
  return (
    <>
      {onDismiss && (
        <button
          type="button"
          aria-label="رد کردن"
          onClick={() => onDismiss(card.id)}
          className="absolute end-1 top-1 flex size-5 items-center justify-center text-muted-foreground opacity-100 transition-opacity duration-150 group-hover/card:opacity-100 hover:text-foreground focus-visible:opacity-100 lg:opacity-0"
        >
          <Minus className="size-3" />
        </button>
      )}

      <div className="flex items-center gap-2">
        <tone.icon className={cn("size-4 shrink-0", tone.chip)} />
        <span className="min-w-0 flex-1 truncate pe-4 text-xs font-medium">
          {card.title}
        </span>
      </div>
      <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
        {card.body}
      </p>
      <button
        type="button"
        className="mt-2 h-7 w-full rounded-md bg-foreground px-2 text-[11px] font-medium text-background transition-colors hover:bg-foreground/90"
      >
        {card.cta}
      </button>
    </>
  )
}

export function ActionCards() {
  const [cards, setCards] = React.useState(initialActionCards)

  const dismiss = (id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id))
  }

  const card = cards[0]
  const stacked = cards.slice(1, 3)

  return (
    <div className="px-2 pb-5">
      <div className="relative">
        {/* Toast-style stack: upcoming cards sit behind the active one,
            scaled down and nudged down so only their bottom edge peeks out. */}
        {stacked.map((next, index) => (
          <div
            key={next.id}
            aria-hidden="true"
            className={cn(
              "gradient-border-to-transparent gradient-border gradient-border-from-border/80 gradient-border-to-r pointer-events-none absolute inset-0 origin-top rounded-lg bg-background",
              cardTone[next.tone].borderTo
            )}
            style={{
              zIndex: 1 - index,
              transform: `translateY(${(index + 1) * 8}px) scale(${1 - (index + 1) * 0.05})`,
              opacity: 1 - (index + 1) * 0.2,
            }}
          />
        ))}

        {card && (
          <ActionCardShell card={card} className="relative z-10">
            <ActionCardBody card={card} onDismiss={dismiss} />
          </ActionCardShell>
        )}
      </div>
    </div>
  )
}
