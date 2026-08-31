import type { LucideIcon } from "lucide-react"
import {
  Bell,
  FileArchive,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react"
import { Tuning2 } from "reicon/icons/Tuning2"

// ─── Navigation ───────────────────────────────────────────────────────────────

/** Lucide components render as JSX; reicon functions render via toSvg. */
export type NavIcon = LucideIcon | IconFunction

export type NavItem = {
  key: string
  label: string
  href: string
  icon: NavIcon
  badge?: string
  adminOnly?: boolean
  children?: NavItem[]
}

export type NavSection = {
  divider?: boolean
  label?: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    label: "اصلی",
    items: [
      {
        key: "dashboard",
        label: "پیشخوان",
        href: "/",
        icon: LayoutDashboard,
      },
      {
        key: "users",
        label: "کاربران",
        href: "/users",
        icon: Users,
      },
      {
        key: "feedback",
        label: "بازخوردها",
        href: "/feedback",
        icon: MessageSquare,
      },
      {
        key: "uploads",
        label: "آپلودها",
        href: "/uploads",
        icon: FileArchive,
      },
      {
        key: "notifications",
        label: "اعلان‌ها",
        href: "/notifications",
        icon: Bell,
      },
      {
        key: "settings",
        label: "تنظیمات",
        href: "/settings",
        icon: Settings,
        adminOnly: true,
      },
    ],
  },
]

/** Sidebar shown while browsing the account/profile area. */
export const profileNavSections: NavSection[] = [
  {
    items: [
      {
        key: "preferences",
        label: "تنظیمات",
        href: "/settings/preferences",
        icon: Tuning2,
      },
    ],
  },
]

/** Flat page index used by the command palette. */
export function flattenNavItems(
  sections: NavSection[]
): { section: string; item: NavItem }[] {
  const out: { section: string; item: NavItem }[] = []
  for (const section of sections) {
    for (const item of section.items) {
      out.push({ section: section.label ?? "", item })
      if (item.children) {
        for (const child of item.children) {
          // Tag children with their section label (not the parent's) so the
          // command palette groups them alongside the section's other pages.
          out.push({ section: section.label ?? "", item: child })
        }
      }
    }
  }
  return out
}

// ─── User ─────────────────────────────────────────────────────────────────────

export const currentUser = {
  name: "تایماز اکبری",
  email: "taymazak1382@gmail.com",
  phone: "+98 912 345 6789",
  initials: "تا",
}

// ─── Notifications ────────────────────────────────────────────────────────────

import { Banknote } from "reicon/icons/Banknote"
import { BagShopping } from "reicon/icons/BagShopping"
import { ArrowsRotate } from "reicon/icons/ArrowsRotate"
import { Document } from "reicon/icons/Document"
import { UserAdd4 } from "reicon/icons/UserAdd4"
import type { IconFunction } from "reicon/createIcon"

export type NotificationTone = "emerald" | "sky" | "violet" | "amber" | "cyan"

export type FakeNotification = {
  id: string
  title: string
  body: string
  time: string
  unread: boolean
  /** Category icon (reicon), rendered at 16px inside the panel. */
  icon: IconFunction
  tone: NotificationTone
}

export const initialNotifications: FakeNotification[] = [
  {
    id: "n-1",
    title: "تسویه تأیید شد",
    body: "درخواست برداشت شماره ۲۲۳۱ تأیید و به‌زودی واریز می‌شود.",
    time: "۲ دقیقه پیش",
    unread: true,
    icon: Banknote,
    tone: "cyan",
  },
  {
    id: "n-2",
    title: "سفارش جدید",
    body: "سفارشی به ارزش ۲٬۴۸۰٬۰۰۰ تومان برای «فروشگاه درسا» ثبت شد.",
    time: "۱۸ دقیقه پیش",
    unread: true,
    icon: BagShopping,
    tone: "sky",
  },
  {
    id: "n-3",
    title: "تمدید اشتراک",
    body: "«کافه رومی» اشتراک طرح حرفه‌ای را برای یک ماه دیگر تمدید کرد.",
    time: "۱ ساعت پیش",
    unread: false,
    icon: ArrowsRotate,
    tone: "violet",
  },
  {
    id: "n-4",
    title: "گزارش مالی آماده است",
    body: "گزارش مالیاتی فصل تابستان آماده دانلود است.",
    time: "۳ ساعت پیش",
    unread: false,
    icon: Document,
    tone: "amber",
  },
  {
    id: "n-5",
    title: "عضو تازه",
    body: "سارا مرادی دعوت به فضای کاری را پذیرفت.",
    time: "دیروز",
    unread: false,
    icon: UserAdd4,
    tone: "emerald",
  },
]
