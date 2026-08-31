"use client"

import { create } from "zustand"

import { initialNotifications } from "@/lib/fake-data"

type NotificationItem = (typeof initialNotifications)[number]

type NotificationStore = {
  items: NotificationItem[]
  markOneRead: (id: string) => void
  markAllRead: () => void
}

/** Owns notification read-state so the bell badge and the panel always agree
    (previously each kept a disconnected copy of the seed data). */
export const useNotifications = create<NotificationStore>((set) => ({
  items: initialNotifications,
  markOneRead: (id) =>
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, unread: false } : n)),
    })),
  markAllRead: () =>
    set((s) => ({ items: s.items.map((n) => ({ ...n, unread: false })) })),
}))
