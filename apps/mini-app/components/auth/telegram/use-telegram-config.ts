"use client"

import { useEffect, useState } from "react"

import { fetchTelegramConfig } from "@/lib/auth/web-token"

export function useTelegramConfig() {
  const [botUsername, setBotUsername] = useState("")
  const [clientId, setClientId] = useState("")
  const [configError, setConfigError] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setConfigLoading(true)
    void fetchTelegramConfig()
      .then((cfg) => {
        if (cancelled) return
        setBotUsername(cfg.botUsername ?? "")
        setClientId(cfg.clientId ?? "")
        if (!cfg.botUsername && !cfg.clientId) setConfigError("پیکربندی ورود تلگرام یافت نشد")
        else setConfigError(null)
      })
      .catch(() => { if (!cancelled) setConfigError("خطا در دریافت تنظیمات ورود") })
      .finally(() => { if (!cancelled) setConfigLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { botUsername, clientId, configError, configLoading }
}
