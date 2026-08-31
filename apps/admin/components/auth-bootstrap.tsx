"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { BootstrapLoading } from "@/components/bootstrap-loading"
import { useAuth } from "@/hooks/use-auth"

/**
 * Real auth handshake: GET /admin/me with the session cookie. Callers render
 * their shell silhouette while this runs.
 */
export function useAuthBootstrap(): boolean {
  return useAuth().loading
}

/** Client gate for authenticated routes - anon users bounce to /login. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  const isAuthed = !loading && user !== null

  React.useEffect(() => {
    if (!loading && !user) router.replace("/auth")
  }, [loading, user, router])

  // Brand screen while the handshake runs (and instead of a flash before the
  // redirect completes) - silhouette matches the shell.
  if (loading || !isAuthed) return <BootstrapLoading />

  return <>{children}</>
}
