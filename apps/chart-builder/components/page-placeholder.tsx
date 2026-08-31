import { cn } from "@workspace/ui/lib/utils"

export function PagePlaceholder({
  title,
  description,
  className,
}: {
  title: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-col items-center justify-center gap-2 p-10 text-center",
        className
      )}
    >
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {description ??
          "This page is part of the shell demo — wire up real content here."}
      </p>
    </div>
  )
}
