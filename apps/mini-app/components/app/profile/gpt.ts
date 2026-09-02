export type Gpt = 10 | 12 | 20

export const GPT_OPTIONS: Array<{
  title: string
  value: Gpt
  available: number
}> = [
  { title: "مشروط", value: 10, available: 14 },
  { title: "متوسط", value: 12, available: 20 },
  { title: "الف", value: 20, available: 24 },
]

export const GPT_KEY = "user-gpt"

export function loadGpt(): Gpt | null {
  if (typeof window === "undefined") return null
  const v = Number(localStorage.getItem(GPT_KEY))
  return v === 10 || v === 12 || v === 20 ? (v as Gpt) : null
}

export function saveGpt(value: Gpt | null) {
  try {
    if (value === null) {
      localStorage.removeItem(GPT_KEY)
    } else {
      localStorage.setItem(GPT_KEY, String(value))
    }
  } catch {
    /* storage unavailable */
  }
}

export function gptToUnits(gpt: Gpt | null): number | null {
  return gpt === 10 ? 14 : gpt === 12 ? 20 : gpt === 20 ? 24 : null
}

export function gptToLabel(gpt: Gpt | null): string | null {
  return gpt === 10 ? "مشروط" : gpt === 12 ? "متوسط" : gpt === 20 ? "الف" : null
}
