"use client"

import { useState } from "react"
import { GraduationCap } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiClient } from "@/lib/request"
import { useProfileStore } from "@/stores/profile-store"
import { SettingsRow } from "@/components/app/theme/settings-row"

function EditRow({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-start transition-colors hover:bg-muted/40"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {value}
        </span>
      </span>
    </button>
  )
}

export function IsLastTermDrawer({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
  hideTrigger,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement | null
  hideTrigger?: boolean
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const onOpenChange = controlledOnOpenChange ?? setInternalOpen
  const qc = useQueryClient()
  const profile = useProfileStore((s) => s.profile)

  const patchMut = useMutation({
    mutationFn: async (input: { isLastTerm: boolean }) =>
      (await apiClient.patch<{ profile: unknown }>("/me/profile", input)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] })
      useProfileStore.getState().refresh()
      onOpenChange(false)
    },
  })

  // For EditRow usage in settings, we need a custom trigger that shows value
  const settingsTrigger = (
    <EditRow
      icon={<GraduationCap className="size-4" />}
      label="ترم آخر"
      value={profile?.isLastTerm ? "بله" : "خیر"}
      onClick={() => onOpenChange(true)}
    />
  )

  const triggerNode = hideTrigger ? null : (trigger ?? settingsTrigger)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {triggerNode && <DrawerTrigger render={triggerNode as any} />}
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>ترم آخر</DrawerTitle>
          <DrawerDescription>آیا ترم آخر هستید؟</DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={patchMut.isPending}
              onClick={() => patchMut.mutate({ isLastTerm: true })}
              className={`flex flex-1 items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                profile?.isLastTerm
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:border-primary/50"
              }`}
            >
              بله
            </button>
            <button
              type="button"
              disabled={patchMut.isPending}
              onClick={() => patchMut.mutate({ isLastTerm: false })}
              className={`flex flex-1 items-center justify-center rounded-xl border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                profile?.isLastTerm === false
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card hover:border-primary/50"
              }`}
            >
              خیر
            </button>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

// For use in settings where we want the EditRow trigger
export function IsLastTermSettingsRow() {
  return <IsLastTermDrawer />
}
