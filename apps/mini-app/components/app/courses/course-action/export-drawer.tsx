"use client"

import { useState } from "react"
import { Check, Copy, Eye } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import type { Offering } from "@/lib/api"
import { courseLine } from "./../course-format"

function useStateCopy() {
  const [copied, setCopiedRaw] = useState(false)
  const setCopied = (v: boolean) => {
    setCopiedRaw(v)
    if (v) setTimeout(() => setCopiedRaw(false), 2000)
  }
  return [copied, setCopied] as const
}

function CopyRow({
  label,
  text,
  onPreview,
}: {
  label: string
  text: string
  onPreview: () => void
}) {
  const [copied, setCopied] = useStateCopy()
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="flex-1"
        onClick={() => {
          navigator.clipboard.writeText(text)
          setCopied(true)
        }}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        <span>{copied ? "کپی شد!" : label}</span>
      </Button>
      <Button variant="blue-subtle" className="text-sm" onClick={onPreview}>
        <Eye className="size-4" />
        پیش نمایش
      </Button>
    </div>
  )
}

function ExportOptions({
  offering,
  setPreviewType,
}: {
  offering: Offering
  setPreviewType: (v: "full" | "nameUnit" | "code" | null) => void
}) {
  return (
    <>
      <CopyRow label="کل جزئیات" text={courseLine(offering, "full")} onPreview={() => setPreviewType("full")} />
      <CopyRow label="اسم + واحد + کد درس" text={courseLine(offering, "nameUnit")} onPreview={() => setPreviewType("nameUnit")} />
      <CopyRow label="کد درس" text={courseLine(offering, "code")} onPreview={() => setPreviewType("code")} />
    </>
  )
}

export function ExportDrawer({
  offering,
  open,
  onOpenChange,
  setPreviewType,
}: {
  offering: Offering | null
  open: boolean
  onOpenChange: (o: boolean) => void
  setPreviewType: (v: "full" | "nameUnit" | "code" | null) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader className="text-center">
          <DrawerTitle>عملیات خروجی</DrawerTitle>
          <DrawerDescription>جزئیات درس را در قالب‌های مختلف کپی کنید</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="space-y-2 p-4">
          {offering && <ExportOptions offering={offering} setPreviewType={setPreviewType} />}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
