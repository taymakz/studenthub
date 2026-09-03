"use client"

import { useState } from "react"
import { Ban, CircleCheck, UserX, UserCheck } from "lucide-react"

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
import { BlockListDrawer } from "./block-list-drawer"
import { useFriendSettings, usePatchFriendSettings } from "./use-friends-data"

/**
 * Auto-decline setting row — same row UI as the /settings page: a SettingsRow
 * trigger opening an inset drawer with فعال / غیرفعال option rows.
 */
function AutoDeclineRow() {
  const [open, setOpen] = useState(false)
  const settings = useFriendSettings(true)
  const patch = usePatchFriendSettings()

  const autoDecline = settings.data?.autoDecline ?? false
  const description = settings.isLoading
    ? "در حال بارگذاری..."
    : autoDecline
      ? "فعال"
      : "غیر فعال"

  const select = (value: boolean) => {
    if (value === autoDecline || patch.isPending) return
    patch.mutate(value, { onSuccess: () => setOpen(false) })
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<UserX className="size-5" />}
            title="رد خودکار درخواست‌ها"
            description={description}
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>رد خودکار درخواست‌ها</DrawerTitle>
          <DrawerDescription>
            اگر فعال باشد همه درخواست‌های دوستی ورودی خودکار رد می‌شوند؛ شما
            همچنان می‌توانید درخواست بفرستید
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-0">
          <div className="mb-4 flex flex-col">
            <button
              type="button"
              disabled={patch.isPending}
              onClick={() => select(true)}
              className="flex items-center px-4 py-5 hover:bg-muted/50 disabled:opacity-50"
            >
              <span className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <UserX className="size-5 opacity-80" />
                  <p className="text-sm">فعال</p>
                </span>
                {autoDecline ? (
                  <CircleCheck className="size-5 text-success" />
                ) : (
                  <span className="text-sm opacity-80">انتخاب</span>
                )}
              </span>
            </button>
            <button
              type="button"
              disabled={patch.isPending}
              onClick={() => select(false)}
              className="flex items-center px-4 py-5 hover:bg-muted/50 disabled:opacity-50"
            >
              <span className="flex w-full items-center justify-between">
                <span className="flex items-center gap-2">
                  <UserCheck className="size-5 opacity-80" />
                  <p className="text-sm">غیر فعال</p>
                </span>
                {!autoDecline ? (
                  <CircleCheck className="size-5 text-success" />
                ) : (
                  <span className="text-sm opacity-80">انتخاب</span>
                )}
              </span>
            </button>
          </div>
          {patch.isError && (
            <p className="mx-4 mb-4 text-xs text-destructive">
              {(patch.error as Error).message}
            </p>
          )}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}

/** Friends settings tab content — same row UI as /settings. */
export function FriendsSettings() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <AutoDeclineRow />
      <div className="mx-4 border-t" />
      <BlockListDrawer
        trigger={
          <SettingsRow
            icon={<Ban className="size-5" />}
            title="لیست مسدودشده‌ها"
            description="مشاهده و مدیریت کاربران مسدودشده"
          />
        }
      />
    </div>
  )
}
