"use client"

import * as React from "react"
import {
  FileIcon,
  ImageIcon,
  Link2,
  Plus,
  Trash2,
  VideoIcon,
} from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { MAX_UPLOAD_BYTES, validateFileSize } from "@workspace/ui/lib/file"

export type InlineButton = { text: string; url: string }
export type ComposerValue = {
  text: string
  parseMode: "HTML" | "Markdown" | "MarkdownV2" | "plain"
  photoUrl: string
  photoFile: File | null
  photoFileId: string
  videoUrl: string
  videoFile: File | null
  videoFileId: string
  documentFile: File | null
  documentFileId: string
  buttons: InlineButton[][]
  disablePreview: boolean
}

const emptyValue: ComposerValue = {
  text: "",
  parseMode: "MarkdownV2",
  photoUrl: "",
  photoFile: null,
  photoFileId: "",
  videoUrl: "",
  videoFile: null,
  videoFileId: "",
  documentFile: null,
  documentFileId: "",
  buttons: [],
  disablePreview: true,
}

export { MAX_UPLOAD_BYTES, validateFileSize }

export function useComposerState(initial?: Partial<ComposerValue>) {
  const [value, setValue] = React.useState<ComposerValue>({
    ...emptyValue,
    ...initial,
  })
  return [value, setValue] as const
}

