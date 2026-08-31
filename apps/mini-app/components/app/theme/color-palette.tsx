"use client"

import { useState } from "react"
import { Paintbrush } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { SettingsRow } from "./settings-row"
import { COLOR_PALETTES, useColorTheme } from "./use-color-theme"

/** Palette picker - port of the old ColorPalette with inset drawer. */
export default function ColorPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const { colorTheme, setColorTheme } = useColorTheme()
  const activeLabel =
    COLOR_PALETTES.find((t) => t.value === colorTheme)?.label ?? "دانشجویار"

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<Paintbrush className="size-5" />}
            title="پالت رنگ"
            description={`رنگ اصلی اپلیکیشن — ${activeLabel}`}
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>پالت رنگ</DrawerTitle>
          <DrawerDescription>
            انتخاب پالت رنگی اپلیکیشن
            <span className="ms-2 inline-block rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
              رنگ فعلی {activeLabel}
            </span>
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <div className="grid grid-cols-2 gap-3 p-4">
            {COLOR_PALETTES.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-checked={colorTheme === item.value}
                role="radio"
                onClick={() => {
                  setColorTheme(item.value)
                  setIsOpen(false)
                }}
                className={`${item.value} flex items-center justify-between gap-4 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground ring-offset-2 transition-all data-[state=checked]:ring-2 data-[state=checked]:ring-ring`}
                data-state={colorTheme === item.value ? "checked" : "unchecked"}
              >
                {item.label}
              </button>
            ))}
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
