"use client"

import * as React from "react"

import { useTheme } from "next-themes"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { THEME_OPTIONS } from "@/lib/theme-options"
import { cn } from "@workspace/ui/lib/utils"

// ─── Building blocks (Linear settings list-view style) ────────────────────────

function SettingsSection({
  id,
  title,
  children,
}: {
  id?: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="flex flex-col gap-4">
      <h3 className="text-[0.9375rem] leading-6 font-medium">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

/** One card containing setting rows. Row dividers are drawn on an inner
    element with horizontal margins so they don't touch the card edges. */
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg bg-card">
      <ul className="m-0 list-none p-0 [&>li:last-child>div]:border-b-0">
        {children}
      </ul>
    </div>
  )
}

function SettingsRow({
  label,
  description,
  htmlFor,
  onToggle,
  children,
}: {
  label: string
  description?: React.ReactNode
  htmlFor?: string
  /** Makes the whole row clickable (used to flip switch rows). Clicks on the
      control itself are stopped from bubbling so it doesn't double-toggle. */
  onToggle?: () => void
  children: React.ReactNode
}) {
  return (
    <li>
      {/* mx-4 insets the border so dividers stop short of the edges */}
      <div
        onClick={onToggle}
        className={cn(
          "mx-4 flex min-h-11 items-center justify-between gap-4 border-b border-border py-2.5",
          onToggle && "select-none"
        )}
      >
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <label
            htmlFor={htmlFor}
            className="text-[0.8125rem] leading-normal break-words"
          >
            {label}
          </label>
          {description && (
            <span className="text-xs leading-normal break-words text-muted-foreground">
              {description}
            </span>
          )}
        </div>
        <div
          className="flex min-w-0 shrink-0 justify-end"
          onClick={onToggle ? (e) => e.stopPropagation() : undefined}
        >
          {children}
        </div>
      </div>
    </li>
  )
}

function RowSelect({
  id,
  value,
  onValueChange,
  items,
}: {
  id: string
  value: string
  onValueChange: (value: string) => void
  items: { value: string; label: string }[]
}) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as string)}>
      <SelectTrigger id={id} className="w-fit text-[13px]">
        <SelectValue />
      </SelectTrigger>
      {/* Fit the widest option so labels never wrap onto a second line. */}
      <SelectContent className="w-max min-w-(--anchor-width)">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const homeViews = [
  { value: "dashboard", label: "پیشخوان" },
  { value: "orders", label: "سفارش‌ها" },
  { value: "last-visited", label: "آخرین بازدید" },
]

const displayNames = [
  { value: "full", label: "نام و نام خانوادگی" },
  { value: "first", label: "نام کوچک" },
  { value: "username", label: "نام کاربری" },
]

const weekdays = [
  { value: "saturday", label: "شنبه" },
  { value: "sunday", label: "یکشنبه" },
  { value: "monday", label: "دوشنبه" },
]

const commentKeys = [
  { value: "enter", label: "Enter" },
  { value: "mod-enter", label: "⌘ + Enter" },
]

