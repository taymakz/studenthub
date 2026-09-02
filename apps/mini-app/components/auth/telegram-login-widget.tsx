"use client"

import { useEffect, useRef } from "react"

import Logo from "@/components/app/logo"
import { useTelegramConfig } from "./telegram/use-telegram-config"
import { useTelegramAuth } from "./telegram/use-telegram-auth"
import { TelegramConfigState, useLegacyWidget, useNewLogin } from "./telegram/telegram-widgets"

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void
  }
}

export function TelegramLoginWidget() {
  const { botUsername, clientId, configError, configLoading } = useTelegramConfig()
  const { loading, error, setError, handleAuth } = useTelegramAuth()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.onTelegramAuth = (user: Record<string, unknown>) => void handleAuth(user)
    return () => { delete window.onTelegramAuth }
  }, [handleAuth])

  useLegacyWidget(botUsername, containerRef, setError)
  const handleNewLogin = useNewLogin(clientId, handleAuth, setError)

  const hasAnyConfig = Boolean(botUsername || clientId)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-10" />
          <h1 className="mt-4 text-xl font-bold">ورود به دانشجویار</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">برای استفاده در مرورگر، با اکانت تلگرام خود وارد شوید. همان حساب داخل مینی‌اپ — بدون نیاز به ثبت‌نام جدید.</p>
        </div>
        <div className="mt-6 flex flex-col items-center gap-3">
          <TelegramConfigState loading={configLoading} error={configError} hasAny={hasAnyConfig} botUsername={botUsername} clientId={clientId} containerRef={containerRef} onLogin={handleNewLogin} loginLoading={loading} />
          {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
          <p className="text-center text-[11px] leading-4 text-muted-foreground">با ورود، شما شرایط استفاده را می‌پذیرید. اطلاعات فقط برای احراز هویت استفاده می‌شود.</p>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">داخل تلگرام هستید؟ <a href="https://t.me/studenthubir" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">باز کردن مینی‌اپ</a></p>
    </div>
  )
}
