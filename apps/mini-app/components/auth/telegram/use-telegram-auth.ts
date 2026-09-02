"use client"

import { useCallback, useState } from "react"

import { loginWithWidget } from "@/lib/auth/web-token"
import { useProfileStore } from "@/stores/profile-store"

export function useTelegramAuth() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAuth = useCallback(async (data: Record<string, unknown>) => {
    if (data?.error) {
      setError(String(data.error))
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      await loginWithWidget(data)
      await useProfileStore.getState().refresh()
      window.location.reload()
    } catch (e) {
      setError((e as Error).message ?? "خطا در ورود")
      setLoading(false)
    }
  }, [])

  return { loading, error, setError, handleAuth }
}
