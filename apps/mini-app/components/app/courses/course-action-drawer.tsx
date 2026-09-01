"use client"

import { useState } from "react"
import { Copy, Check, Eye, Share2, Trash2 } from "lucide-react"

import {
  Drawer,
  DrawerPopup,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerPanel,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { toastManager } from "@workspace/ui/components/toast"

import type { Offering } from "@/lib/api"
import { apiClient } from "@/lib/request"
import { useProfileStore } from "@/stores/profile-store"
import { courseLine, escapeHtml } from "./sections"

/** Single-course management drawer (nested/inset), with export + share + delete.
 *  When opened from conflicts, shows conflict-specific actions (pre/co, moaref isLastTerm). */
export function CourseActionDrawer({
  offering,
  open,
  onOpenChange,
  onDelete,
  conflictGroups,
  isLastTerm,
}: {
  offering: Offering | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (courseIndex: string) => void
  conflictGroups?: import("./conflicts").CourseConflict[]
  isLastTerm?: boolean
}) {
  const [exportOpen, setExportOpen] = useState(false)
  const [previewType, setPreviewType] = useState<
    "full" | "nameUnit" | "code" | null
  >(null)
  const [copiedFull, setCopiedFull] = useState(false)
  const [copiedNameUnit, setCopiedNameUnit] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const getPreviewContent = (
    type: "full" | "nameUnit" | "code",
    o: Offering
  ) => {
    let content = ""
    switch (type) {
      case "full":
        content = courseLine(o, "full")
        break
      case "nameUnit":
        content = courseLine(o, "nameUnit")
        break
      case "code":
        content = courseLine(o, "code")
        break
    }
    return escapeHtml(content).replace(/\n/g, "<br>")
  }

  // Find conflict groups for this offering (when opened from conflicts)
  const relatedGroups =
    conflictGroups?.filter((g) =>
      g.courses.some((c) => c.index === offering?.index)
    ) ?? []

  // Always render - control via open prop for smooth animation
  return (
    <>
      <Drawer open={open && !exportOpen} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>مدیریت درس</DrawerTitle>
            <DrawerDescription>
              در این بخش می‌توانید عملیات مختلفی را روی این درس انجام دهید
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-2 p-4">
            {offering && (
              <>
                {/* Conflict-specific actions when opened from conflicts drawer */}
                {relatedGroups.length > 0 ? (
                  <div className="space-y-2">
                    {relatedGroups.map((group) => (
                      <div
                        key={group.id}
                        className="space-y-2 rounded-lg border p-3"
                      >
                        <p className="text-center text-xs font-medium text-warning">
                          {group.reason}
                        </p>
                        {group.type === "pre_requisites" &&
                          group.preRequisiteName &&
                          !group.preRequisiteName.startsWith("حداقل") &&
                          group.isArrayPreReq && (
                            <div className="space-y-2">
                              <p className="text-center text-xs text-muted-foreground">
                                '{group.preRequisiteName}' رو
                              </p>
                              <Button
                                className="w-full"
                                variant="success"
                                onClick={() => {
                                  useProfileStore
                                    .getState()
                                    .togglePassed(group.preRequisiteName!)
                                  toastManager.add({
                                    type: "success",
                                    title: "به پاس‌شده اضافه شد",
                                    data: { variant: "x" },
                                  })
                                }}
                              >
                                پاس شدم
                              </Button>
                              <Button
                                className="w-full flex-col gap-0.5 py-2 leading-tight"
                                variant="destructive"
                                onClick={() => {
                                  const st = useProfileStore.getState()
                                  const name = group.preRequisiteName
                                  if (!name) return
                                  // Ensure the pre-req course is in the failed list — additive
                                  // (don't remove an already-failed pre-req; we only add noted)=
                                  if (!st.failed.some((f) => f.courseName === name)) {
                                    st.setFailed([
                                      ...st.failed.map((f) => f.courseName),
                                      name,
                                    ])
                                  }
                                  // Ensure it's also in the noted list (taken together now) —
                                  // in this conflict, it is guaranteed to be absent from the current
                                  // noted term, so toggleNote adds it rather than removing.
                                  const preOffering = st.offerings.find(
                                    (o) => o.courseName?.trim() === name.trim()
                                  )
                                  if (preOffering) st.toggleNote(preOffering.index)


                                  toastManager.add({
                                    type: "success",
                                    title: "به مردودی و یادداشت اضافه شد",
                                    data: { variant: "x" },
                                  })
                                }}
                              >
                                <span>حداقل یکبار مردود شدم</span>
                                <span className="text-xs opacity-80">اضافه کردن به یادداشت</span>
                              </Button>
                            </div>
                          )}
                        {group.type === "co_requisites" &&
                          group.coRequisiteName && (
                            <div className="space-y-2">
                              <p className="text-center text-xs text-muted-foreground">
                                '{group.coRequisiteName}' رو
                              </p>
                              <Button
                                className="w-full"
                                variant="success"
                                onClick={() => {
                                  useProfileStore
                                    .getState()
                                    .togglePassed(group.coRequisiteName!)
                                  toastManager.add({
                                    type: "success",
                                    title: "به پاس‌شده اضافه شد",
                                    data: { variant: "x" },
                                  })
                                }}
                              >
                                پاس شدم
                              </Button>
                              <Button
                                className="w-full"
                                variant="outline"
                                onClick={() => {
                                  const co = useProfileStore
                                    .getState()
                                    .offerings.find(
                                      (o) =>
                                        o.courseName?.trim() ===
                                        group.coRequisiteName?.trim()
                                    )
                                  if (co) {
                                    useProfileStore
                                      .getState()
                                      .toggleNote(co.index)
                                    toastManager.add({
                                      type: "success",
                                      title: "به یادداشت اضافه شد",
                                      data: { variant: "x" },
                                    })
                                  } else {
                                    toastManager.add({
                                      type: "error",
                                      title:
                                        "درس هم‌نیاز در دروس این نیم‌سال موجود نیست",
                                      data: { variant: "x" },
                                    })
                                  }
                                }}
                              >
                                به یادداشتم اضافه کن
                              </Button>
                            </div>
                          )}
                        {group.type === "moaref" && !isLastTerm && (
                          <div className="space-y-2">
                            <p className="text-center text-xs text-muted-foreground">
                              ترم آخر هستید؟
                            </p>
                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                variant="outline"
                                onClick={async () => {
                                  await apiClient.patch("/me/profile", {
                                    isLastTerm: true,
                                  })
                                  await useProfileStore.getState().refresh()
                                  toastManager.add({
                                    type: "success",
                                    title: "ترم آخر ثبت شد",
                                    data: { variant: "x" },
                                  })
                                }}
                              >
                                بله
                              </Button>
                              <Button
                                className="flex-1"
                                variant="outline"
                                onClick={async () => {
                                  await apiClient.patch("/me/profile", {
                                    isLastTerm: false,
                                  })
                                  await useProfileStore.getState().refresh()
                                  toastManager.add({
                                    type: "success",
                                    title: "ترم آخر لغو شد",
                                    data: { variant: "x" },
                                  })
                                }}
                              >
                                خیر
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => {
                        onDelete(offering.index)
                        toastManager.add({
                          type: "success",
                          title: "حذف شد از یادداشت‌ها",
                          data: { variant: "x" },
                        })
                      }}
                    >
                      <Trash2 className="size-5" />
                      حذف از یادداشت
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        onOpenChange(false)
                        setExportOpen(true)
                      }}
                    >
                      <Copy className="size-4" />
                      خروجی
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant="blue"
                        className="flex-1"
                        onClick={() => {
                          const text = courseLine(offering, "full")
                          const miniAppUrl =
                            typeof window !== "undefined"
                              ? window.location.origin
                              : ""
                          const url = encodeURIComponent(
                            `${miniAppUrl}/?startapp=cd${offering.courseCode}&mode=fullscreen`
                          )
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
                          toastManager.add({
                            type: "success",
                            title: "حذف شد از یادداشت‌ها",
                            data: { variant: "x" },
                          })
                        }}
                      >
                        <Trash2 className="size-5" />
                        حذف از یادداشت
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Export Drawer */}
      <Drawer open={exportOpen && !previewType} onOpenChange={setExportOpen}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>عملیات خروجی</DrawerTitle>
            <DrawerDescription>
              جزئیات درس را در قالب‌های مختلف کپی کنید
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-2 p-4">
            {offering && (
              <>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        courseLine(offering, "full")
                      )
                      setCopiedFull(true)
                      setTimeout(() => setCopiedFull(false), 2000)
                    }}
                  >
                    {copiedFull ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span>{copiedFull ? "کپی شد!" : "کل جزئیات"}</span>
                  </Button>
                  <Button
                    variant="blue-subtle"
                    className="text-sm"
                    onClick={() => setPreviewType("full")}
                  >
                    <Eye className="size-4" />
                    پیش نمایش
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        courseLine(offering, "nameUnit")
                      )
                      setCopiedNameUnit(true)
                      setTimeout(() => setCopiedNameUnit(false), 2000)
                    }}
                  >
                    {copiedNameUnit ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span>
                      {copiedNameUnit ? "کپی شد!" : "اسم + واحد + کد درس"}
                    </span>
                  </Button>
                  <Button
                    variant="blue-subtle"
                    className="text-sm"
                    onClick={() => setPreviewType("nameUnit")}
                  >
                    <Eye className="size-4" />
                    پیش نمایش
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        courseLine(offering, "code")
                      )
                      setCopiedCode(true)
                      setTimeout(() => setCopiedCode(false), 2000)
                    }}
                  >
                    {copiedCode ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span>{copiedCode ? "کپی شد!" : "کد درس"}</span>
                  </Button>
                  <Button
                    variant="blue-subtle"
                    className="text-sm"
                    onClick={() => setPreviewType("code")}
                  >
                    <Eye className="size-4" />
                    پیش نمایش
                  </Button>
                </div>
              </>
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      {/* Preview Drawer */}
      <Drawer open={!!previewType} onOpenChange={() => setPreviewType(null)}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader className="text-center">
            <DrawerTitle>
              پیش نمایش{" "}
              {previewType === "full"
                ? "کل جزئیات"
                : previewType === "nameUnit"
                  ? "اسم واحد و کد درس"
                  : "کد درس"}
            </DrawerTitle>
            <DrawerDescription>متن زیر کپی میشود</DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="p-4">
            <div className="rounded-md bg-card p-4">
              <div
                dangerouslySetInnerHTML={{
                  __html:
                    previewType && offering
                      ? getPreviewContent(previewType, offering)
                      : "",
                }}
              />
            </div>
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>
    </>
  )
}
