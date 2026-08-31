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

/**
 * Raw Telegram initData for the `Authorization: tma <initData>` header.
 *
 * - Dev: `NEXT_PUBLIC_DEV_INIT_DATA` (generate with
 *   `pnpm --filter @workspace/db dev:initdata <chatId>` — signed with the same
 *   bot token HMAC as real Telegram, so the API validates it unchanged).
 * - Inside Telegram: retrieved from the tma.js SDK. Imported lazily so the
 *   inline telegram.js script has time to boot before the first request.
 */
export async function resolveInitData(): Promise<string | null> {
  if (process.env.NODE_ENV === "development") {
    const dev = process.env.NEXT_PUBLIC_DEV_INIT_DATA
    if (dev) return dev
  }
  try {
    const { retrieveRawInitData } = await import("@tma.js/sdk-react")
    const raw = retrieveRawInitData() ?? null
    if (raw) return raw
    // Fallback: window.Telegram.WebApp.initData (before SDK init)
    if (
      typeof window !== "undefined" &&
      (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
        .Telegram?.WebApp?.initData
    ) {
      return (
        (window as unknown as { Telegram: { WebApp: { initData: string } } })
          .Telegram.WebApp.initData || null
      )
    }
    return null
  } catch {
    return null
  }
}

function getBypassHeader(): Record<string, string> {
  try {
    if (
      typeof window !== "undefined" &&
      sessionStorage.getItem("sh_bypass_maintenance") === "1"
    ) {
      return { "x-bypass-maintenance": "1" }
    }
  } catch {}
  return {}
}

export function getMaintenanceReason(): string | null {
  try {
    return sessionStorage.getItem("sh_maintenance_reason")
  } catch {
    return null
  }
}

/** Role echoed back from the maintenance 503 (e.g. "SUPERADMIN"). */
export function getMaintenanceRole(): string | null {
  try {
    return sessionStorage.getItem("sh_maintenance_role")
  } catch {
    return null
  }
}

/** Whether the gate allowed this user to bypass (superadmins get canBypass:true). */
export function getMaintenanceCanBypass(): boolean {
  // Superadmin role => bypass allowed, even without the persisted flag.
  if (getMaintenanceRole() === "SUPERADMIN") return true
  try {
    return sessionStorage.getItem("sh_maintenance_bypass") === "1"
  } catch {
    return false
  }
}

export function getBannedReason(): string | null {
  try {
    return sessionStorage.getItem("sh_banned_reason")
  } catch {
    return null
  }
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<ApiEnvelope<T>> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData
  const initData = await resolveInitData()

  const res = await fetch(buildApiUrl(path), {
    method,
    credentials: "include",
    headers: {
      ...(isFormData ? {} : body ? { "content-type": "application/json" } : {}),
      ...(initData ? { Authorization: `tma ${initData}` } : {}),
      ...getBypassHeader(),
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
    // Maintenance gate: 503 { maintenance: true } → persist metadata for the
    // /maintenance page. The profile store + app-bootstrap handle the actual
    // redirect (client-side router) so the store state is set BEFORE navigation.
    const data = json?.data as
      | {
          maintenance?: boolean
          maintenanceReason?: string | null
          canBypass?: boolean
          role?: string | null
          banned?: boolean
          bannedReason?: string | null
        }
      | undefined
    if (res.status === 503 && data?.maintenance) {
      try {
        if (data.maintenanceReason)
          sessionStorage.setItem(
            "sh_maintenance_reason",
            data.maintenanceReason
          )
        else sessionStorage.removeItem("sh_maintenance_reason")

        const canBypass = data.canBypass || data.role === "SUPERADMIN"
        if (canBypass) sessionStorage.setItem("sh_maintenance_bypass", "1")
        else sessionStorage.removeItem("sh_maintenance_bypass")

        if (data.role) sessionStorage.setItem("sh_maintenance_role", data.role)
        else sessionStorage.removeItem("sh_maintenance_role")
      } catch {}
    }
    // Banned gate: 403 { banned: true } → persist for /banned page
    if (res.status === 403 && data?.banned) {
      try {
        if (data.bannedReason)
          sessionStorage.setItem("sh_banned_reason", data.bannedReason)
        else sessionStorage.removeItem("sh_banned_reason")
      } catch {}
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
