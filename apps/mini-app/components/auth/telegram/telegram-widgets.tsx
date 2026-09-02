"use client"

import { useEffect, useRef } from "react"
import { Loader2, ShieldCheck } from "lucide-react"

/** Random nonce for Telegram Login — Web Crypto, never Math.random (auth material). */
function createNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function useLegacyWidget(botUsername: string, containerRef: React.RefObject<HTMLDivElement | null>, setError: (s: string) => void) {
  const loadedRef = useRef(false)
  useEffect(() => {
    if (!botUsername || !containerRef.current || loadedRef.current) return
    if (containerRef.current.querySelector("script")) return
    loadedRef.current = true
    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.async = true
    script.setAttribute("data-telegram-login", botUsername.replace(/^@/, ""))
    script.setAttribute("data-size", "large")
    script.setAttribute("data-radius", "12")
    script.setAttribute("data-onauth", "onTelegramAuth(user)")
    script.setAttribute("data-request-access", "write")
    script.onerror = () => setError("بارگذاری ویجت تلگرام ناموفق بود — فیلترشکن را بررسی کنید")
    containerRef.current.appendChild(script)
  }, [botUsername, containerRef, setError])
}

export function TelegramConfigState({ loading, error, hasAny, botUsername, clientId, containerRef, onLogin, loginLoading }: { loading: boolean; error: string | null; hasAny: boolean; botUsername: string; clientId: string; containerRef: React.RefObject<HTMLDivElement | null>; onLogin: () => void; loginLoading: boolean }) {
  if (loading) return <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> در حال بارگذاری...</div>
  if (error && !hasAny) return <p className="py-2 text-center text-sm text-destructive">{error}</p>
  return (
    <>
      {botUsername ? <div ref={containerRef} className="flex min-h-[44px] w-full justify-center" /> : null}
      {clientId ? (
        <button type="button" onClick={onLogin} disabled={loginLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2AABEE] px-5 py-3 text-sm font-semibold text-white shadow hover:opacity-90 disabled:opacity-60">
          {loginLoading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          ورود با تلگرام
        </button>
      ) : botUsername ? null : <p className="text-center text-xs text-destructive">پیکربندی ورود یافت نشد</p>}
      {botUsername && clientId ? <p className="text-center text-[11px] text-muted-foreground">یا از دکمه‌ی تلگرام داخل کادر بالا استفاده کنید</p> : null}
    </>
  )
}

export function useNewLogin(clientId: string, handleAuth: (d: Record<string, unknown>) => void, setError: (s: string) => void) {
  return () => {
    const cid = Number(clientId)
    if (!clientId || Number.isNaN(cid) || cid <= 0) { setError("شناسه کلاینت تلگرام تنظیم نشده است"); return }
    const w = window as unknown as { Telegram?: { Login?: { auth: (opts: Record<string, unknown>, cb: (data: Record<string, unknown>) => void) => void } } }
    if (typeof window !== "undefined" && w.Telegram?.Login?.auth) {
      w.Telegram.Login.auth({ bot_id: cid, client_id: cid, scope: ["profile"], nonce: createNonce() }, (data: Record<string, unknown>) => void handleAuth(data as Record<string, unknown>))
      return
    }
    const existing = document.querySelector('script[src*="telegram-login.js"]') as HTMLScriptElement | null
    if (existing) { existing.addEventListener("load", () => (window as unknown as { Telegram?: { Login?: { auth: (opts: Record<string, unknown>, cb: (d: Record<string, unknown>) => void) => void } } }).Telegram?.Login?.auth?.({ bot_id: cid, client_id: cid, scope: ["profile"], nonce: createNonce() }, (d: Record<string, unknown>) => void handleAuth(d)), { once: true }); return }
    const s = document.createElement("script")
    s.src = "https://oauth.telegram.org/js/telegram-login.js?6"
    s.async = true
    s.onload = () => {
      const ww = window as unknown as { Telegram?: { Login?: { auth: (opts: Record<string, unknown>, cb: (data: Record<string, unknown>) => void) => void } } }
      if (ww.Telegram?.Login?.auth) ww.Telegram.Login.auth({ bot_id: cid, client_id: cid, scope: ["profile"], nonce: createNonce() }, (data: Record<string, unknown>) => void handleAuth(data as Record<string, unknown>))
      else setError("ربات تلگرام پیکربندی نشده است")
    }
    s.onerror = () => setError("بارگذاری لاگین تلگرام ناموفق بود")
    document.head.appendChild(s)
  }
}
