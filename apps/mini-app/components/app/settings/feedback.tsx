"use client"

import { useState } from "react"
import { Bug, Heart, Lightbulb, MessageSquareText } from "lucide-react"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"
import { Button } from "@workspace/ui/components/button"
import { Textarea } from "@workspace/ui/components/textarea"
import { toastManager } from "@workspace/ui/components/toast"

import { SettingsRow } from "@/components/app/theme/settings-row"
import { submitFeedback } from "@/lib/api"
import type { FeedbackKind } from "@/lib/api"

/** Network call with the try/catch hoisted to module scope so the Compiler
    can optimize the component. Returns success. */
async function trySubmitFeedback(
  kind: FeedbackKind,
  message: string
): Promise<boolean> {
  try {
    await submitFeedback({ kind, message })
    return true
  } catch {
    return false
  }
}

const KINDS: {
  id: FeedbackKind
  label: string
  description: string
  Icon: typeof Bug
}[] = [
  {
    id: "BUG",
    label: "گزارش مشکل",
    description: "یک خطا، باگ یا رفتار غیرمنتظره.",
    Icon: Bug,
  },
  {
    id: "SUGGESTION",
    label: "پیشنهاد",
    description: "چیزی که دانشجویار را بهتر می‌کند.",
    Icon: Lightbulb,
  },
  {
    id: "THANKS",
    label: "تشکر",
    description: "از چیزی که خوشتان آمده است؛ حتماً به تیم منتقل می‌شود.",
    Icon: Heart,
  },
]

/**
 * Feedback row on the settings page — opens an inset drawer where the user
 * picks a kind, writes a message, and sends it to the admin review queue.
 * Only the send flow is implemented (no listing anywhere).
 */
export default function Feedback() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<FeedbackKind>("SUGGESTION")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)

  const canSend = message.trim().length >= 3 && !sending

  const handleSend = async () => {
    if (!canSend) return
    setSending(true)
    const ok = await trySubmitFeedback(kind, message.trim())
    if (ok) {
      toastManager.add({
        type: "success",
        title: "بازخورد شما ثبت شد",
        description: "ممنون که کمک می‌کنید دانشجویار بهتر شود 🎉",
        data: { hideClose: false },
      })
      setMessage("")
      setOpen(false)
    } else {
      toastManager.add({
        type: "error",
        title: "ارسال نشد",
        description: "لطفاً چند لحظه بعد دوباره تلاش کنید.",
        data: { hideClose: false },
      })
    }
    setSending(false)
  }

  const placeholder =
    kind === "BUG"
      ? "چه کاری انجام دادید؟ چه چیزی دیدید؟ چه انتظاری داشتید؟"
      : kind === "SUGGESTION"
        ? "چه چیزی بهتر می‌شد؟ به چه کسانی کمک می‌کرد؟"
        : "چه چیزی خوب بود؟"

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <SettingsRow
            icon={<MessageSquareText className="size-5" />}
            title="ارسال بازخورد"
            description="گزارش مشکل، پیشنهاد یا تشکر"
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>ارسال بازخورد</DrawerTitle>
          <DrawerDescription>
            پیام شما به تیم دانشجویار می‌رسد
          </DrawerDescription>
        </DrawerHeader>
        <DrawerPanel>
          <div className="space-y-4 px-1 pb-6">
            {/* Kind selector */}
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map((k) => {
                const active = kind === k.id
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    className={
                      "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors " +
                      (active
                        ? "border-foreground/60 bg-foreground/[0.05]"
                        : "border-border/60 hover:border-foreground/30")
                    }
                  >
                    <k.Icon className="size-4 opacity-80" />
                    <span className="text-xs leading-tight">{k.label}</span>
                  </button>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              {KINDS.find((k) => k.id === kind)?.description}
            </p>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholder}
              className="min-h-32"
              maxLength={5000}
            />

            <Button
              className="w-full"
              onClick={() => void handleSend()}
              loading={sending}
              disabled={!canSend}
            >
              ارسال بازخورد
            </Button>
          </div>
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
