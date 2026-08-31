"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"

import Logo from "@/components/app/logo"
import { fetchTelegramConfig, loginWithWidget } from "@/lib/auth/web-token"
import { useProfileStore } from "@/stores/profile-store"

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void
  }
}

export function TelegramLoginWidget() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [botUsername, setBotUsername] = useState<string>("")
  const [clientId, setClientId] = useState<string>("")
  const [configError, setConfigError] = useState<string | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptLoadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setConfigLoading(true)
    void fetchTelegramConfig()
      .then((cfg) => {
        if (cancelled) return
        setBotUsername(cfg.botUsername ?? "")
        setClientId(cfg.clientId ?? "")
        if (!cfg.botUsername && !cfg.clientId) {
          setConfigError("پیکربندی ورود تلگرام یافت نشد")
        } else {
          setConfigError(null)
        }
      })
      .catch(() => {
        if (!cancelled) setConfigError("خطا در دریافت تنظیمات ورود")
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
      // Hard reload so AppBootstrap re-hydrates with the new Bearer token
      // and runs the intro/profile gating (same chat id as TMA).
      window.location.reload()
    } catch (e) {
      setError((e as Error).message ?? "خطا در ورود")
      setLoading(false)
    }
  }, [])

  // Expose global for legacy widget's data-onauth
  useEffect(() => {
    window.onTelegramAuth = (user: Record<string, unknown>) =>
      void handleAuth(user)
    return () => {
      delete window.onTelegramAuth
    }
  }, [handleAuth])

  // Inject legacy widget script when botUsername is known (browser mode).
  // This is the official https://telegram.org/js/telegram-widget.js flow —
  // it renders an iframe button inside containerRef and calls onTelegramAuth.
  useEffect(() => {
    if (!botUsername || !containerRef.current || scriptLoadedRef.current) return
    if (containerRef.current.querySelector("script")) return
    scriptLoadedRef.current = true
    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.async = true
    script.setAttribute("data-telegram-login", botUsername.replace(/^@/, ""))
    script.setAttribute("data-size", "large")
    script.setAttribute("data-radius", "12")
    script.setAttribute("data-onauth", "onTelegramAuth(user)")
    script.setAttribute("data-request-access", "write")
    script.onerror = () =>
      setError("بارگذاری ویجت تلگرام ناموفق بود — فیلترشکن را بررسی کنید")
    containerRef.current.appendChild(script)
  }, [botUsername])

  const handleNewLogin = useCallback(() => {
    const cid = Number(clientId)
    if (!clientId || Number.isNaN(cid) || cid <= 0) {
      setError("شناسه کلاینت تلگرام تنظیم نشده است")
      return
    }
    const w = window as unknown as {
      Telegram?: {
        Login?: {
          auth: (
            opts: Record<string, unknown>,
            cb: (data: Record<string, unknown>) => void
          ) => void
        }
      }
    }
    if (typeof window !== "undefined" && w.Telegram?.Login?.auth) {
      w.Telegram.Login.auth(
        {
          bot_id: cid,
          client_id: cid,
          scope: ["profile"],
          nonce: Math.random().toString(36).slice(2),
        },
        (data: Record<string, unknown>) =>
          void handleAuth(data as Record<string, unknown>)
      )
      return
    }
    const existing = document.querySelector(
      'script[src*="telegram-login.js"]'
    ) as HTMLScriptElement | null
    if (existing) {
      // Script tag exists but Login not ready yet — wait for load
      existing.addEventListener("load", () => handleNewLogin(), { once: true })
      return
    }
    const s = document.createElement("script")
    s.src = "https://oauth.telegram.org/js/telegram-login.js?6"
    s.async = true
    s.onload = () => {
      const ww = window as unknown as {
        Telegram?: {
          Login?: {
            auth: (
              opts: Record<string, unknown>,
              cb: (data: Record<string, unknown>) => void
            ) => void
          }
        }
      }
      if (ww.Telegram?.Login?.auth) {
        ww.Telegram.Login.auth(
          {
            bot_id: cid,
            client_id: cid,
            scope: ["profile"],
            nonce: Math.random().toString(36).slice(2),
          },
          (data: Record<string, unknown>) =>
            void handleAuth(data as Record<string, unknown>)
        )
      } else {
        setError("ربات تلگرام پیکربندی نشده است")
      }
    }
    s.onerror = () => setError("بارگذاری لاگین تلگرام ناموفق بود")
    document.head.appendChild(s)
  }, [clientId, handleAuth])

  const hasAnyConfig = Boolean(botUsername || clientId)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Logo className="size-10" />
          <h1 className="mt-4 text-xl font-bold">ورود به دانشجویار</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            برای استفاده در مرورگر، با اکانت تلگرام خود وارد شوید. همان حساب
            داخل مینی‌اپ — بدون نیاز به ثبت‌نام جدید.
          </p>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          {configLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> در حال بارگذاری...
            </div>
          ) : configError && !hasAnyConfig ? (
            <p className="py-2 text-center text-sm text-destructive">
              {configError}
            </p>
          ) : (
            <>
              {/* Legacy widget mounts its own iframe/button here when botUsername is present */}
              {botUsername ? (
                <div
                  ref={containerRef}
                  className="flex min-h-[44px] w-full justify-center"
                />
              ) : null}

              {/* Primary OIDC button — always prominent when clientId is configured.
                  Uses Telegram.Login.auth popup (same chat id → same DB row as TMA). */}
              {clientId ? (
                <button
                  type="button"
                  onClick={handleNewLogin}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2AABEE] px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  ورود با تلگرام
                </button>
              ) : botUsername ? null : (
                <p className="text-center text-xs text-destructive">
                  پیکربندی ورود یافت نشد
                </p>
              )}

              {/* When both flows exist, the legacy iframe is the visual fallback
                  and the popup button is the primary CTA — keep a subtle hint. */}
              {botUsername && clientId ? (
                <p className="text-center text-[11px] text-muted-foreground">
                  یا از دکمه‌ی تلگرام داخل کادر بالا استفاده کنید
                </p>
              ) : null}
            </>
          )}

          {error ? (
            <p className="text-center text-xs text-destructive">{error}</p>
          ) : null}

          <p className="text-center text-[11px] leading-4 text-muted-foreground">
            با ورود، شما شرایط استفاده را می‌پذیرید. اطلاعات فقط برای احراز هویت
            استفاده می‌شود.
          </p>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        داخل تلگرام هستید؟{" "}
        <a
          href="https://t.me/studenthubir"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline"
        >
          باز کردن مینی‌اپ
        </a>
      </p>
    </div>
  )
}
