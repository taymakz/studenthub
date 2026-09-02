"use client"

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import type { OfferingUpdated } from "@/lib/api"

export function ChangedCarousel({
  items,
  onOpen,
}: {
  items: OfferingUpdated[]
  onOpen?: (item: OfferingUpdated) => void
}) {
  const single = items.length === 1
  return (
    <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
      <CarouselContent className="ms-0">
        {items.map((item) => (
          <CarouselItem
            key={item.after.index}
            className={cn("px-2 py-2", single ? "basis-full" : "basis-[91%]")}
          >
            <ChangedCard item={item} onOpen={() => onOpen?.(item)} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden" />
      <CarouselNext className="hidden" />
    </Carousel>
  )
}

function ChangedCard({
  item,
  onOpen,
}: {
  item: OfferingUpdated
  onOpen?: () => void
}) {
  return (
    <Card
      className="min-h-20 cursor-pointer gap-1.5 p-3 ring-info/40"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{item.after.courseName}</p>
          <p className="text-xs text-muted-foreground">
            {item.after.courseCode}
          </p>
        </div>
        <span className="shrink-0 rounded bg-info/10 px-2 py-0.5 text-xs text-info">
          تغییر
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {item.changes.map((ch) => (
          <span
            key={ch.field}
            className="rounded bg-info/10 px-2 py-0.5 text-info"
          >
            {ch.label}
          </span>
        ))}
      </div>
    </Card>
  )
}
