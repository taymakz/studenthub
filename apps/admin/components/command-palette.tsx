"use client"

import * as React from "react"
import Link from "next/link"

import { useTheme } from "next-themes"
import { LogOut, Moon, Search, Sun } from "lucide-react"

import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@workspace/ui/components/command"
import { Kbd } from "@workspace/ui/components/kbd"
import { NavItemIcon } from "@/components/drill-down-nav"
import { flattenNavItems, navSections } from "@/lib/fake-data"

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pages = React.useMemo(() => flattenNavItems(navSections), [])
  const { resolvedTheme, setTheme } = useTheme()

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange])

  const groups = React.useMemo(() => {
    const pageGroups = navSections
      .filter((section) => section.label)
      .map((section) => ({
        value: section.label!,
        items: pages
          .filter((page) => page.section === section.label)
          .map(({ item }) => ({
            value: item.key,
            label: item.label,
            href: item.href,
            icon: item.icon,
            badge: item.badge,
          })),
      }))

    return [
      ...pageGroups,
      {
        value: "دستورها",
        items: [
          {
            value: "search-issues",
            label: "جستجو…",
            icon: Search,
            action: close,
          },
          {
            value: "toggle-theme",
            label: `تغییر به حالت ${resolvedTheme === "dark" ? "روشن" : "تیره"}`,
            icon: resolvedTheme === "dark" ? Sun : Moon,
            action: () => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
              close()
            },
          },
          {
            value: "logout",
            label: "خروج از حساب",
            icon: LogOut,
            action: close,
          },
        ],
      },
    ]
  }, [pages, resolvedTheme, setTheme, close])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandDialogPopup>
        <Command items={groups}>
          <CommandInput placeholder="جستجوی صفحه یا دستور…" />
          <CommandEmpty>نتیجه‌ای یافت نشد.</CommandEmpty>
          <CommandList>
            {(group: (typeof groups)[number], index: number) => (
              <React.Fragment key={group.value}>
                <CommandGroup items={group.items}>
                  <CommandGroupLabel>{group.value}</CommandGroupLabel>
                  <CommandCollection>
                    {(item) => (
                      <CommandItem
                        key={item.value}
                        value={item.value}
                        render={
                          "href" in item && item.href ? (
                            <Link href={item.href} />
                          ) : undefined
                        }
                        onClick={() =>
                          "action" in item ? item.action?.() : close()
                        }
                      >
                        <NavItemIcon icon={item.icon} />
                        <span>{item.label}</span>
                        {"badge" in item && item.badge && (
                          <CommandShortcut>{item.badge}</CommandShortcut>
                        )}
                      </CommandItem>
                    )}
                  </CommandCollection>
                </CommandGroup>
                {index < groups.length - 1 && <CommandSeparator />}
              </React.Fragment>
            )}
          </CommandList>
          <CommandFooter>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                یک صفحه یا دستور را انتخاب کنید
              </span>
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Kbd>esc</Kbd> برای بستن
            </span>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  )
}
