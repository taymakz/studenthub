"use client"

import { useState } from "react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Spinner } from "@workspace/ui/components/spinner"

import { useSendRequest } from "./use-friends-data"

/** Add-friend drawer: numeric friend-id input (phone-keypad pattern). */
export function AddFriendDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [value, setValue] = useState("")
  const send = useSendRequest()

  const submit = () => {
    const id = Number.parseInt(value, 10)
    if (!Number.isSafeInteger(id) || id <= 0) return
    send.mutate(id, {
      onSuccess: () => {
        setValue("")
        onOpenChange(false)
      },
    })
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>افزودن دوست</DrawerTitle>
          <DrawerDescription>
            شناسه دوستی دوستت را وارد کن تا درخواست برایش ارسال شود
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          <div className="space-y-3">
            <Input
              dir="ltr"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              placeholder="123456789"
              value={value}
              onChange={(e) =>
                setValue(e.target.value.replace(/\D/g, "").slice(0, 12))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
              }}
              className="text-center font-mono text-lg tracking-widest"
            />
            <Button
              type="button"
              className="w-full"
              disabled={!value || send.isPending}
              onClick={submit}
            >
              {send.isPending ? <Spinner /> : "ارسال درخواست دوستی"}
            </Button>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
