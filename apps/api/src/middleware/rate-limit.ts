import type { Context, Next } from "hono"

import { tooManyRequests } from "@/lib/http/common"

/**
 * Lightweight in-memory rate limiter for Vercel serverless.
 *
 * No Redis is available (AGENTS.md: Postgres is the only infra service),
 * so we keep a fixed-window counter in process memory. On Vercel each
 * isolate has its own counter — this is intentionally best-effort: it still
 * throttles abusive single-client bursts, and strict abuse is caught by the
 * bot-layer and by DB constraints. For a horizontally scaled strict limit
 * a hosted Redis would be needed, but the current choice matches the
 * architecture decision to avoid extra infra.
 *
 * - Window is not sliding, just resets after `windowMs`.
 * - Keys are typically client IP + route prefix, or user id when authenticated.
 * - Memory is bounded by pruning expired buckets on every tick.
 *
 * Usage:
 * ```ts
 * app.use(rateLimit({ windowMs: 60_000, max: 30 }))
 * app.use("/me/uploads", rateLimit({ windowMs: 60_000, max: 5 }))
 * ```
 */

interface RateLimitOptions {
  /** Window duration in milliseconds. */
  windowMs: number
  /** Max requests per window for a single key. */
  max: number
  /** Optional key overrides — default is IP + path prefix. */
  keyGenerator?: (c: Context) => string
  /** Message shown when rate-limited (Persian, user-facing). */
  message?: string
  /** Skip successful/failed? We count every hit — simpler and prevents bypass. */
  skip?: (c: Context) => boolean
}

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Periodic cleanup — avoid unbounded growth when many distinct IPs hit.
let lastSweep = Date.now()
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
  // Hard cap: if somehow we exceed 20k keys (e.g. NAT), drop oldest half.
  if (buckets.size > 20_000) {
    const keys = [...buckets.keys()].slice(0, 10_000)
    for (const k of keys) buckets.delete(k)
  }
}

function defaultKey(c: Context): string {
  // Prefer x-forwarded-for (Vercel) then x-real-ip, fallback to cf-connecting-ip.
  const fwd = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  const ip =
    fwd ||
    c.req.header("x-real-ip") ||
    c.req.header("cf-connecting-ip") ||
    "0.0.0.0"
  // Scope by route prefix so a busy endpoint doesn't starve others.
  const prefix = c.req.path.split("/").slice(0, 3).join("/") // e.g. /api/me
  // If authenticated, also scope by user id — one user can't burn the IP budget for others behind same NAT.
  const userId = (c.get as unknown as (k: string) => unknown)?.("user") as {
    id?: number
  } | null
  const userPart = userId?.id ? `:u${userId.id}` : ""
  return `${ip}:${prefix}${userPart}`
}

export function rateLimit(opts: RateLimitOptions) {
  const windowMs = opts.windowMs
  const max = opts.max
  const message =
    opts.message ??
    "درخواست‌های شما بیش از حد مجاز است، لطفاً کمی بعد دوباره تلاش کنید"
  const keyGen = opts.keyGenerator ?? defaultKey

  return async (c: Context, next: Next) => {
    if (opts.skip?.(c)) return next()

    const now = Date.now()
    sweep(now)

    const key = keyGen(c)
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1

    const remaining = Math.max(0, max - bucket.count)
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000)

    c.header("RateLimit-Limit", String(max))
    c.header("RateLimit-Remaining", String(remaining))
    c.header("RateLimit-Reset", String(resetSeconds))
    c.header("Retry-After", String(resetSeconds))

    if (bucket.count > max) {
      return tooManyRequests(c, message)
    }

    await next()
  }
}

/* ─── Presets used in server.ts / routes ─── */

/** Global generous limit — catches accidental loops / runaway clients. */
export const globalRateLimit = rateLimit({ windowMs: 60_000, max: 180 })

/** Auth / OTP — brute force sensitive. */
export const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: "تلاش‌های ورود بیش از حد مجاز است",
})

/** Uploads — bandwidth sensitive, anti-spam. */
export const uploadRateLimit = rateLimit({
  windowMs: 60_000,
  max: 6,
  message: "آپلود بیش از حد مجاز — لطفاً صبر کنید",
})

/** Profile mutations — avoid churn. */
export const profileRateLimit = rateLimit({ windowMs: 60_000, max: 30 })

/** Export image presign/send — Telegram-bound. */
export const exportRateLimit = rateLimit({ windowMs: 60_000, max: 10 })
