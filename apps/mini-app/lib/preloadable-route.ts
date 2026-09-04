import type { ComponentType } from "react"

interface RouteModule {
  default: ComponentType
}

export interface PreloadableRoute {
  getComponent: () => ComponentType | null
  preload: () => Promise<ComponentType>
}

/**
 * Keeps the resolved component alongside its import promise. React.lazy keeps
 * its own unresolved payload even when the same import was already warmed,
 * which can otherwise expose a one-frame Suspense fallback on first render.
 */
export function createPreloadableRoute(
  loader: () => Promise<RouteModule>
): PreloadableRoute {
  let component: ComponentType | null = null
  let loadPromise: Promise<ComponentType> | null = null

  return {
    getComponent: () => component,
    preload: () => {
      if (loadPromise) return loadPromise

      loadPromise = loader()
        .then((routeModule) => {
          component = routeModule.default
          return component
        })
        .catch((error: unknown) => {
          loadPromise = null
          throw error
        })

      return loadPromise
    },
  }
}

/** Starts every route in the same turn; one rejected chunk cannot cancel the rest. */
export function preloadRoutesConcurrently(
  routes: readonly PreloadableRoute[]
): Promise<PromiseSettledResult<ComponentType>[]> {
  return Promise.allSettled(routes.map((route) => route.preload()))
}
