import type { NextConfig } from "next"
import { readFileSync } from "node:fs"

// Read the app version straight from package.json so the version shown in the
// loading splash & settings footer always matches ships/version bumps (no
// manual NEXT_PUBLIC_APP_VERSION env to keep in sync).
const { version: appVersion } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string }

const nextConfig: NextConfig = {
  // Portless dev domain - Next.js 16 blocks cross-origin dev resources (HMR)
  // from unknown hosts by default (same as apps/admin).
  allowedDevOrigins: ["mini-app.student-hub.localhost"],

  // Inlined into the client bundle (see constants/index.ts -> APP_VERSION).
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },

  async redirects() {
    return [{ source: "/home", destination: "/profile", permanent: true }]
  },

  // ── Next.js 16.3 - Instant Navigations ──
  // Component/function-level caching (`use cache`) + PPR-by-default, and
  // Navigation with <Activity>: route state survives back/forth navs.
  cacheComponents: true,
  // Prefetch the static shell of every route by default; individual links
  // opt into more via <Link prefetch={true}> (bottom nav uses it).
  partialPrefetching: true,

  // Rust-based React Compiler, running inside Turbopack: memoization at
  // build time instead of hand-tuned useMemo/useCallback.
  reactCompiler: true,
  experimental: {
    turbopackRustReactCompiler: true,
  },
}

export default nextConfig
