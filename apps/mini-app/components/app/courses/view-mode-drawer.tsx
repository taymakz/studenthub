"use client"

import { LayoutGrid, Rows3 } from "lucide-react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { Card } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"

export function ViewModeDrawer({
  open,
  onOpenChange,
  viewMode,
  onViewModeChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewMode: "full" | "simple"
  onViewModeChange: (mode: "full" | "simple") => void
}) {
  const modes: Array<{
    value: "full" | "simple"
    label: string
    description: string
    Icon: typeof LayoutGrid
  }> = [
    {
      value: "full",
      label: "نمایش کامل",
      description: "نمایش تمام جزئیات درس",
      Icon: LayoutGrid,
    },
    {
      value: "simple",
      label: "نمایش ساده",
      description: "فقط نام درس، استاد و کد کلاس",
      Icon: Rows3,
    },
  ]

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>حالت نمایش</DrawerTitle>
          <DrawerDescription>
            انتخاب کنید دروس چگونه نمایش داده شوند
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-2 p-4">
          {modes.map(({ value, label, description, Icon }) => (
            <Card
              key={value}
              onClick={() => {
                onViewModeChange(value)
                onOpenChange(false)
              }}
              className={cn(
                "cursor-pointer p-4 transition-all",
                viewMode === value
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:border-primary/50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="size-5" />
                  <div>
                    <h3 className="text-sm font-semibold">{label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border-2",
                    viewMode === value
                      ? "border-primary"
                      : "border-muted-foreground"
                  )}
                >
                  {viewMode === value && (
                    <div className="size-3 rounded-full bg-primary" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
