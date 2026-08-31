"use client"

import { create } from "zustand"

type AuthBootstrapState = {
  /** True while the (fake) auth handshake is running on app load. */
  booting: boolean
  finish: () => void
}

export const useAuthBootstrapStore = create<AuthBootstrapState>((set) => ({
  booting: true,
  finish: () => set({ booting: false }),
}))

/** Starts the fake handshake. Call once from a client effect; returns the
    cancel function for effect cleanup. The real Telegram OTP flow replaces
    this later without touching the shell wiring. */
export function startAuthBootstrap(delayMs = 3000) {
  const timer = setTimeout(
    () => useAuthBootstrapStore.getState().finish(),
    delayMs
  )
  return () => clearTimeout(timer)
}

/** True while the shell is booting; route content stays mounted but hidden. */
export function useAuthBootstrap() {
  return useAuthBootstrapStore((s) => s.booting)
}
