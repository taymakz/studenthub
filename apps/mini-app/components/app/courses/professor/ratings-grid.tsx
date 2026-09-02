"use client"

function getRatingColor(value: number) {
  if (value >= 4) return "text-success"
  if (value >= 3) return "text-warning"
  return "text-destructive"
}

function formatRating(value: number) {
  return value.toFixed(1)
}

function RatingCell({
  label,
  value,
  inverted,
}: {
  label: string
  value: number | null | undefined
  inverted?: boolean
}) {
  const color =
    value != null
      ? getRatingColor(inverted ? 5 - value : value)
      : ""
  return (
    <div className="flex items-center justify-between rounded bg-muted/30 p-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>
        {value != null ? formatRating(value) : "—"}
      </span>
    </div>
  )
}

export function RatingsGrid({
  averages,
}: {
  averages: {
    examDifficulty: number | null
    teachingQuality: number | null
    mastery: number | null
    leniency: number | null
    questionSimilarity: number | null
  } | null
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="col-span-2 flex items-center justify-between rounded bg-muted/30 p-2">
        <span className="text-muted-foreground">تسلط</span>
        <span
          className={`font-medium ${averages?.mastery != null ? getRatingColor(averages.mastery) : ""}`}
        >
          {averages?.mastery != null ? formatRating(averages.mastery) : "—"}
        </span>
      </div>
      <RatingCell label="سختی امتحان" value={averages?.examDifficulty} inverted />
      <RatingCell label="نمره‌دهی" value={averages?.leniency} />
      <RatingCell label="کیفیت تدریس" value={averages?.teachingQuality} />
      <RatingCell label="شباهت سوالات" value={averages?.questionSimilarity} />
    </div>
  )
}
