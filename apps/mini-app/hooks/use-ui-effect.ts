"use client"

import { useEffect } from "react"
import { create } from "zustand"

type UIEffect = "none" | "snow" | "rain"

const STORAGE_KEY = "ui-effect"

/** Toggle the body `effect-*` class the canvases/JS read (old app parity). */
function applyEffectClasses(name: UIEffect) {
  if (typeof window === "undefined") return
  document.body.classList.forEach((c) => {
    if (c.startsWith("effect-")) document.body.classList.remove(c)
  })
  if (name !== "none") document.body.classList.add(`effect-${name}`)
}

function readStored(): UIEffect {
  if (typeof window === "undefined") return "none"
  try {
    const v = localStorage.getItem(STORAGE_KEY) as UIEffect | null
    return v === "snow" || v === "rain" ? v : "none"
  } catch {
    return "none"
  }
}

interface UIEffectStore {
  effect: UIEffect
  setEffect: (effect: UIEffect) => void
}

/**
 * Global effect state so the settings drawer and the layout overlay stay in
 * sync without a reload (a per-component useState meant the overlay only saw
 * the persisted value after remount).
 */
export const useUIEffect = create<UIEffectStore>((set) => ({
  effect: "none",
  setEffect: (effect) => {
    applyEffectClasses(effect)
    try {
      localStorage.setItem(STORAGE_KEY, effect)
    } catch {
      /* storage blocked */
    }
    set({ effect })
  },
}))

/**
 * Syncs the store from localStorage once per mount of the consumer tree
 * (server render always starts at "none" to stay hydration-safe).
 */
export function useUIEffectHydrate() {
  const hydrate = useUIEffect((s) => s.setEffect)
  useEffect(() => {
    const stored = readStored()
    if (stored !== "none") hydrate(stored)
  }, [hydrate])
}
