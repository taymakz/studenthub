const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const

/** Converts every Latin digit inside a string to its Persian counterpart. */
export function toFa(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)])
}

/** Groups a non-negative integer with the Arabic thousands separator (٬). */
export function faNumber(value: number, fractionDigits = 0): string {
  const fixed = value.toFixed(fractionDigits)
  const [intPart, fracPart] = fixed.split(".")
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "٬")
  return toFa(fracPart ? `${grouped}٫${fracPart}` : grouped)
}

/** Signed percentage with Persian digits, e.g. «۱۲٫۴٪» / «۰٫۴٪−». */
export function faPercent(value: number, fractionDigits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${faNumber(Math.abs(value), fractionDigits)}٪`
}

/** Compact toman amounts, e.g. ۸٫۴ میلیون تومان. */
export function faTomanCompact(value: number): string {
  if (value >= 1_000_000_000) {
    return `${faNumber(value / 1_000_000_000, 1)} میلیارد تومان`
  }
  if (value >= 1_000_000) {
    return `${faNumber(value / 1_000_000, 1)} میلیون تومان`
  }
  if (value >= 1_000) {
    return `${faNumber(value / 1_000, 0)} هزار تومان`
  }
  return `${faNumber(value)} تومان`
}

/** Full toman amount with separators, e.g. ۸٬۴۵۰٬۰۰۰ تومان. */
export function faToman(value: number): string {
  return `${faNumber(value)} تومان`
}
