"use client"

import { create } from "zustand"

export type SidebarConfirmAction = "clear" | "reset" | "terms"

/** Shared state for dialogs triggered from the sidebar but rendered at
    shell level - portaled popups must not live inside the sidebar's
    hidden/transformed/sheet-managed subtree. */
type SidebarDialogStore = {
  exportOpen: boolean
  /** Whether the confirm dialog is shown. Kept separate from `confirm` so
      the title doesn't change while the exit animation plays. */
  confirmOpen: boolean
  /** Last requested action - stays set after closing for stable rendering. */
  confirm: SidebarConfirmAction
  /** Target count of a pending "terms" decrease; stays set after closing
      so the description survives the exit animation. */
  pendingTermCount: number | null
  setExportOpen: (v: boolean) => void
  requestConfirm: (action: SidebarConfirmAction) => void
  requestTermCountConfirm: (targetCount: number) => void
  setConfirmOpen: (open: boolean) => void
}

export const useSidebarDialogStore = create<SidebarDialogStore>((set) => ({
  exportOpen: false,
  confirmOpen: false,
  confirm: "clear",
  pendingTermCount: null,
  setExportOpen: (v) => set({ exportOpen: v }),
  requestConfirm: (action) =>
    set({ confirm: action, pendingTermCount: null, confirmOpen: true }),
  requestTermCountConfirm: (targetCount) =>
    set({
      confirm: "terms",
      pendingTermCount: targetCount,
      confirmOpen: true,
    }),
  setConfirmOpen: (open) => set({ confirmOpen: open }),
}))
