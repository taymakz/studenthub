"use client"

import * as React from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { NotificationBatch } from "@/services/notifications.service"
import { FilterSelect, ALL } from "./filter-select"
import { GreetingConfig } from "./greeting-config"
import { TelegramComposer, type ComposerValue } from "../telegram/telegram-composer"
import { BatchCard } from "./batch-card"

function AudienceFilters({
  filterUni,
  setFilterUni,
  filterMajor,
  setFilterMajor,
  filterGender,
  setFilterGender,
  filterEntrySemester,
  setFilterEntrySemester,
  filterEntryYears,
  setFilterEntryYears,
  uniList,
  majorList,
  yearOptions,
}: {
  filterUni: string[]
  setFilterUni: (v: string[]) => void
  filterMajor: string[]
  setFilterMajor: (v: string[]) => void
  filterGender: string[]
  setFilterGender: (v: string[]) => void
  filterEntrySemester: string[]
  setFilterEntrySemester: (v: string[]) => void
  filterEntryYears: string[]
  setFilterEntryYears: (v: string[]) => void
  uniList: Array<{ slug: string; name: { fa: string } }>
  majorList: Array<{ slug: string; name: { fa: string } }>
  yearOptions: string[]
}) {
  const clearAll = () => {
    setFilterUni([ALL])
    setFilterMajor([ALL])
    setFilterGender([ALL])
    setFilterEntrySemester([ALL])
    setFilterEntryYears([ALL])
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
          <h4 className="text-sm font-medium">فیلتر مخاطبان — چندانتخابی</h4>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            همه = بدون فیلتر
          </span>
        </div>
        <Button variant="ghost" size="xs" onClick={clearAll}>
          پاک کردن
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterSelect
          label="دانشگاه"
          value={filterUni}
          onChange={(nv) => {
            setFilterUni(nv)
            if (!nv.includes(ALL) && nv.length) setFilterMajor([ALL])
          }}
          items={[ALL, ...(uniList as Array<{ slug: string }>).map((u) => u.slug)]}
          getLabel={(item) => {
            if (item === ALL) return ALL
            const uni = uniList.find((u) => u.slug === item)
            return uni?.name?.fa ?? item
          }}
        />
        <FilterSelect
          label="رشته"
          value={filterMajor}
          onChange={setFilterMajor}
          items={[ALL, ...majorList.map((m) => m.slug)]}
          getLabel={(item) => {
            if (item === ALL) return ALL
            const major = majorList.find((m) => m.slug === item)
            return major?.name?.fa ?? item
          }}
        />
        <FilterSelect
          label="جنسیت"
          value={filterGender}
          onChange={setFilterGender}
          items={[ALL, "MALE", "FEMALE"]}
          getLabel={(item) =>
            item === ALL ? ALL : item === "MALE" ? "پسر" : "دختر"
          }
        />
        <FilterSelect
          label="ترم ورود"
          value={filterEntrySemester}
          onChange={setFilterEntrySemester}
          items={[ALL, "MEHR", "BAHMAN", "SUMMER"]}
          getLabel={(item) =>
            item === ALL
              ? ALL
              : item === "MEHR"
                ? "مهر"
                : item === "BAHMAN"
                  ? "بهمن"
                  : "تابستان"
          }
        />
        <div className="sm:col-span-2">
          <FilterSelect
            label="سال ورود"
            value={filterEntryYears}
            onChange={setFilterEntryYears}
            items={[ALL, ...yearOptions]}
          />
        </div>
      </div>
    </div>
  )
}

