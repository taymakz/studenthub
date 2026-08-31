"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface Profile {
  id: string
  name: string
}

interface ProfileStore {
  profiles: Profile[]
  activeId: string | null
  add: (name: string) => void
  remove: (id: string) => void
  select: (id: string) => void
}

/** Working-state buckets persisted per profile ("<base>:<profileId>"). */
const SCOPED_STORAGE_BASES = ["sb-pool", "sb-chart", "sb-scope"] as const

export function scopedKey(base: string, profileId: string): string {
  return `${base}:${profileId}`
}

/** Drops every persisted working-state bucket owned by a profile. */
export function purgeProfileStorage(profileId: string): void {
  if (typeof window === "undefined") return
  for (const base of SCOPED_STORAGE_BASES) {
    try {
      window.localStorage.removeItem(scopedKey(base, profileId))
    } catch {
      // storage blocked - nothing else to clean up
    }
  }
}

/**
 * Multiple builder profiles: each profile gets its own working context -
 * pool/chart/scope are stored under "<base>:<profileId>" keys so switching
 * profiles swaps datasets and old profile data persists.
 * Persisted to localStorage; a default profile always exists.
 */
export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      profiles: [{ id: "default", name: "پیش‌فرض" }],
      activeId: "default",
      add: (name) => {
        const id = crypto.randomUUID()
        set((s) => ({
          profiles: [...s.profiles, { id, name }],
          activeId: id,
        }))
      },
      remove: (id) => {
        purgeProfileStorage(id)
        set((s) => {
          const profiles = s.profiles.filter((p) => p.id !== id)
          const activeId =
            s.activeId === id ? (profiles[0]?.id ?? null) : s.activeId
          return { profiles, activeId }
        })
      },
      select: (id) => set({ activeId: id }),
    }),
    { name: "sb-profiles" }
  )
)
