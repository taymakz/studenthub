import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "destructive" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-zinc-100 text-zinc-900 hover:bg-white active:bg-zinc-300 font-bold",
  secondary:
    "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/60",
  destructive:
    "bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20",
  ghost: "text-muted hover:text-foreground hover:bg-zinc-800/60",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
