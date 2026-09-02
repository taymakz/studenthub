"use client"

import { useState } from "react"
import { CloudRain, Snowflake, X, Sparkles } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { SettingsRow, SettingsOptionRow } from "@/components/app/theme/settings-row"
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
              <SettingsOptionRow
                key={value}
                icon={Icon}
                label={label}
                selected={effect === value}
                onSelect={() => {
                  setEffect(value)
                  setOpen(false)
                }}
              />
            ))}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
