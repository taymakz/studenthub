"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Copy, Download, FileIcon, Search, Upload, Send } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { toastManager } from "@workspace/ui/components/toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { PageHeader } from "@/components/page-header"
import { apiClient } from "@/lib/api/client"
import { useAuth } from "@/hooks/use-auth"

type UploadRow = {
  id: string
  userId: number
  kind: string
  status: string
  telegramFileId: string
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  title: string
  description: string | null
  universitySlug: string
  majorSlug: string | null
  createdAt: string
}

async function fetchUploads(status?: string) {
  const qs = status ? `?status=${status}` : ""
  const res = await apiClient.get<{ uploads: UploadRow[] }>(
    `/admin/uploads${qs}`
  )
  return res.data.uploads
}

export default function UploadsPage() {
  const { user: me } = useAuth() as unknown as { user: { role: string } | null }
  const canView = me?.role === "ADMIN" || me?.role === "SUPERADMIN"
  const [status, setStatus] = React.useState<string>("")
  const [q, setQ] = React.useState("")
  const [uploading, setUploading] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const qc = useQueryClient()

  const {
    data: uploads = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin", "uploads", status],
    queryFn: () => fetchUploads(status || undefined),
  })

  const sendToMe = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ sent: boolean }>(
        `/admin/uploads/${id}/send-to-me`
      )
      return res.data
    },
    onSuccess: () =>
      toastManager.add({
        title: "ارسال شد",
        description: "فایل به پی‌وی شما ارسال شد",
        type: "success",
      }),
    onError: (e: unknown) =>
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "ارسال ناموفق",
        type: "error",
      }),
  })

  const handleUpload = async () => {
    if (!file) {
      toastManager.add({
        title: "خطا",
        description: "فایلی انتخاب نشده",
        type: "error",
      })
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toastManager.add({
        title: "خطا",
        description: "فایل بزرگتر از 4MB است",
        type: "error",
      })
      return
    }
    if (!title.trim() || title.trim().length < 3) {
      toastManager.add({
        title: "خطا",
        description: "عنوان حداقل ۳ کاراکتر",
        type: "error",
      })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.set("file", file, file.name)
      fd.set("title", title.trim())
      fd.set("description", description.trim())
      const res = await apiClient.post<{ upload: UploadRow }>(
        "/admin/uploads/direct",
        fd
      )
      toastManager.add({
        title: "آپلود موفق",
        description: "فایل به گروه ذخیره‌سازی ارسال شد",
        type: "success",
      })
      setFile(null)
      setTitle("")
      setDescription("")
      qc.invalidateQueries({ queryKey: ["admin", "uploads"] })
      refetch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "آپلود ناموفق"
      toastManager.add({ title: "خطا", description: msg, type: "error" })
    } finally {
      setUploading(false)
    }
  }

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return uploads
    return uploads.filter((u) =>
      `${u.title} ${u.fileName ?? ""} ${u.telegramFileId} ${u.universitySlug}`
        .toLowerCase()
        .includes(qq)
    )
  }, [uploads, q])

  const copyFileId = async (fid: string) => {
    try {
      await navigator.clipboard.writeText(fid)
      toastManager.add({
        title: "کپی شد",
        description: "fileId کپی شد",
        type: "success",
      })
    } catch {
      toastManager.add({
        title: "خطا",
        description: "کپی ناموفق",
        type: "error",
      })
    }
  }

  if (me && !canView) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="آپلودها / آرشیو" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          دسترسی فقط برای ادمین و سوپرادمین — اطلاع‌رسان فقط می‌تواند فرآیند
          چارت را شروع کند
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="آپلودها / آرشیو">
        <span className="text-xs text-muted-foreground">
          {uploads.length.toLocaleString("fa-IR")} فایل
        </span>
      </PageHeader>

      <div className="space-y-6 p-4 lg:p-6">
        {/* Direct upload (admin) – 4MB to storage group */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4" /> آپلود مستقیم به گروه ذخیره‌سازی (تا
              4MB)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>فایل</Label>
                <Input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="cursor-pointer"
                />
                {file && (
                  <p className="text-xs text-muted-foreground">
                    {file.name} — {(file.size / 1024).toFixed(0)}KB
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  ذخیره در گروه تلگرام `TELEGRAM_UPLOADS_CHAT_ID` (env) — فقط
                  fileId ذخیره می‌شود.
                </p>
              </div>
              <div className="space-y-2">
                <Label>عنوان</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: جزوه ریاضی ۱"
                />
                <Label>توضیحات</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیح کوتاه..."
                  className="min-h-16"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              فایل مستقیم به گروه ذخیره‌سازی تلگرام (`TELEGRAM_UPLOADS_CHAT_ID`)
              ارسال و فقط `fileId` ذخیره می‌شود — آرشیوهای کاربران از مینی‌اپ
              می‌آیند و اینجا فقط بررسی می‌شوند.
            </p>
            <div className="flex justify-end">
              <Button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="gap-1.5"
              >
                {uploading ? (
                  "در حال آپلود..."
                ) : (
                  <>
                    <Upload className="size-4" /> آپلود
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
              <Search className="absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="جستجو عنوان / fileId / دانشگاه..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 pe-8 text-sm"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v === "all" ? "" : (v ?? ""))}
            >
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue placeholder="وضعیت" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="PENDING">در انتظار</SelectItem>
                <SelectItem value="APPROVED">تأیید شده</SelectItem>
                <SelectItem value="ADDED_TO_REGISTRY">افزوده شده</SelectItem>
                <SelectItem value="REJECTED">رد شده</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="ms-auto h-8"
            >
              بروزرسانی
            </Button>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">عنوان</TableHead>
                  <TableHead className="whitespace-nowrap">fileId</TableHead>
                  <TableHead>دانشگاه/رشته</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ</TableHead>
                  <TableHead className="text-end">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      در حال بارگذاری...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      فایلی یافت نشد
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id} className="group">
                      <TableCell className="max-w-[240px]">
                        <div className="flex items-center gap-2">
                          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {u.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {u.fileName ?? "—"}{" "}
                              {u.sizeBytes
                                ? `• ${(u.sizeBytes / 1024).toFixed(0)}KB`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="flex items-center gap-1">
                          <code
                            dir="ltr"
                            className="block max-w-[220px] truncate rounded bg-muted px-1.5 py-1 text-left font-mono text-[11px]"
                          >
                            {u.telegramFileId}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 shrink-0"
                            onClick={() => copyFileId(u.telegramFileId)}
                            aria-label="کپی fileId"
                          >
                            <Copy className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        <span className="font-mono">{u.universitySlug}</span>
                        {u.majorSlug ? (
                          <span className="text-muted-foreground">
                            {" "}
                            / {u.majorSlug}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("fa-IR", {
                          timeZone: "Asia/Tehran",
                        })}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => sendToMe.mutate(u.id)}
                            disabled={sendToMe.isPending}
                          >
                            <Send className="size-3.5" /> ارسال به من
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() =>
                              window.open(
                                `https://t.me/share/url?url=${encodeURIComponent(u.telegramFileId)}`,
                                "_blank"
                              )
                            }
                          >
                            <Download className="size-3.5" /> دریافت
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