const fontSizes = [
  { value: "default", label: "پیش‌فرض" },
  { value: "large", label: "بزرگ" },
]

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme()
  const [homeView, setHomeView] = React.useState("dashboard")
  const [displayName, setDisplayName] = React.useState("full")
  const [weekday, setWeekday] = React.useState("saturday")
  const [convertEmoticons, setConvertEmoticons] = React.useState(true)
  const [commentKey, setCommentKey] = React.useState("enter")
  const [fontSize, setFontSize] = React.useState("default")
  const [pointerCursor, setPointerCursor] = React.useState(false)
  const [underlineLinks, setUnderlineLinks] = React.useState(false)
  const [openInDesktop, setOpenInDesktop] = React.useState(false)
  const [autoAssignSelf, setAutoAssignSelf] = React.useState(false)
  const [assignOnStarted, setAssignOnStarted] = React.useState(false)

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col px-6 pt-10 pb-16">
      <h1 className="text-2xl font-semibold tracking-[-0.01rem]">تنظیمات</h1>

      <div className="mt-8 flex flex-col gap-10">
        <SettingsSection id="general" title="عمومی">
          <SettingsCard>
            <SettingsRow
              label="نمای صفحه اصلی"
              description="هنگام باز کردن برنامه، این نما نمایش داده می‌شود"
              htmlFor="pref-home-view"
            >
              <RowSelect
                id="pref-home-view"
                value={homeView}
                onValueChange={setHomeView}
                items={homeViews}
              />
            </SettingsRow>
            <SettingsRow
              label="نحوه نمایش نام‌ها"
              description="نام کاربران در سراسر برنامه به همین شکل نمایش داده می‌شود"
              htmlFor="pref-display-names"
            >
              <RowSelect
                id="pref-display-names"
                value={displayName}
                onValueChange={setDisplayName}
                items={displayNames}
              />
            </SettingsRow>
            <SettingsRow
              label="اولین روز هفته"
              description="در تقویم‌ها و تاریخ‌گیرها استفاده می‌شود"
              htmlFor="pref-first-weekday"
            >
              <RowSelect
                id="pref-first-weekday"
                value={weekday}
                onValueChange={setWeekday}
                items={weekdays}
              />
            </SettingsRow>
            <SettingsRow
              label="تبدیل شکلک‌های متنی به ایموجی"
              description="متن‌هایی مثل :) به 🙂 تبدیل می‌شوند"
              onToggle={() => setConvertEmoticons((v) => !v)}
            >
              <Switch
                id="pref-convert-emoticons"
                checked={convertEmoticons}
                onCheckedChange={setConvertEmoticons}
              />
            </SettingsRow>
            <SettingsRow
              label="ارسال دیدگاه با…"
              description="کلید مورد استفاده برای ثبت دیدگاه‌ها را انتخاب کنید"
              htmlFor="pref-comment-key"
            >
              <RowSelect
                id="pref-comment-key"
                value={commentKey}
                onValueChange={setCommentKey}
                items={commentKeys}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection id="interface-and-theme" title="ظاهر و پوسته">
          <SettingsCard>
            <SettingsRow
              label="نوار کناری برنامه"
              description="ترتیب، پنهان‌سازی و نشان آیتم‌های نوار کناری را تنظیم کنید"
            >
              <span className="text-[13px] text-muted-foreground">
                سفارشی‌سازی
              </span>
            </SettingsRow>
            <SettingsRow
              label="اندازه فونت"
              description="اندازه متن را در سراسر برنامه تغییر دهید"
              htmlFor="pref-font-size"
            >
              <RowSelect
                id="pref-font-size"
                value={fontSize}
                onValueChange={setFontSize}
                items={fontSizes}
              />
            </SettingsRow>
            <SettingsRow
              label="نشانگر از نوع اشاره‌گر"
              description="با قرار گرفتن نشانگر روی عناصر تعاملی، شکل نشانگر تغییر کند"
              onToggle={() => setPointerCursor((v) => !v)}
            >
              <Switch
                id="pref-pointer-cursor"
                checked={pointerCursor}
                onCheckedChange={setPointerCursor}
              />
            </SettingsRow>
            <SettingsRow
              label="زیرخط‌دار کردن پیوندها"
              description="پیوندهای داخل متن همیشه زیرخط داشته باشند"
              onToggle={() => setUnderlineLinks((v) => !v)}
            >
              <Switch
                id="pref-underline-links"
                checked={underlineLinks}
                onCheckedChange={setUnderlineLinks}
              />
            </SettingsRow>
            <SettingsRow
              label="پوسته رابط"
              description="طرح رنگ برنامه را انتخاب کنید"
              htmlFor="pref-theme"
            >
              <RowSelect
                id="pref-theme"
                value={theme ?? "system"}
                onValueChange={setTheme}
                items={THEME_OPTIONS.map(({ value, label }) => ({
                  value,
                  label,
                }))}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection id="desktop-application" title="برنامه دسکتاپ">
          <SettingsCard>
            <SettingsRow
              label="باز کردن در برنامه دسکتاپ"
              description="پیوندها در صورت امکان به‌طور خودکار در برنامه دسکتاپ باز شوند"
              onToggle={() => setOpenInDesktop((v) => !v)}
            >
              <Switch
                id="pref-open-desktop"
                checked={openInDesktop}
                onCheckedChange={setOpenInDesktop}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>

        <SettingsSection
          id="automations-and-workflows"
          title="خودکارسازی و گردش کار"
        >
          <SettingsCard>
            <SettingsRow
              label="تخصیص خودکار به من"
              description="موارد جدید به‌طور پیش‌فرض به خودتان تخصیص یابند"
              onToggle={() => setAutoAssignSelf((v) => !v)}
            >
              <Switch
                id="pref-auto-assign"
                checked={autoAssignSelf}
                onCheckedChange={setAutoAssignSelf}
              />
            </SettingsRow>
            <SettingsRow
              label="با انتقال به حالت «در حال انجام»، به من تخصیص یابد"
              description="اگر موردی بدون مسئول را به حالت «در حال انجام» ببرید، به شما تخصیص می‌یابد"
              onToggle={() => setAssignOnStarted((v) => !v)}
            >
              <Switch
                id="pref-assign-on-started"
                checked={assignOnStarted}
                onCheckedChange={setAssignOnStarted}
              />
            </SettingsRow>
          </SettingsCard>
        </SettingsSection>
      </div>
    </div>
  )
}
