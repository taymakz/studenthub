import { cn } from "@workspace/ui/lib/utils"

/**
 * StudentHub logo mark, straight from `icons/Final Studenthub Logo.svg`.
 * Mounts with the old app's signature draw-in animation: both paths are
 * stroked, drawn over 2s, then filled together (see frontend-next
 * components/app/logo.tsx).
 */
export default function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 446.12 508.32"
      className={cn("text-neutral-900 dark:text-foreground", className)}
    >
      <style>{`
        .logo-path {
          stroke: currentColor;
          stroke-width: 6;
          fill: transparent;
          stroke-linecap: round;
          stroke-linejoin: round;

          stroke-dasharray: 2000;
          stroke-dashoffset: 2000;

          /* هر دو باهم شروع → هر دو باهم فیل */
          animation: draw 2s ease forwards, fillIn 0.7s ease forwards 1s;
        }

        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }

        @keyframes fillIn {
          to { fill: currentColor; }
        }
      `}</style>

      <path
        className="logo-path"
        d="M439.3,1.2l-213.46,128.62c-1.43.86-3.22.86-4.64,0L6.82.65C3.82-1.15,0,1.01,0,4.51v264.58c0,1.58.83,3.04,2.18,3.85l219.02,131.97c1.43.86,3.22.86,4.64,0l218.1-131.42c1.35-.81,2.18-2.28,2.18-3.85V5.06c0-3.5-3.82-5.66-6.82-3.85Z"
      />

      <path
        className="logo-path"
        d="M446.12,315.63v56.77c0,1.58-.83,3.04-2.18,3.85l-218.1,131.42c-1.43.86-3.22.86-4.64,0L2.18,375.7c-1.35-.81-2.18-2.28-2.18-3.85v-56.77c0-3.5,3.82-5.66,6.82-3.85l187.25,112.83h.01l27.12,16.34c1.43.86,3.22.86,4.65,0l213.45-128.62c3-1.81,6.82.35,6.82,3.85Z"
      />
    </svg>
  )
}
