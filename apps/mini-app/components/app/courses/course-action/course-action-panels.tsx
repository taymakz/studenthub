"use client"

import { useState } from "react"
import { Check, Copy, Eye, Share2, Trash2 } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { toastManager } from "@workspace/ui/components/toast"

import type { Offering } from "@/lib/api"
import { TermNumberPicker } from "@/components/app/settings/term-number-picker"
import { courseLine, escapeHtml } from "./../sections"

export function MainActions({
  offering,
  onDelete,
  onExport,
}: {
  offering: Offering
  onDelete: (idx: string) => void
  onExport: () => void
}) {
  return (
    <>
      <Button variant="outline" className="w-full" onClick={onExport}>
        <Copy className="size-4" />
        خروجی
      </Button>
      <div className="flex gap-2">
        <Button
          variant="blue"
          className="flex-1"
          onClick={() => {
            const text = courseLine(offering, "full")
            const miniAppUrl = typeof window !== "undefined" ? window.location.origin : ""
            const url = encodeURIComponent(`${miniAppUrl}/?startapp=cd${offering.courseCode}&mode=fullscreen`)
            const shareLink = `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}`
            window.open(shareLink, "_blank")
          }}
        >
          <Share2 className="size-5" />
          اشتراک گذاری
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={() => {
            onDelete(offering.index)
            toastManager.add({ type: "success", title: "حذف شد از یادداشت‌ها", data: { variant: "x" } })
          }}
        >
          <Trash2 className="size-5" />
          حذف از یادداشت
        </Button>
      </div>
    </>
  )
}

export function ExportPanel({
  offering,
  open,
  onOpenChange,
  previewType,
  setPreviewType,
}: {
  offering: Offering | null
  open: boolean
  onOpenChange: (o: boolean) => void
  previewType: "full" | "nameUnit" | "code" | null
  setPreviewType: (v: "full" | "nameUnit" | "code" | null) => void
}) {
  return (
    <>
      <ExportDrawer
        offering={offering}
        open={open && !previewType}
        onOpenChange={onOpenChange}
        setPreviewType={setPreviewType}
      />
      <PreviewDrawer offering={offering} previewType={previewType} onClose={() => setPreviewType(null)} />
    </>
  )
}

function ExportDrawer({
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

function useStateCopy() {
  const [copied, setCopiedRaw] = useState(false)
  const setCopied = (v: boolean) => {
    setCopiedRaw(v)
    if (v) setTimeout(() => setCopiedRaw(false), 2000)
  }
  return [copied, setCopied] as const
}

function PreviewDrawer({
  offering,
  previewType,
  onClose,
}: {
  offering: Offering | null
  previewType: "full" | "nameUnit" | "code" | null
  onClose: () => void
}) {
  const getPreviewContent = (type: "full" | "nameUnit" | "code", o: Offering) => {
    const content = courseLine(o, type)
    return escapeHtml(content).replace(/\n/g, "<br>")
  }
  return (
    <Drawer open={!!previewType} onOpenChange={() => onClose()}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader className="text-center">
          <DrawerTitle>
            پیش نمایش{" "}
            {previewType === "full" ? "کل جزئیات" : previewType === "nameUnit" ? "اسم واحد و کد درس" : "کد درس"}
          </DrawerTitle>
          <DrawerDescription>متن زیر کپی میشود</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          <div className="rounded-md bg-card p-4">
            <div
              dangerouslySetInnerHTML={{
                __html: previewType && offering ? getPreviewContent(previewType, offering) : "",
              }}
            />
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

export function TermPickerDrawer({
  open,
  onOpenChange,
  value,
  onSelect,
  disabled,
  pendingValue,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  value: number | null
  onSelect: (n: number) => void
  disabled: boolean
  pendingValue: number | null
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>انتخاب ترم</DrawerTitle>
          <DrawerDescription>ترم فعلی خود را انتخاب کنید</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <TermNumberPicker value={value} onSelect={onSelect} disabled={disabled} pendingValue={pendingValue} />
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
