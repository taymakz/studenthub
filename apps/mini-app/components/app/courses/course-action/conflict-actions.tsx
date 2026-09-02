"use client"

import { Button } from "@workspace/ui/components/button"
import { toastManager } from "@workspace/ui/components/toast"

import { apiClient } from "@/lib/request"
import { useProfileStore } from "@/stores/profile-store"
import type { CourseConflict } from "./../conflicts"

function PreReqArrayActions({ group }: { group: CourseConflict }) {
  if (
    group.type !== "pre_requisites" ||
    !group.preRequisiteName ||
    group.preRequisiteName.startsWith("حداقل") ||
    !group.isArrayPreReq
  )
    return null
  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">
        '{group.preRequisiteName}' رو
      </p>
      <Button
        className="w-full"
        variant="success"
        onClick={() => {
          useProfileStore.getState().togglePassed(group.preRequisiteName!)
          toastManager.add({ type: "success", title: "به پاس‌شده اضافه شد", data: { variant: "x" } })
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
          if (!st.failed.some((f) => f.courseName === name)) {
            st.setFailed([...st.failed.map((f) => f.courseName), name])
          }
          const preOffering = st.offerings.find((o) => o.courseName?.trim() === name.trim())
          if (preOffering) st.toggleNote(preOffering.index)
          toastManager.add({ type: "success", title: "به مردودی و یادداشت اضافه شد", data: { variant: "x" } })
        }}
      >
        <span>حداقل یکبار مردود شدم</span>
        <span className="text-xs opacity-80">اضافه کردن به یادداشت</span>
      </Button>
    </div>
  )
}

function CoReqActions({ group }: { group: CourseConflict }) {
  if (group.type !== "co_requisites" || !group.coRequisiteName) return null
  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">'{group.coRequisiteName}' رو</p>
      <Button
        className="w-full"
        variant="success"
        onClick={() => {
          useProfileStore.getState().togglePassed(group.coRequisiteName!)
          toastManager.add({ type: "success", title: "به پاس‌شده اضافه شد", data: { variant: "x" } })
        }}
      >
        پاس شدم
      </Button>
      <Button
        className="w-full"
        variant="outline"
        onClick={() => {
          const co = useProfileStore.getState().offerings.find((o) => o.courseName?.trim() === group.coRequisiteName?.trim())
          if (co) {
            useProfileStore.getState().toggleNote(co.index)
            toastManager.add({ type: "success", title: "به یادداشت اضافه شد", data: { variant: "x" } })
          } else {
            toastManager.add({ type: "error", title: "درس هم‌نیاز در دروس این نیم‌سال موجود نیست", data: { variant: "x" } })
          }
        }}
      >
        به یادداشتم اضافه کن
      </Button>
    </div>
  )
}

function MoarefActions({ group, isLastTerm }: { group: CourseConflict; isLastTerm?: boolean }) {
  if (group.type !== "moaref" || isLastTerm) return null
  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">ترم آخر هستید؟</p>
      <div className="flex gap-2">
        <MoarefButton isLastTermValue={true} />
        <MoarefButton isLastTermValue={false} />
      </div>
    </div>
  )
}

function MoarefButton({ isLastTermValue }: { isLastTermValue: boolean }) {
  return (
    <Button
      className="flex-1"
      variant="outline"
      onClick={async () => {
        await apiClient.patch("/me/profile", { isLastTerm: isLastTermValue })
        await useProfileStore.getState().refresh()
        toastManager.add({
          type: "success",
          title: isLastTermValue ? "ترم آخر ثبت شد" : "ترم آخر لغو شد",
          data: { variant: "x" },
        })
      }}
    >
      {isLastTermValue ? "بله" : "خیر"}
    </Button>
  )
}

function TermChangeAction({
  group,
  profileTerm,
  onOpen,
}: {
  group: CourseConflict
  profileTerm: number | null | undefined
  onOpen: () => void
}) {
  if (group.type !== "pre_requisites" || !group.preRequisiteName?.startsWith("گذراندن")) return null
  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">
        ترم فعلی شما {profileTerm ?? "—"} — برای رفع این پیش‌نیاز ترم خود را تغییر دهید
      </p>
      <Button className="w-full" variant="outline" onClick={onOpen}>
        تغییر ترم
      </Button>
    </div>
  )
}

export function ConflictGroupCard({
  group,
  isLastTerm,
  profileTerm,
  onTermOpen,
}: {
  group: CourseConflict
  isLastTerm?: boolean
  profileTerm?: number | null
  onTermOpen: () => void
}) {
  return (
    <div key={group.id} className="space-y-2 rounded-lg border p-3">
      <p className="text-center text-xs font-medium text-warning">{group.reason}</p>
      <PreReqArrayActions group={group} />
      <CoReqActions group={group} />
      <MoarefActions group={group} isLastTerm={isLastTerm} />
      <TermChangeAction group={group} profileTerm={profileTerm} onOpen={onTermOpen} />
    </div>
  )
}
