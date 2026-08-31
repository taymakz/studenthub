"use client"

import { useState } from "react"
import { CloudRain, Snowflake, X, CircleCheck, Sparkles } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { SettingsRow } from "@/components/app/theme/settings-row"
import { useUIEffect } from "@/hooks/use-ui-effect"

export default function Effects() {
  const [open, setOpen] = useState(false)
  const { effect, setEffect } = useUIEffect()

  const description =
    effect === "snow" ? "برف" : effect === "rain" ? "باران" : "غیر فعال"

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<Sparkles className="size-5" />}
            title="افکت‌ها"
            description={description}
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>افکت‌ها</DrawerTitle>
          <DrawerDescription>
            افکت مورد نظر خود را انتخاب کنید
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <div className="flex flex-col">
            {[
              { value: "none" as const, label: "غیر فعال", Icon: X },
              { value: "snow" as const, label: "برف", Icon: Snowflake },
              { value: "rain" as const, label: "باران", Icon: CloudRain },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setEffect(value)
                  setOpen(false)
                }}
                className="flex items-center px-4 py-5 text-start hover:bg-muted/50"
              >
                <span className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Icon className="size-5 opacity-80" />
                    <p className="text-sm">{label}</p>
                  </span>
                  {effect === value ? (
                    <CircleCheck className="size-5 text-success" />
                  ) : (
                    <span className="text-sm opacity-80">انتخاب</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
