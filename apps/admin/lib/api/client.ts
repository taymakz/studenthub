export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"

export function buildApiUrl(path: string) {
  // Works whether NEXT_PUBLIC_API_URL includes the /api mount or not.
  const base = API_BASE_URL.replace(/\/$/, "")
  const withApi = base.endsWith("/api") ? base : `${base}/api`
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${withApi}${normalizedPath}`
}

/** Uniform API envelope (mirrors the Hono ok()/fail() helpers). */
export interface ApiEnvelope<T> {
  success: boolean
  message: string
  data: T
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly data?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** Session JWT for API Authorization - mirrored in storage so page
    reloads keep working. The httpOnly cookie (admin origin) exists in
    parallel but JS cannot read it. Use localStorage for cross-tab sharing
    with sessionStorage fallback for older sessions. */
const TOKEN_KEY = "sh_admin_token"

export function getStoredToken(): string | null {
  try {
    const fromLocal = localStorage.getItem(TOKEN_KEY)
    if (fromLocal) return fromLocal
    const fromSession = sessionStorage.getItem(TOKEN_KEY)
    if (fromSession) {
      try {
        localStorage.setItem(TOKEN_KEY, fromSession)
      } catch {
        // ignore
      }
      return fromSession
    }
    return null
  } catch {
    return null
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // ignore
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // storage blocked - requests fall back to cookie-less (will 401)
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage unavailable - nothing to clean up
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<ApiEnvelope<T>> {
  const token = getStoredToken()
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData
  const res = await fetch(buildApiUrl(path), {
    method,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : body ? { "content-type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isFormData
      ? (body as FormData)
      : body
        ? JSON.stringify(body)
        : undefined,
    cache: "no-store",
  })

  let json: ApiEnvelope<T> | null = null
  try {
    json = (await res.json()) as ApiEnvelope<T>
  } catch {
    // non-JSON (proxy error page etc.)
  }

  if (!res.ok || !json?.success) {
    if (res.status === 401) {
      // Single message should not force logout – show toast instead and keep session
      if (
        path.includes("/messages/single") ||
        path.includes("/notifications/announcements")
      ) {
        throw new ApiError(
          res.status,
          json?.message ?? `درخواست ناموفق بود (${res.status})`,
          json?.data
        )
      }
      const hadToken = Boolean(token)
      // Clear local token state + httpOnly cookie (timeout-capped).
      clearStoredToken()
      try {
        await Promise.race([
          fetch("/api/auth/session", { method: "DELETE" }),
          new Promise((r) => setTimeout(r, 1000)),
        ])
      } catch {
        /* endpoint unreachable */
      }
      // Only hard-redirect if a token WAS present (stale / expired / wrong
      // SECRET_KEY). A 401 with no token is the normal "not logged in"
      // response — me() callers handle it themselves.
      if (hadToken && typeof window !== "undefined") {
        window.location.replace("/auth")
      }
    }
    throw new ApiError(
      res.status,
      json?.message ?? `درخواست ناموفق بود (${res.status})`,
      json?.data
    )
  }
  return json
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
}
