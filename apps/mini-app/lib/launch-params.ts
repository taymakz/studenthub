/** Telegram launch-param helpers (port of the old launch-params provider). */

export const LAUNCH_PARAM_PREFIXES = ["cd", "ref", "rd", "fid"] as const

function extractValueWithPrefix(value: string, prefix: string): string | null {
  const re = new RegExp(`${prefix}(.*)`)
  const match = value.match(re)
  return match ? (match[1] ?? null) : null
}

/** Pull `start_param` out of a raw initData query string. */
export function extractStartParam(
  initData: string | null | undefined
): string | null {
  if (!initData) return null
  try {
    return new URLSearchParams(initData).get("start_param")
  } catch {
    return null
  }
}

/** Persist cd/ref/rd/fid from a start param into localStorage (returns rd). */
export function applyStartParam(startParam: string | null | undefined): {
  rd: string | null
} {
  if (!startParam) return { rd: null }
  let rd: string | null = null
  for (const prefix of LAUNCH_PARAM_PREFIXES) {
    const value = extractValueWithPrefix(startParam, prefix)
    if (!value) continue
    try {
      localStorage.setItem(prefix, value)
    } catch {
      /* storage unavailable */
    }
    if (prefix === "rd") rd = value
  }
  return { rd }
}

/** Same as applyStartParam but accepts a full initData string. */
export function applyLaunchParams(initData: string | null | undefined): {
  rd: string | null
} {
  return applyStartParam(extractStartParam(initData))
}
