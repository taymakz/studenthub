"use client"

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@workspace/ui/components/carousel"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

import type { Offering } from "@/lib/api"

export function OfferingCarousel({
  items,
  tone,
  onOpen,
}: {
  items: Offering[]
  tone: "added" | "removed"
  onOpen?: (o: Offering) => void
}) {
  const single = items.length === 1
  return (
    <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
      <CarouselContent className="ms-0">
        {items.map((o) => (
          <CarouselItem
            key={o.index}
            className={cn("px-2 py-2", single ? "basis-full" : "basis-[91%]")}
          >
            <SimpleCard offering={o} tone={tone} onOpen={onOpen} />
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden" />
      <CarouselNext className="hidden" />
    </Carousel>
  )
}

function SimpleCard({
  offering,
  tone,
  onOpen,
}: {
  offering: Offering
  tone: "added" | "removed"
  onOpen?: (o: Offering) => void
}) {
  return (
    <Card
      className={cn(
        "min-h-20 gap-1 p-3",
        tone === "added" && "ring-success/40",
        tone === "removed" && "border-destructive/30 ring-destructive/40",
        onOpen && "cursor-pointer"
      )}
      onClick={onOpen ? () => onOpen(offering) : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="line-clamp-1 font-medium">{offering.courseName}</p>
          <p className="text-xs text-muted-foreground">{offering.courseCode}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-xs",
            tone === "added"
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {tone === "added" ? "جدید" : "حذف"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
        {(() => {
          const name =
            typeof offering.professor === "string"
              ? offering.professor
              : (offering.professor as { fa?: string } | null)?.fa
          return name ? <span>استاد: {name}</span> : null
        })()}
        {offering.location && <span>محل: {offering.location}</span>}
      </div>
    </Card>
  )
}
