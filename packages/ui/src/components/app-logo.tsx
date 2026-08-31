import { cn } from "@workspace/ui/lib/utils"

/**
 * StudentHub brand mark (icons/white.svg), painted with `currentColor` so it
 * reads correctly on any surface in both themes (foreground on backgrounds,
 * background on foreground chips).
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 446.12 508.32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="StudentHub"
      className={cn("text-foreground", className)}
    >
      <path
        fill="currentColor"
        d="M439.3 1.2 225.84 129.82c-1.43.86-3.22.86-4.64 0L6.82.65C3.82-1.15 0 1.01 0 4.51v264.58c0 1.58.83 3.04 2.18 3.85l219.02 131.97c1.43.86 3.22.86 4.64 0l218.1-131.42c1.35-.81 2.18-2.28 2.18-3.85V5.06c0-3.5-3.82-5.66-6.82-3.85Z"
      />
      <path
        fill="currentColor"
        d="M446.12 315.63v56.77c0 1.58-.83 3.04-2.18 3.85l-218.1 131.42c-1.43.86-3.22.86-4.64 0L2.18 375.7c-1.35-.81-2.18-2.28-2.18-3.85v-56.77c0-3.5 3.82-5.66 6.82-3.85l187.25 112.83h.01l27.12 16.34c1.43.86 3.22.86 4.65 0l213.45-128.62c3-1.81 6.82.35 6.82 3.85Z"
      />
    </svg>
  )
}