// Reusable composer form + preview. No dialog chrome here – so broadcast page can reuse it inline.
export function TelegramComposer({
  value,
  onChange,
}: {
  value: ComposerValue
  onChange: (v: ComposerValue) => void
}) {
  const addRow = () =>
    onChange({ ...value, buttons: [...value.buttons, [{ text: "", url: "" }]] })
  const addButton = (rowIdx: number) => {
    const next = value.buttons.map((r, i) =>
      i === rowIdx ? [...r, { text: "", url: "" }] : r
    )
    onChange({ ...value, buttons: next })
  }
  const updateButton = (
    rowIdx: number,
    colIdx: number,
    patch: Partial<InlineButton>
  ) => {
    const next = value.buttons.map((r, i) =>
      i === rowIdx
        ? r.map((b, j) => (j === colIdx ? { ...b, ...patch } : b))
        : r
    )
    onChange({ ...value, buttons: next })
  }
  const removeButton = (rowIdx: number, colIdx: number) => {
    const next = value.buttons
      .map((r, i) => (i === rowIdx ? r.filter((_, j) => j !== colIdx) : r))
      .filter((r) => r.length > 0)
    onChange({ ...value, buttons: next })
  }
  const removeRow = (rowIdx: number) => {
    onChange({
      ...value,
      buttons: value.buttons.filter((_, i) => i !== rowIdx),
    })
  }

  // Controlled media tab (the only controlled Tabs usage pattern that
  // animates reliably across apps — uncontrolled defaultValue leaves the
  // sliding indicator stuck on mount in this dashboard).
  const [mediaTab, setMediaTab] = React.useState("photo")

  const handleFile = (
    file: File | null,
    type: "photo" | "video" | "document"
  ) => {
    if (!file) return
    const check = validateFileSize(file)
    if (!check.ok) {
      alert(check.error ?? "فایل بزرگتر از 4MB است")
      return
    }
    if (type === "photo")
      onChange({
        ...value,
        photoFile: file,
        videoFile: null,
        documentFile: null,
        photoUrl: "",
        videoUrl: "",
        photoFileId: "",
        videoFileId: "",
        documentFileId: "",
      })
    else if (type === "video")
      onChange({
        ...value,
        videoFile: file,
        photoFile: null,
        documentFile: null,
        photoUrl: "",
        videoUrl: "",
        photoFileId: "",
        videoFileId: "",
        documentFileId: "",
      })
    else
      onChange({
        ...value,
        documentFile: file,
        photoFile: null,
        videoFile: null,
        photoUrl: "",
        videoUrl: "",
        photoFileId: "",
        videoFileId: "",
        documentFileId: "",
      })
  }

  // preview url – file > fileId > url
  const photoPreviewUrl = React.useMemo(() => {
    if (value.photoFile) return URL.createObjectURL(value.photoFile)
    if (value.photoFileId.trim())
      return `fileId:${value.photoFileId.trim().slice(0, 12)}…`
    return value.photoUrl.trim() || null
  }, [value.photoFile, value.photoFileId, value.photoUrl])
  const videoPreviewUrl = React.useMemo(() => {
    if (value.videoFile) return URL.createObjectURL(value.videoFile)
    if (value.videoFileId.trim())
      return `fileId:${value.videoFileId.trim().slice(0, 12)}…`
    return value.videoUrl.trim() || null
  }, [value.videoFile, value.videoFileId, value.videoUrl])
  const documentPreviewName =
    value.documentFile?.name ?? (value.documentFileId.trim() || null)
  React.useEffect(() => {
    return () => {
      if (photoPreviewUrl?.startsWith("blob:"))
        URL.revokeObjectURL(photoPreviewUrl)
      if (videoPreviewUrl?.startsWith("blob:"))
        URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [photoPreviewUrl, videoPreviewUrl])

  const hasPhoto = Boolean(
    value.photoFile || value.photoUrl.trim() || value.photoFileId.trim()
  )
  const hasVideo = Boolean(
    value.videoFile || value.videoUrl.trim() || value.videoFileId.trim()
  )
  const hasDocument = Boolean(value.documentFile || value.documentFileId.trim())
  const mediaUrl =
    photoPreviewUrl || videoPreviewUrl || documentPreviewName || ""
  const mediaType: "photo" | "video" | "document" | "none" = hasPhoto
    ? "photo"
    : hasVideo
      ? "video"
      : hasDocument
        ? "document"
        : "none"

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>متن پیام</Label>
          <Textarea
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            placeholder="سلام! این یک پیام تستی است…

از <b>HTML</b> یا **Markdown** پشتیبانی می‌شود."
            className="min-h-[140px] leading-relaxed"
          />
          <p className="text-xs text-muted-foreground">
            {value.text.length}/4096
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>حالت نمایش</Label>
            <Select
              value={value.parseMode}
              onValueChange={(v) =>
                onChange({
                  ...value,
                  parseMode: v as ComposerValue["parseMode"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HTML">HTML (پیشنهادی)</SelectItem>
                <SelectItem value="Markdown">Markdown</SelectItem>
                <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                <SelectItem value="plain">ساده (بدون فرمت)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="invisible leading-none select-none" aria-hidden>
              ·
            </Label>
            <label
              htmlFor="disable-preview"
              className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium whitespace-nowrap shadow-xs transition-colors hover:bg-muted has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary has-[[data-checked]]:text-primary-foreground has-[[data-checked]]:shadow-sm"
            >
              <Checkbox
                id="disable-preview"
                checked={value.disablePreview}
                onCheckedChange={(v) =>
                  onChange({ ...value, disablePreview: Boolean(v) })
                }
                className="shrink-0"
              />
              بدون پیش‌نمایش لینک
            </label>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label>رسانه (اختیاری — فقط یکی)</Label>
          <Tabs value={mediaTab} onValueChange={setMediaTab} className="w-full">
            <TabsList dir="rtl">
              <TabsTrigger value="photo">تصویر</TabsTrigger>
              <TabsTrigger value="video">ویدیو</TabsTrigger>
              <TabsTrigger value="document">فایل</TabsTrigger>
            </TabsList>

            <TabsContent value="photo" className="mt-4 space-y-3">
              <div className="grid gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleFile(e.target.files?.[0] ?? null, "photo")
                  }
                  className="cursor-pointer"
                />
                <Input
                  value={value.photoUrl}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      photoUrl: e.target.value,
                      photoFile: null,
                      photoFileId: "",
                      videoUrl: "",
                      videoFile: null,
                      videoFileId: "",
                      documentFile: null,
                      documentFileId: "",
                    })
                  }
                  placeholder="https://.../photo.jpg — یا فایل بالا"
                  dir="ltr"
                  className="text-left"
                />
                <Input
                  value={value.photoFileId}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      photoFileId: e.target.value,
                      photoFile: null,
                      photoUrl: "",
                      videoUrl: "",
                      videoFile: null,
                      videoFileId: "",
                      documentFile: null,
                      documentFileId: "",
                    })
                  }
                  placeholder="fileId: AgACAgQAAxkBAAI... — یا لینک/فایل"
                  dir="ltr"
                  className="text-left font-mono text-xs"
                />
                {value.photoFile && (
                  <p className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {value.photoFile.name} —{" "}
                      {(value.photoFile.size / 1024).toFixed(0)}KB
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ ...value, photoFile: null })}
                      className="text-destructive hover:underline"
                    >
                      حذف
                    </button>
                  </p>
                )}
                {value.photoFileId.trim() && (
                  <p className="text-xs text-muted-foreground">
                    fileId: {value.photoFileId.slice(0, 32)}…
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                تا 4MB — فایل مستقیم یا fileId یا لینک. برای همگانی fileId کش
                می‌شود.
              </p>
            </TabsContent>

            <TabsContent value="video" className="mt-4 space-y-3">
              <div className="grid gap-2">
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) =>
                    handleFile(e.target.files?.[0] ?? null, "video")
                  }
                  className="cursor-pointer"
                />
                <Input
                  value={value.videoUrl}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      videoUrl: e.target.value,
                      videoFile: null,
                      videoFileId: "",
                      photoUrl: "",
                      photoFile: null,
                      photoFileId: "",
                      documentFile: null,
                      documentFileId: "",
                    })
                  }
                  placeholder="https://.../video.mp4"
                  dir="ltr"
                  className="text-left"
                />
                <Input
                  value={value.videoFileId}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      videoFileId: e.target.value,
                      videoFile: null,
                      videoUrl: "",
                      photoUrl: "",
                      photoFile: null,
                      photoFileId: "",
                      documentFile: null,
                      documentFileId: "",
                    })
                  }
                  placeholder="fileId: BAACAgQAAxkBAAI... — یا لینک/فایل"
                  dir="ltr"
                  className="text-left font-mono text-xs"
                />
                {value.videoFile && (
                  <p className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {value.videoFile.name} —{" "}
                      {(value.videoFile.size / 1024).toFixed(0)}KB
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ ...value, videoFile: null })}
                      className="text-destructive hover:underline"
                    >
                      حذف
                    </button>
                  </p>
                )}
                {value.videoFileId.trim() && (
                  <p className="text-xs text-muted-foreground">
                    fileId: {value.videoFileId.slice(0, 32)}…
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="document" className="mt-4 space-y-3">
              <div className="grid gap-2">
                <Input
                  type="file"
                  onChange={(e) =>
                    handleFile(e.target.files?.[0] ?? null, "document")
                  }
                  className="cursor-pointer"
                />
                <Input
                  value={value.documentFileId}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      documentFileId: e.target.value,
                      documentFile: null,
                      photoUrl: "",
                      photoFile: null,
                      photoFileId: "",
                      videoUrl: "",
                      videoFile: null,
                      videoFileId: "",
                    })
                  }
                  placeholder="fileId: BQACAgQAAxkBAAI... — یا فایل بالا"
                  dir="ltr"
                  className="text-left font-mono text-xs"
                />
                {value.documentFile && (
                  <p className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {value.documentFile.name} —{" "}
                      {(value.documentFile.size / 1024).toFixed(0)}KB
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange({ ...value, documentFile: null })}
                      className="text-destructive hover:underline"
                    >
                      حذف
                    </button>
                  </p>
                )}
                {value.documentFileId.trim() && (
                  <p className="text-xs text-muted-foreground">
                    fileId: {value.documentFileId.slice(0, 32)}…
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                هر نوع فایل تا 4MB — fileId مستقیم یا فایل؛ برای همگانی یک‌بار
                آپلود و سپس با fileId ارسال می‌شود.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              <Link2 className="size-3.5" /> دکمه‌ها
            </Label>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-3.5" /> ردیف جدید
            </Button>
          </div>
          {value.buttons.length === 0 && (
            <p className="text-xs text-muted-foreground">دکمه‌ای اضافه نشده.</p>
          )}
          <div className="space-y-3">
            {value.buttons.map((row, ri) => (
              <div key={ri} className="rounded-lg border border-border p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">ردیف {ri + 1}</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addButton(ri)}
                    >
                      <Plus className="size-3" /> دکمه
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRow(ri)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  {row.map((b, ci) => (
                    <div
                      key={ci}
                      className="grid grid-cols-[1fr_1.4fr_auto] gap-2"
                    >
                      <Input
                        value={b.text}
                        onChange={(e) =>
                          updateButton(ri, ci, { text: e.target.value })
                        }
                        placeholder="متن دکمه"
                      />
                      <Input
                        value={b.url}
                        onChange={(e) =>
                          updateButton(ri, ci, { url: e.target.value })
                        }
                        placeholder="https://..."
                        dir="ltr"
                        className="text-left"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        onClick={() => removeButton(ri, ci)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <Label>پیش‌نمایش تلگرام</Label>
        <div className="rounded-2xl border border-border bg-[#e7f0e4] p-3 dark:bg-[#0f1a12]">
          <div className="mx-auto max-w-[360px] space-y-2">
            <TelegramPreview
              text={value.text}
              parseMode={value.parseMode}
              mediaUrl={mediaUrl}
              mediaType={mediaType}
              buttons={value.buttons}
            />
            <p className="text-center text-[10px] text-muted-foreground">
              پیش‌نمایش دقیقاً مانند تلگرام نیست اما ساختار پیام یکسان است
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function TelegramPreview({
  text,
  parseMode,
  mediaUrl,
  mediaType,
  buttons,
}: {
  text: string
  parseMode: string
  mediaUrl: string
  mediaType: "photo" | "video" | "document" | "none"
  buttons: InlineButton[][]
}) {
  const hasMedia = Boolean(mediaUrl) && mediaType !== "none"
  const hasText = text.trim().length > 0
  const hasButtons = buttons.some((r) => r.some((b) => b.text.trim()))

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
      {hasMedia && mediaType === "document" && (
        <div className="flex items-center gap-3 bg-muted p-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            📄
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{mediaUrl}</p>
            <p className="text-[10px] text-muted-foreground">سند — تا 4MB</p>
          </div>
        </div>
      )}
      {hasMedia && (mediaType === "photo" || mediaType === "video") && (
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {mediaType === "photo" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt="preview"
              className="h-full w-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <video
              src={mediaUrl}
              className="h-full w-full object-cover"
              controls={false}
              muted
            />
          )}
          <span className="absolute start-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
            {mediaType === "photo" ? "عکس" : "ویدیو"}
          </span>
        </div>
      )}
      {hasText && (
        <div className="px-3.5 py-2.5">
          <p
            className="font-sans text-[13px] leading-6 break-words whitespace-pre-wrap"
            dir="auto"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {parseMode === "HTML" ? (
              <span
                dangerouslySetInnerHTML={{
                  __html: text.replace(/\n/g, "<br/>"),
                }}
              />
            ) : (
              text
            )}
          </p>
        </div>
      )}
      {!hasText && !hasMedia && (
        <div className="px-3.5 py-6 text-center text-xs text-muted-foreground">
          متنی برای نمایش نیست
        </div>
      )}
      {hasButtons && (
        <div className="grid gap-1.5 border-t border-black/5 bg-white p-1.5 dark:bg-zinc-900">
          {buttons.map((row, ri) => (
            <div
              key={ri}
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
              }}
            >
              {row.map((b, ci) =>
                b.text.trim() ? (
                  <span
                    key={ci}
                    className="truncate rounded-full bg-[#e8f0fe] px-3 py-1.5 text-center text-xs font-medium text-[#0b57d0] dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {b.text}
                  </span>
                ) : null
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
