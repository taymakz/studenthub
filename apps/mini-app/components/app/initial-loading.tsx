import AppLogo from "@/components/app/logo"
import { APP_VERSION } from "@/constants"

/**
 * Startup splash - draw-in logo, three-dot pulse loader, version pinned to the
 * bottom. Sits over the whole viewport (old bootstrap loading section).
 */
export function InitialLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-background">
      <AppLogo className="size-28" />
      <div
        className="absolute flex translate-y-24 items-center gap-1.5"
        aria-label="در حال بارگذاری"
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span
        dir="ltr"
        className="absolute bottom-10 text-left font-mono text-sm text-muted-foreground"
      >
        {APP_VERSION}
      </span>
    </div>
  )
}
