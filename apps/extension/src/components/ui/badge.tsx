import type { HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type Tone = "neutral" | "success" | "warning" | "destructive" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-zinc-800 text-zinc-300 border-zinc-700/60",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  destructive: "bg-red-500/10 text-red-400 border-red-500/30",
  brand: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
