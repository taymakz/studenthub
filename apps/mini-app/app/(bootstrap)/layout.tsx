import { AppBootstrap } from "@/components/app/app-bootstrap"

/**
 * Route-group layout for the gated app surface: "/", /welcome, /setup and all
 * `(app)` pages. Root-level routes OUTSIDE this group (e.g. /maintenance) are
 * NOT wrapped by AppBootstrap, so landing there never re-runs the splash +
 * /me hydration (no rebuild-bootstrap-on-every-reload).
 */
export default function BootstrapLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppBootstrap>{children}</AppBootstrap>
}
