"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { AppLogo } from "@workspace/ui/components/app-logo"
import { Input } from "@workspace/ui/components/input"

import { toastManager } from "@workspace/ui/components/toast"

import { useAuth } from "@/hooks/use-auth"
import { ApiError, getStoredToken } from "@/lib/api/client"
import { authService } from "@/services/auth.service"
import { toFa } from "@/lib/format"

/** Previously used chat ids - feeds the native autocomplete/datalist. */
const CHAT_IDS_KEY = "sh_login_chat_ids"

function loadChatIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAT_IDS_KEY) ?? "[]") as string[]
  } catch {
    return []
  }
}

function rememberChatId(chatId: string): void {
  const next = [chatId, ...loadChatIds().filter((id) => id !== chatId)].slice(
    0,
    5
  )
  try {
    localStorage.setItem(CHAT_IDS_KEY, JSON.stringify(next))
  } catch {
    // storage unavailable - suggestions simply stay empty
  }
}

export function LoginForm() {
  const router = useRouter()
  const { login } = useAuth()

  const [chatId, setChatId] = React.useState("")
  const [knownIds, setKnownIds] = React.useState<string[]>([])
  const [code, setCode] = React.useState("")
  const [step, setStep] = React.useState<"chat" | "otp">("chat")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [resendIn, setResendIn] = React.useState(0)
  const otpRef = React.useRef<HTMLInputElement>(null)

  // Resend countdown - one minute between OTP requests.
  React.useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  // Already holding a live session (e.g. reload on /auth)? Straight in.
  React.useEffect(() => {
    if (!getStoredToken()) return
    let cancelled = false
    authService
      .me()
      .then((me) => {
        if (!cancelled && me) router.replace("/")
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [router])

  React.useEffect(() => {
    if (step === "chat") setKnownIds(loadChatIds())
  }, [step])

  const chatIdNumber = Number.parseInt(chatId, 10)
  const chatIdValid = Number.isSafeInteger(chatIdNumber) && chatIdNumber > 0

  async function sendOtp() {
    if (!chatIdValid) return
    setBusy(true)
    setError(null)
    try {
      await authService.requestOtp(chatIdNumber)
      setStep("otp")
      setCode("")
      setResendIn(60)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toastManager.add({
          title: "تعداد درخواست زیاد",
          description: err.message,
          type: "error",
        })
        setResendIn(60)
      }
      setError(err instanceof Error ? err.message : "ارسال کد ناموفق بود")
    } finally {
      setBusy(false)
    }
  }

  async function verify(codeValue: string) {
    // Takes the code explicitly - the state update from the last keystroke
    // has not committed yet when auto-submit fires.
    if (codeValue.length !== 6) return
    setBusy(true)
    setError(null)
    try {
      const res = await authService.verifyOtp(chatIdNumber, codeValue)
      const token = res.data.token
      if (!token) {
        setError("پاسخ سرور فاقد توکن ورود بود")
        setCode("")
        otpRef.current?.focus()
        return
      }
      rememberChatId(chatId)
      await login(res.data.user, token)
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) {
        toastManager.add({
          title: "حساب قفل شد",
          description: err.message,
          type: "error",
        })
      }
      // Wrong/expired code: clear and refocus so retry is instant.
      setError(err instanceof Error ? err.message : "کد نامعتبر است")
      setCode("")
      otpRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background px-4">
      <AppLogo className="h-12 w-auto text-foreground" />

      <div className="w-full max-w-sm">
        {step === "chat" ? (
          <>
            <div className="text-center">
              <h1 className="text-lg font-semibold">ورود مدیران</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                شناسه تلگرام (Chat ID) خود را وارد کنید
              </p>
            </div>
            <Input
              dir="ltr"
              inputMode="numeric"
              autoFocus
              value={chatId}
              onChange={(e) => setChatId(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chatIdValid) void sendOtp()
              }}
              placeholder="700000000"
              autoComplete="username"
              list="login-chat-ids"
              className="mt-6 h-10 w-full text-center font-mono text-sm"
            />
            <datalist id="login-chat-ids">
              {knownIds.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
            <button
              type="button"
              disabled={!chatIdValid || busy}
              onClick={() => void sendOtp()}
              className="mt-4 h-10 w-full rounded-lg bg-primary font-medium text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {busy ? "در حال ارسال…" : "دریافت کد ورود"}
            </button>
          </>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-lg font-semibold">کد ورود</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                کد ۶ رقمی ارسال‌شده به تلگرام شما را وارد کنید
              </p>
            </div>
            <Input
              dir="ltr"
              ref={otpRef}
              inputMode="numeric"
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6)
                setCode(next)
                if (next.length === 6 && !busy) void verify(next)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && code.length === 6 && !busy) {
                  void verify(code)
                }
              }}
              placeholder="------"
              autoComplete="one-time-code"
              className="mt-6 h-12 w-full text-center font-mono text-xl tracking-[0.5em]"
            />
            <div className="mt-4 flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                disabled={resendIn > 0 || busy}
                onClick={() => void sendOtp()}
              >
                {resendIn > 0
                  ? `ارسال مجدد تا ${toFa(resendIn)} ثانیه`
                  : "ارسال مجدد کد"}
              </button>
              <button
                type="button"
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => {
                  setStep("chat")
                  setCode("")
                  setError(null)
                }}
              >
                تغییر شناسه
              </button>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