function BroadcastPreview({
  composer,
  broadcastIncludeGreeting,
  broadcastGreetingTemplate,
  broadcastIncludeButton,
}: {
  composer: ComposerValue
  broadcastIncludeGreeting: boolean
  broadcastGreetingTemplate: string
  broadcastIncludeButton: boolean
}) {
  const hasMedia =
    Boolean(composer.photoFile) ||
    Boolean(composer.photoUrl) ||
    Boolean(composer.photoFileId) ||
    Boolean(composer.videoFile) ||
    Boolean(composer.videoUrl) ||
    Boolean(composer.videoFileId) ||
    Boolean(composer.documentFile) ||
    Boolean(composer.documentFileId)

  const hasButtons = composer.buttons.some((r) => r.some((b) => b.text.trim()))

  return (
    <Card className="overflow-hidden border-0 shadow-xl">
      <div className="flex items-center gap-3 bg-gradient-to-br from-zinc-900 to-zinc-800 p-3 text-white">
        <div className="flex size-8 items-center justify-center rounded-full bg-white/10">
          ◈
        </div>
        <div className="min-w-0">
          <p className="text-sm leading-none font-medium">پیش‌نمایش زنده</p>
        </div>
        <Badge className="ms-auto border-white/10 bg-white/10 text-white">
          همگانی
        </Badge>
      </div>
      <CardContent className="p-0">
        <div className="bg-[#e7f0e4] p-4 dark:bg-[#0f1a12]">
          <div className="mx-auto max-w-[360px]">
            <div className="overflow-hidden rounded-2xl bg-white shadow-lg dark:bg-zinc-900">
              {hasMedia && (
                <div className="flex items-center gap-3 bg-muted p-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-xs text-primary">
                    رسانه
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-xs font-medium">
                      پیش‌نمایش رسانه
                    </p>
                    <p className="font-sans text-[10px] text-muted-foreground">
                      تا ۴MB
                    </p>
                  </div>
                </div>
              )}
              <div className="px-4 py-3">
                {broadcastIncludeGreeting ? (
                  <p
                    className="font-sans text-[13px] leading-6 break-words whitespace-pre-wrap"
                    dir="auto"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {broadcastGreetingTemplate.replace("{name}", "دانشجوی عزیز")}
                    <span className="text-muted-foreground">{"\n\n"}</span>
                    {composer.text.trim() || (
                      <span className="text-muted-foreground">
                        متن پیام اینجا نمایش داده می‌شود…
                      </span>
                    )}
                  </p>
                ) : (
                  <p
                    className="font-sans text-[13px] leading-6 break-words whitespace-pre-wrap"
                    dir="auto"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {composer.text.trim() || (
                      <span className="text-muted-foreground">
                        متن پیام اینجا نمایش داده می‌شود…
                      </span>
                    )}
                  </p>
                )}
                {hasButtons && (
                  <div className="mt-3 grid gap-1.5">
                    {composer.buttons.map((row, ri) => (
                      <div
                        key={ri}
                        className="grid gap-1.5"
                        style={{
                          gridTemplateColumns: `repeat(${row.length}, minmax(0,1fr))`,
                        }}
                      >
                        {row.map((b, ci) =>
                          b.text.trim() ? (
                            <span
                              key={ci}
                              className="truncate rounded-full bg-[#e8f0fe] px-3 py-1.5 text-center font-sans text-xs font-medium text-[#0b57d0] dark:bg-zinc-800 dark:text-zinc-100"
                            >
                              {b.text}
                            </span>
                          ) : null
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {broadcastIncludeButton && (
                  <div className="mt-3">
                    <span className="block w-full rounded-full bg-[#e8f0fe] px-3 py-2 text-center font-sans text-xs font-medium text-[#0b57d0] dark:bg-zinc-800 dark:text-zinc-100">
                      اجرای برنامه
                    </span>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-3 text-center font-sans text-[11px] text-muted-foreground">
              ۳۰ پیام در ثانیه • هر ۳۰ با یک تراکنش ذخیره می‌شود
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BatchGrid({
  batches,
  sendingIds,
  onSendNext,
  onDelete,
  onDismiss,
  onStop,
}: {
  batches: NotificationBatch[]
  sendingIds: Set<string>
  onSendNext: (id: string) => void
  onDelete: (id: string) => void
  onDismiss: (id: string) => void
  onStop: (id: string) => void
}) {
  if (batches.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            هنوز دسته‌ای نساخته‌اید — بالا پیام را بسازید
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
  )
}

export function AnnouncementsTab({
  isNotificationer,
  batches,
  sendingIds,
  onSendNext,
  onDelete,
  onDismiss,
  onStop,
  composer,
  setComposer,
  filterUni,
  setFilterUni,
  filterMajor,
  setFilterMajor,
  filterGender,
  setFilterGender,
  filterEntrySemester,
  setFilterEntrySemester,
  filterEntryYears,
  setFilterEntryYears,
  yearOptions,
  uniList,
  majorList,
  broadcastIncludeGreeting,
  setBroadcastIncludeGreeting,
  broadcastGreetingTemplate,
  setBroadcastGreetingTemplate,
  broadcastIncludeButton,
  setBroadcastIncludeButton,
  broadcastSending,
  onBroadcast,
}: {
  isNotificationer: boolean
  batches: NotificationBatch[]
  sendingIds: Set<string>
  onSendNext: (id: string) => void
  onDelete: (id: string) => void
  onDismiss: (id: string) => void
  onStop: (id: string) => void
  composer: ComposerValue
  setComposer: (v: ComposerValue) => void
  filterUni: string[]
  setFilterUni: (v: string[]) => void
  filterMajor: string[]
  setFilterMajor: (v: string[]) => void
  filterGender: string[]
  setFilterGender: (v: string[]) => void
  filterEntrySemester: string[]
  setFilterEntrySemester: (v: string[]) => void
  filterEntryYears: string[]
  setFilterEntryYears: (v: string[]) => void
  yearOptions: string[]
  uniList: Array<{ slug: string; name: { fa: string } }>
  majorList: Array<{ slug: string; name: { fa: string } }>
  broadcastIncludeGreeting: boolean
  setBroadcastIncludeGreeting: (v: boolean) => void
  broadcastGreetingTemplate: string
  setBroadcastGreetingTemplate: (v: string) => void
  broadcastIncludeButton: boolean
  setBroadcastIncludeButton: (v: boolean) => void
  broadcastSending: boolean
  onBroadcast: () => void
}) {
  if (isNotificationer) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          دسترسی به بخش همگانی فقط برای ادمین و سوپرادمین است
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
      <div className="space-y-6">
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="pb-4">
            <div>
              <CardTitle className="text-[15px] leading-none">
                استودیو پیام همگانی
              </CardTitle>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                پیام حرفه‌ای با پیش‌نمایش زنده — فیلتر دقیق، شخصی‌سازی و زمان‌بندی
                ۳۰/ثانیه
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <AudienceFilters
              filterUni={filterUni}
              setFilterUni={setFilterUni}
              filterMajor={filterMajor}
              setFilterMajor={setFilterMajor}
              filterGender={filterGender}
              setFilterGender={setFilterGender}
              filterEntrySemester={filterEntrySemester}
              setFilterEntrySemester={setFilterEntrySemester}
              filterEntryYears={filterEntryYears}
              setFilterEntryYears={setFilterEntryYears}
              uniList={uniList}
              majorList={majorList}
              yearOptions={yearOptions}
            />
            <GreetingConfig
              include={broadcastIncludeGreeting}
              setInclude={setBroadcastIncludeGreeting}
              template={broadcastGreetingTemplate}
              setTemplate={setBroadcastGreetingTemplate}
              includeButton={broadcastIncludeButton}
              setIncludeButton={setBroadcastIncludeButton}
              idPrefix="bc"
              greetingLabel="سلام شخصی‌سازی شده"
              buttonLabel="دکمه «اجرای برنامه»"
              showHint
            />
            <div className="rounded-xl border-2 border-dashed border-primary/20 bg-primary/[0.03] p-2">
              <TelegramComposer value={composer} onChange={setComposer} />
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                {composer.text.trim().length > 0
                  ? `${composer.text.trim().length} حرف • Vazir`
                  : "متن را بنویسید — پیش‌نمایش زنده در سمت چپ"}
              </p>
              <Button
                onClick={onBroadcast}
                disabled={broadcastSending || !composer.text.trim()}
                className="min-w-32 shadow-md"
                size="lg"
              >
                {broadcastSending ? "در حال ایجاد..." : "ایجاد دسته همگانی"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2 text-sm">
            <div className="size-2 animate-pulse rounded-full bg-primary" />
            <span className="font-medium">دسته‌های همگانی</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {batches.length.toLocaleString("fa-IR")}
            </Badge>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            ۳۰ پیام/ثانیه • توقف‌پذیر
          </span>
        </div>
        <BatchGrid
          batches={batches}
          sendingIds={sendingIds}
          onSendNext={onSendNext}
          onDelete={onDelete}
          onDismiss={onDismiss}
          onStop={onStop}
        />
      </div>

      <div className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
        <BroadcastPreview
          composer={composer}
          broadcastIncludeGreeting={broadcastIncludeGreeting}
          broadcastGreetingTemplate={broadcastGreetingTemplate}
          broadcastIncludeButton={broadcastIncludeButton}
        />
      </div>
    </div>
  )
}
