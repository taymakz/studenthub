"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import type { NotificationBatch } from "@/services/notifications.service"
import { GreetingConfigCompact } from "./greeting-config"
import { BatchCard } from "./batch-card"

export function ChangesTab({
  batches,
  batchesLoading,
  detectPending,
  onDetect,
  courseIncludeGreeting,
  setCourseIncludeGreeting,
  courseGreetingTemplate,
  setCourseGreetingTemplate,
  courseIncludeButton,
  setCourseIncludeButton,
  sendingIds,
  onSendNext,
  onDelete,
  onDismiss,
  onStop,
}: {
  batches: NotificationBatch[]
  batchesLoading: boolean
  detectPending: boolean
  onDetect: () => void
  courseIncludeGreeting: boolean
  setCourseIncludeGreeting: (v: boolean) => void
  courseGreetingTemplate: string
  setCourseGreetingTemplate: (v: string) => void
  courseIncludeButton: boolean
  setCourseIncludeButton: (v: boolean) => void
  sendingIds: Set<string>
  onSendNext: (id: string) => void
  onDelete: (id: string) => void
  onDismiss: (id: string) => void
  onStop: (id: string) => void
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">تشخیص تغییرات ارائه</CardTitle>
          <p className="text-xs text-muted-foreground">
            به صورت خودکار همه ترم‌ها بررسی می‌شوند — new.json در برابر old.json،
            سریع و موازی
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <GreetingConfigCompact
            include={courseIncludeGreeting}
            setInclude={setCourseIncludeGreeting}
            template={courseGreetingTemplate}
            setTemplate={setCourseGreetingTemplate}
            includeButton={courseIncludeButton}
            setIncludeButton={setCourseIncludeButton}
            idPrefix="cc"
            greetingLabel="ارسال با سلام شخصی‌سازی شده برای تغییرات دروس"
            buttonLabel="نمایش دکمه «اجرای برنامه» در تغییرات"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {detectPending
                ? "در حال بررسی همه ترم‌ها..."
                : "برای ایجاد دسته‌های جدید بر اساس diff.json بررسی را بزنید — هر new.json فقط یک diff با UUID دارد"}
            </p>
            <Button
              onClick={onDetect}
              disabled={detectPending}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              {detectPending ? "در حال بررسی..." : "بررسی مجدد همه"}
            </Button>
          </div>
          {detectPending && <Progress value={50} className="h-1.5 animate-pulse" />}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">دسته‌های تغییرات دروس</h3>
        {batchesLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            در حال بارگذاری...
          </p>
        ) : batches.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            دسته‌ای وجود ندارد — «بررسی مجدد همه» را بزنید تا diffهای جدید ساخته
            شوند
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {batches.map((b) => (
              <BatchCard
                key={b.id}
                batch={b}
                onSendNext={onSendNext}
                onDelete={onDelete}
                onDismiss={onDismiss}
                onStop={onStop}
                isLoading={sendingIds.has(b.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
