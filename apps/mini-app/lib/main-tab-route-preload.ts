import {
  createPreloadableRoute,
  preloadRoutesConcurrently,
} from "@/lib/preloadable-route"

/**
 * A single module-level registry is shared by bootstrap and the swipe shell.
 * Bootstrap can start downloading every tab while its splash is visible, and
 * the shell receives the exact same resolved component instances afterwards.
 */
export const MAIN_TAB_ROUTE_COMPONENTS = [
  createPreloadableRoute(() => import("@/app/(bootstrap)/(app)/profile/page")),
  createPreloadableRoute(() => import("@/app/(bootstrap)/(app)/courses/page")),
  createPreloadableRoute(
    () => import("@/app/(bootstrap)/(app)/dashboard/page")
  ),
  createPreloadableRoute(() => import("@/app/(bootstrap)/(app)/settings/page")),
] as const

export const ALL_MAIN_TAB_ROUTES_MASK =
  (1 << MAIN_TAB_ROUTE_COMPONENTS.length) - 1

/**
 * Starts all imports synchronously and lets every one finish even if another
 * chunk fails. Each route owns its cached promise, so concurrent callers from
 * bootstrap and the swipe shell never download the same chunk twice.
 */
export function preloadMainTabRoutes() {
  return preloadRoutesConcurrently(MAIN_TAB_ROUTE_COMPONENTS)
}
