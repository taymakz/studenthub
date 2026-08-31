// The bootstrap gate (draw-in splash + intro/setup/profile redirect) now lives
// in the `(bootstrap)` route-group layout (`app/(bootstrap)/layout.tsx`), so it
// wraps "/", /welcome, /setup and all `(app)` pages but NOT /maintenance.
// This page is only ever reached after the gate has resolved, so it renders
// nothing itself.
export default function Page() {
  return null
}
