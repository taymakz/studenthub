"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Trash2, User } from "lucide-react"
import { toastManager } from "@/components/toast"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { useProfileStore } from "@/components/profile-store"

/** Sidebar header block: active profile + switcher (add / select / delete). */
export function ProfileSwitcher() {
  const { profiles, activeId, add, remove, select } = useProfileStore()
  const [mounted, setMounted] = React.useState(false)
  const [newName, setNewName] = React.useState("")

  React.useEffect(() => {
    // Persisted store rehydrates after mount - avoid SSR text mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rehydrate gate
    setMounted(true)
  }, [])

  const active = profiles.find((p) => p.id === activeId) ?? profiles[0]

  const handleAdd = () => {
    const name = newName.trim()
    if (!name) return
    add(name)
    setNewName("")
    toastManager.add({ type: "success", title: `پروفایل «${name}» ساخته شد` })
  }

  const handleRemove = () => {
    if (!active || profiles.length <= 1) {
      toastManager.add({ type: "error", title: "حداقل یک پروفایل باید بماند" })
      return
    }
    toastManager.add({ type: "info", title: `پروفایل «${active.name}» حذف شد` })
    remove(active.id)
  }

  return (
    <div className="p-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg border border-transparent p-2 text-start transition-colors duration-150 ease-out hover:bg-sidebar-accent focus-visible:bg-sidebar-accent"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-sidebar-foreground">
                <User className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {mounted ? (active?.name ?? "بدون پروفایل") : "…"}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  پروفایل کاری
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-56 p-1">
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel className="text-xs">
              پروفایل‌ها
            </DropdownMenuGroupLabel>

            {mounted &&
              profiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => select(profile.id)}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    {profile.id === active?.id ? (
                      <Check className="size-3.5" />
                    ) : (
                      <span className="size-3.5" />
                    )}
                    {profile.name}
                  </span>
                </DropdownMenuItem>
              ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <div
            className="flex items-center gap-1 p-1"
            onKeyDown={(event) => {
              // Base UI menus typeahead-swallow printable/Enter/arrow keydowns
              // bubbling to the popup - keep keystrokes away from menu
              // handling so the name input actually receives text.
              event.stopPropagation()
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAdd()
                }
              }}
              placeholder="نام پروفایل جدید…"
              className="h-8 text-xs"
            />
            <Button
              size="icon"
              variant="secondary"
              className="size-8 shrink-0"
              onClick={handleAdd}
              disabled={!newName.trim()}
              aria-label="افزودن پروفایل"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onClick={handleRemove}>
            <Trash2 />
            حذف پروفایل فعال
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
