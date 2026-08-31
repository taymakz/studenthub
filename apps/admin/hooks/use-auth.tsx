"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import type { AdminUser } from "@/services/auth.service"
import { authService } from "@/services/auth.service"
import { clearStoredToken, storeToken } from "@/lib/api/client"

/**
 * Client-side auth gate powered by React Query: `["auth","me"]` holds the
 * session (Bearer token from sessionStorage + admin-origin httpOnly cookie
 * ride along). The API re-checks role/permissions server-side on every
 * request - this context is UI only, never the security boundary.
 */

interface AuthContextValue {
  user: AdminUser | null
  /** True during the initial /admin/me handshake. */
  loading: boolean
  login: (user: AdminUser, token: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return await authService.me()
      } catch {
        return null
      }
    },
    staleTime: 60_000,
  })

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isPending,
      login: async (next, token) => {
        await authService.createSessionOnAdminOrigin(token)
        storeToken(token)
        queryClient.setQueryData(["auth", "me"], next)
        router.replace("/")
      },
      logout: async () => {
        try {
          await authService.logout()
        } catch {
          // token already dead - clearing local state is what matters
        }
        await authService.destroySessionOnAdminOrigin()
        clearStoredToken()
        queryClient.setQueryData(["auth", "me"], null)
        router.replace("/auth")
      },
    }),
    [meQuery.data, meQuery.isPending, queryClient, router]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
