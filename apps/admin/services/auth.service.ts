import { apiClient, clearStoredToken } from "@/lib/api/client"

/**
 * Admin auth against the StudentHub API. Login is deliberately minimal:
 * chat id -> OTP code delivered by the Telegram bot -> one-year session.
 * There is no password, no forgot-flow - just resend after 60s.
 */

export type AdminRole = "USER" | "ADMIN" | "SUPERADMIN" | "NOTIFICATIONER"

/** Safe projection returned by the API (never raw internals). */
export interface AdminUser {
  id: number
  telegramUsername: string | null
  firstName: string
  lastName: string | null
  photoUrl: string | null
  role: AdminRole
  banned: boolean
  bannedReason: string | null
  lastOnlineAt: string | null
  createdAt: string
}

interface AuthUserEnvelope {
  user: AdminUser
  role?: AdminRole
  permissions?: string[]
  token?: string
}

export const authService = {
  /** Sends the OTP to the admin's Telegram PV. Resend-gated client-side. */
  async requestOtp(chatId: number) {
    return apiClient.post<{ sent: boolean; devCode?: string }>(
      "/admin/auth/request-otp",
      { chatId }
    )
  },

  /** Verifies the code; returns the JWT which the admin origin stores as its
      own httpOnly session cookie via /api/auth/session. */
  async verifyOtp(chatId: number, code: string) {
    return apiClient.post<AuthUserEnvelope>("/admin/auth/verify-otp", {
      chatId,
      code,
    })
  },

  /** Stores/clears the session cookie on THIS origin (admin host). */
  async createSessionOnAdminOrigin(token: string) {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
  },

  async destroySessionOnAdminOrigin() {
    await fetch("/api/auth/session", { method: "DELETE" })
    clearStoredToken()
  },

  /** Current session (or null when unauthenticated). */
  async me() {
    try {
      const res = await apiClient.get<AuthUserEnvelope>("/admin/me")
      return res.data.user
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 401
      ) {
        return null
      }
      throw error
    }
  },

  async logout() {
    await apiClient.post("/admin/auth/logout")
  },
}
