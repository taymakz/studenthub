export const SEMESTER_FA: Record<string, string> = {
  MEHR: "مهر",
  BAHMAN: "بهمن",
  SUMMER: "تابستان",
}

export function formatYearRange(range: string) {
  const m = /^\[(\d{4})-(\d{4})\]$/.exec(range)
  return m ? `${m[1]} تا ${m[2]}` : range
}
