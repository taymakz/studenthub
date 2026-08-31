"use client"

import { create } from "zustand"

type SidebarPeekStore = {
  /** True while the collapsed sidebar is being previewed (hover intent). */
  peeking: boolean
  setPeeking: (v: boolean) => void
}

export const useSidebarPeekStore = create<SidebarPeekStore>((set) => ({
  peeking: false,
  setPeeking: (v) => set({ peeking: v }),
}))
