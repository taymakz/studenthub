"use client"

type TermNumberPickerProps = {
  value: number | null
  onSelect: (n: number) => void
  disabled?: boolean
  pendingValue?: number | null
}

export function TermNumberPicker({ value, onSelect, disabled, pendingValue }: TermNumberPickerProps) {
  const isPending = pendingValue != null
  return (
    <div className="flex flex-wrap justify-center gap-2 p-4">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
        const isSelected = value === n
        const isLoading = isPending && pendingValue === n
        return (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(n)}
            className={`flex size-12 items-center justify-center rounded-full border text-sm font-medium tabular-nums transition-colors ${
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary/50"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${isLoading ? "animate-pulse" : ""}`}
          >
            {isLoading ? "..." : n}
          </button>
        )
      })}
    </div>
  )
}
