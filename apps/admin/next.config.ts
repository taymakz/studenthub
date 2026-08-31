import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Portless dev domain - Next.js 16 blocks cross-origin dev resources (HMR)
  // from unknown hosts by default.
  allowedDevOrigins: ["admin.student-hub.localhost"],
}

export default nextConfig
