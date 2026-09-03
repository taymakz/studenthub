"use client"

import * as React from "react"
import { Send } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogDesktopOnly,
  ResponsiveDialogHeader,
  ResponsiveDialogPanel,
  ResponsiveDialogPopup,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@workspace/ui/components/responsive-alert-dialog"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import { toastManager } from "@workspace/ui/components/toast"

import type { PublicUser } from "@/services/users.service"
import {
  telegramService,
  type TelegramPayload,
} from "@/services/telegram.service"
import { TelegramComposer, type ComposerValue } from "./telegram-composer"

export function SendMessageDialog({
  open,
  onOpenChange,
  user,
  onSent,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  user: PublicUser
  onSent?: () => void
}) {
  const [value, setValue] = React.useState<ComposerValue>({
    text: "",
    parseMode: "MarkdownV2",
    photoUrl: "",
    photoFile: null,
    photoFileId: "",
    videoUrl: "",
    videoFile: null,
    videoFileId: "",
    documentUrl: "",
    documentFile: null,
    documentFileId: "",
    buttons: [],
    disablePreview: true,
  })
  const [includeGreeting, setIncludeGreeting] = React.useState(true)
  const [greetingTemplate, setGreetingTemplate] =
    React.useState("سلام {name} عزیز")
  const [includeButton, setIncludeButton] = React.useState(true)
  const [sending, setSending] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const canSend = value.text.trim().length > 0

  const doSend = async () => {
    if (!canSend) return
    setSending(true)
    const buttons = value.buttons
      .map((r) =>
        r
          .filter((b) => b.text.trim() && b.url.trim())
          .map((b) => ({ text: b.text.trim(), url: b.url.trim() }))
      )
      .filter((r) => r.length > 0)
    const parseMode =
      value.parseMode === "plain"
        ? undefined
        : (value.parseMode as "HTML" | "Markdown" | "MarkdownV2")
    const photoFile = value.photoFile
    const videoFile = value.videoFile
    const documentFile = value.documentFile
    const photoFileId = value.photoFileId.trim() || undefined
    const videoFileId = value.videoFileId.trim() || undefined
    const documentFileId = value.documentFileId.trim() || undefined
    if (photoFile && photoFile.size > 4 * 1024 * 1024) {
      toastManager.add({
        title: "خطا",
        description: "عکس بزرگتر از 4MB است",
        type: "error",
      })
      setSending(false)
      return
    }
    if (videoFile && videoFile.size > 4 * 1024 * 1024) {
      toastManager.add({
        title: "خطا",
        description: "ویدیو بزرگتر از 4MB است",
        type: "error",
      })
      setSending(false)
      return
    }
    if (documentFile && documentFile.size > 4 * 1024 * 1024) {
      toastManager.add({
        title: "خطا",
        description: "فایل بزرگتر از 4MB است",
        type: "error",
      })
      setSending(false)
      return
    }
    const payload: TelegramPayload = {
      chatId: user.id,
      text: value.text.trim(),
      parseMode,
      photoUrl:
        !photoFile && !photoFileId
          ? value.photoUrl.trim() || undefined
          : undefined,
      videoUrl:
        !videoFile && !videoFileId
          ? value.videoUrl.trim() || undefined
          : undefined,
      photoFile: photoFile ?? undefined,
      videoFile: videoFile ?? undefined,
      documentFile: documentFile ?? undefined,
      photoFileId,
      videoFileId,
      documentFileId,
      buttons: buttons.length ? buttons : undefined,
      disablePreview: value.disablePreview,
      includeGreeting,
      greetingTemplate: includeGreeting ? greetingTemplate : undefined,
      includeButton,
    }
    try {
      await telegramService.sendSingle(
        payload as TelegramPayload & { chatId: number }
      )
      toastManager.add({
        title: "پیام ارسال شد",
        description: `به ${user.firstName} ارسال شد`,
        type: "success",
      })
      setConfirmOpen(false)
      onOpenChange(false)
      setValue({
        text: "",
        parseMode: "MarkdownV2",
        photoUrl: "",
        photoFile: null,
        photoFileId: "",
        videoUrl: "",
        videoFile: null,
        videoFileId: "",
        documentUrl: "",
        documentFile: null,
        documentFileId: "",
        buttons: [],
        disablePreview: true,
      })
      onSent?.()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "ارسال ناموفق بود"
      toastManager.add({ title: "خطا", description: msg, type: "error" })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogPopup className="max-h-[92dvh] overflow-hidden sm:max-w-4xl lg:max-w-[960px]">
          <ResponsiveDialogHeader className="pb-3">
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <Send className="size-4" /> ارسال پیام به {user.firstName}{" "}
              {user.lastName ?? ""}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              پیام تکی با پشتیبانی عکس/ویدیو/فایل و دکمه — پیش‌نمایش زنده
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogPanel className="gap-0 p-0">
            <ScrollArea className="max-h-[64dvh]">
              <div className="space-y-4 px-6 pb-6">
                <div className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="greeting-single"
                      checked={includeGreeting}
                      onCheckedChange={(v) => setIncludeGreeting(Boolean(v))}
                    />
                    <Label htmlFor="greeting-single" className="text-xs">
                      ارسال با سلام شخصی‌سازی شده
                    </Label>
                  </div>
                  {includeGreeting && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        قالب سلام — {`{name}`} جای نام می‌نشیند
                      </Label>
                      <Input
                        value={greetingTemplate}
                        onChange={(e) => setGreetingTemplate(e.target.value)}
                        placeholder="سلام {name} عزیز"
                        dir="rtl"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        اگر نام نداشته باشد «دانشجوی عزیز» جایگزین می‌شود —
                        پیش‌نمایش:{" "}
                        {greetingTemplate.replace(
                          "{name}",
                          user.firstName || user.lastName || "دانشجوی عزیز"
                        )}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="button-single"
                      checked={includeButton}
                      onCheckedChange={(v) => setIncludeButton(Boolean(v))}
                    />
                    <Label htmlFor="button-single" className="text-xs">
                      نمایش دکمه «اجرای برنامه»
                    </Label>
                  </div>
                </div>
                <TelegramComposer value={value} onChange={setValue} />
              </div>
            </ScrollArea>
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-6 py-3 sm:flex-row sm:items-center sm:justify-end">
              <ResponsiveDialogDesktopOnly>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={sending}
                >
                  انصراف
                </Button>
              </ResponsiveDialogDesktopOnly>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend || sending}
                className="w-full sm:w-auto sm:min-w-28"
              >
                {sending ? "در حال ارسال..." : "ارسال پیام"}
              </Button>
            </div>
          </ResponsiveDialogPanel>
        </ResponsiveDialogPopup>
      </ResponsiveDialog>

      <ResponsiveAlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              ارسال پیام تأیید شود؟
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              پیام به {user.firstName} ارسال خواهد شد. این عمل قابل بازگشت نیست.
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>انصراف</ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction onClick={doSend} disabled={sending}>
              {sending ? "در حال ارسال..." : "تأیید و ارسال"}
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  )
}

// Reusable big dialog without footer – for broadcast page etc.
export function TelegramComposerDialog({
  open,
  onOpenChange,
  title,
  description,
  value,
  onChange,
  onSend,
  sending,
  sendLabel = "ارسال",
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  title: string
  description?: string
  value: ComposerValue
  onChange: (v: ComposerValue) => void
  onSend: () => void
  sending?: boolean
  sendLabel?: string
}) {
  const canSend = value.text.trim().length > 0
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogPopup className="max-h-[92dvh] overflow-hidden sm:max-w-4xl lg:max-w-[960px]">
          <ResponsiveDialogHeader className="pb-3">
            <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
            {description && (
              <ResponsiveDialogDescription>
                {description}
              </ResponsiveDialogDescription>
            )}
          </ResponsiveDialogHeader>
          <ResponsiveDialogPanel className="gap-0 p-0">
            <ScrollArea className="max-h-[64dvh]">
              <div className="px-6 pb-6">
                <TelegramComposer value={value} onChange={onChange} />
              </div>
            </ScrollArea>
            <div className="flex flex-col-reverse gap-2 border-t border-border bg-muted/20 px-6 py-3 sm:flex-row sm:items-center sm:justify-end">
              <ResponsiveDialogDesktopOnly>
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={!!sending}
                >
                  انصراف
                </Button>
              </ResponsiveDialogDesktopOnly>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend || !!sending}
                className="w-full sm:w-auto sm:min-w-28"
              >
                {sending ? "در حال ارسال..." : sendLabel}
              </Button>
            </div>
          </ResponsiveDialogPanel>
        </ResponsiveDialogPopup>
      </ResponsiveDialog>

      <ResponsiveAlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              تأیید ارسال؟
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              آیا از ارسال این پیام اطمینان دارید؟
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>انصراف</ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogAction
              onClick={() => {
                setConfirmOpen(false)
                onSend()
              }}
              disabled={!!sending}
            >
              {sending ? "در حال ارسال..." : "تأیید و ارسال"}
            </ResponsiveAlertDialogAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  )
}
