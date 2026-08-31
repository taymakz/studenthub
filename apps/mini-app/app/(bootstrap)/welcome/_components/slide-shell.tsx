/**
 * Shared slide shell - big tinted icon on the fading grid block over the
 * title/description stack, exactly like the old introduce slides.
 */
export function SlideShell({
  visual,
  title,
  description,
  children,
}: {
  visual: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  /** Optional CTA rendered under the description (e.g. GitHub button). */
  children?: React.ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 pb-6 sm:gap-8 sm:pb-12">
      <div
        className="xs:h-56 flex h-44 w-full max-w-[18rem] items-center justify-center rounded-md sm:h-72 sm:max-w-sm"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(circle at center, black 60%, transparent 98%)",
          WebkitMaskImage:
            "radial-gradient(circle at center, black 60%, transparent 98%)",
        }}
      >
        {visual}
      </div>
      <div className="space-y-2 text-center sm:space-y-2.5">
        <h2 className="text-base leading-6 font-medium text-balance sm:text-lg">
          {title}
        </h2>
        <p className="mx-auto max-w-[22rem] text-sm leading-6 text-balance text-muted-foreground sm:max-w-[24rem] sm:leading-7">
          {description}
        </p>
        {children && <div className="pt-2 sm:pt-3">{children}</div>}
      </div>
    </div>
  )
}
