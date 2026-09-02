"use client"

import { useState } from "react"
import { Check, Copy, Eye } from "lucide-react"
import { Drawer, DrawerDescription, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle } from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import type { Offering } from "@/lib/api"
import { courseLine, escapeHtml } from "./../sections"

export function NotedExportDrawer({ open, onOpenChange, offerings }: { open: boolean; onOpenChange: (o: boolean) => void; offerings: Offering[] }) {
  const [copiedFull, setCopiedFull] = useState(false)
  const [copiedNameUnit, setCopiedNameUnit] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [previewType, setPreviewType] = useState<"full" | "nameUnit" | "code" | null>(null)

  const getFullText = () => offerings.map((o) => courseLine(o, "full")).join("\n\n")
  const getNameUnitText = () => offerings.map((o) => courseLine(o, "nameUnit")).join("\n")
  const getCodeText = () => offerings.map((o) => courseLine(o, "code")).join(", ")
  const getPreviewContent = (type: "full" | "nameUnit" | "code") => {
    let content = type === "full" ? getFullText() : type === "nameUnit" ? getNameUnitText() : getCodeText()
    return escapeHtml(content).replace(/\n/g, "<br>")
  }

  return (
    <>
      <Drawer open={open && !previewType} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center"><DrawerTitle>عملیات خروجی</DrawerTitle><DrawerDescription>از این بخش می‌توانید تمامی اطلاعات لیست خود را با فرمت دلخواه خروجی بگیرید</DrawerDescription></DrawerHeader>
          <DrawerPanel className="space-y-2 p-4">
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>{ navigator.clipboard.writeText(getFullText()); setCopiedFull(true); setTimeout(()=>setCopiedFull(false),2000)}}>{copiedFull ? <Check className="size-4"/> : <Copy className="size-4"/>}<span>{copiedFull ? "کپی شد!" : "کل جزئیات همه"}</span></Button><Button variant="blue-subtle" className="text-sm" onClick={()=>setPreviewType("full")}><Eye className="size-4"/>پیش نمایش</Button></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>{ navigator.clipboard.writeText(getNameUnitText()); setCopiedNameUnit(true); setTimeout(()=>setCopiedNameUnit(false),2000)}}>{copiedNameUnit ? <Check className="size-4"/> : <Copy className="size-4"/>}<span>{copiedNameUnit ? "کپی شد!" : "اسم همه + واحد + کد درس"}</span></Button><Button variant="blue-subtle" className="text-sm" onClick={()=>setPreviewType("nameUnit")}><Eye className="size-4"/>پیش نمایش</Button></div>
            <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={()=>{ navigator.clipboard.writeText(getCodeText()); setCopiedCode(true); setTimeout(()=>setCopiedCode(false),2000)}}>{copiedCode ? <Check className="size-4"/> : <Copy className="size-4"/>}<span>{copiedCode ? "کپی شد!" : "کد درس همه"}</span></Button><Button variant="blue-subtle" className="text-sm" onClick={()=>setPreviewType("code")}><Eye className="size-4"/>پیش نمایش</Button></div>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>
      <Drawer open={!!previewType} onOpenChange={()=>setPreviewType(null)}>
        <DrawerPopup variant="inset" showBar><DrawerHeader className="text-center"><DrawerTitle>پیش نمایش {previewType==="full"?"کل جزئیات":previewType==="nameUnit"?"اسم واحد و کد درس":"کد دروس"}</DrawerTitle><DrawerDescription>متن زیر کپی میشود</DrawerDescription></DrawerHeader><DrawerPanel className="p-4"><div className="rounded-md bg-card p-4"><div dangerouslySetInnerHTML={{ __html: previewType ? getPreviewContent(previewType) : "" }} /></div></DrawerPanel></DrawerPopup>
      </Drawer>
    </>
  )
}
