export type SeriesPoint = {
  date: Date
  value: number
  [key: string]: unknown
}

export interface SeriesStats {
  average: number
  trend: number
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function withStats(series: SeriesPoint[]): SeriesStats {
  const values = series.map((point) => point.value)
  const average = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length
  )
  const previous = values[values.length - 2]
  const last = values[values.length - 1]
  const trend =
    previous === 0
      ? 0
      : Number((((last - previous) / previous) * 100).toFixed(1))
  return { average, trend }
}

/**
 * Twelve monthly revenue points in Toman, drifting upward.
 * Values are realistic Iranian-scale amounts (millions), e.g. 5,000,000.
 */
export function generateRevenueMetrics(): {
  series: SeriesPoint[]
} & SeriesStats {
  const series: SeriesPoint[] = []
  let value = randInt(4_200_000, 5_200_000)
  for (let month = 0; month < 12; month++) {
    value = Math.max(3_800_000, value + randInt(-700_000, 950_000))
    series.push({ date: new Date(2024, month, 1), value })
  }
  return { series, ...withStats(series) }
}

/** Seven daily session counts. */
export function generateSessionMetrics(): {
  series: SeriesPoint[]
} & SeriesStats {
  const series: SeriesPoint[] = []
  let value = randInt(900, 1250)
  for (let day = 0; day < 7; day++) {
    value = Math.max(600, value + randInt(-350, 480))
    series.push({ date: new Date(2024, 5, 3 + day), value })
  }
  return { series, ...withStats(series) }
}

/** Seven daily conversion-rate percentages. */
export function generateConversionMetrics(): {
  series: SeriesPoint[]
} & SeriesStats {
  const series: SeriesPoint[] = []
  let value = randInt(24, 38) / 10
  for (let day = 0; day < 7; day++) {
    value = Math.max(1.8, value + randInt(-6, 8) / 10)
    series.push({ date: new Date(2024, 5, 3 + day), value })
  }
  return { series, ...withStats(series) }
}

export interface ChannelMetric {
  name: string
  color: string
  /** Session count for this channel. */
  value: number
  /** Top channel count — rings fill relative to it. */
  maxValue: number
}

const CHANNEL_DEFS = [
  { name: "جستجو", color: "var(--chart-line-primary)" },
  { name: "شبکه‌های اجتماعی", color: "oklch(0.62 0.17 255)" },
  { name: "دسترسی مستقیم", color: "oklch(0.83 0.16 85)" },
]

/** Session counts per traffic channel. */
export function generateChannelMetrics(): ChannelMetric[] {
  const counts = CHANNEL_DEFS.map(() => randInt(1800, 5200))
  const max = Math.max(...counts)
  return CHANNEL_DEFS.map((def, index) => ({
    ...def,
    value: counts[index],
    maxValue: max,
  }))
}

export interface TrendPoint {
  date: Date
  revenue: number
  costs: number
  [key: string]: unknown
}

/**
 * Deterministic 30-day revenue vs costs series (bklit example pattern,
 * scaled to realistic Iranian Toman millions).
 */
export function generateRevenueTrend(): TrendPoint[] {
  return Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2024, 0, i + 1),
    revenue: Math.floor(
      8_000_000 + Math.sin(i / 5) * 4_000_000 + ((i * 11) % 2_000_000)
    ),
    costs: Math.floor(
      5_000_000 + Math.cos(i / 4) * 2_000_000 + ((i * 7) % 1_500_000)
    ),
  }))
}

/**
 * Twelve deterministic monthly revenue points (bklit stat-card-area pattern),
 * scaled to Iranian Toman millions, plus average/trend stats.
 */
export function generateRevenueStatSeries(): {
  series: SeriesPoint[]
} & SeriesStats {
  const monthly = [
    5200, 6100, 5400, 4700, 5100, 6800, 6400, 7200, 6900, 8100, 7600, 8800,
  ]
  const series: SeriesPoint[] = monthly.map((value, month) => ({
    date: new Date(2024, month, 1),
    value: value * 1000,
  }))
  return { series, ...withStats(series) }
}
