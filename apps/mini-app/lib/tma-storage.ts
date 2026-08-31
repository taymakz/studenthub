"use client"

/**
 * Telegram cloudStorage helpers that can never hang the caller.
 *
 * `@tma.js` `cloudStorage.getItem/setItem` post a bridge request and wait for
 * the Telegram client to answer. When the SDK was not fully initialized (slow
 * webview boot, failed `isTMA` detection, browser with window.Telegram stub),
 * NO event ever arrives and the returned promise stays pending forever — it
 * neither resolves nor rejects, so a plain try/catch does NOT protect against
 * it. This hung the bootstrap gate (splash stuck → 12s timeout → blank "/"
 * page) and the welcome "finish" handler. Every call is therefore raced
 * against a short timeout and degrades to null (no flag) / no-op.
 */
const CLOUD_STORAGE_TIMEOUT_MS = 1_500

export async function cloudStorageGet(key: string): Promise<string | null> {
  try {
    const { cloudStorage } = await import("@tma.js/sdk-react")
    const v = await Promise.race([
      cloudStorage.getItem(key),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), CLOUD_STORAGE_TIMEOUT_MS)
      ),
    ])
    return typeof v === "string" ? v : null
  } catch {
    // cloudStorage unavailable (web) or errored — degrade to null
    return null
  }
}

export async function cloudStorageSet(
  key: string,
  value: string
): Promise<void> {
  try {
    const { cloudStorage } = await import("@tma.js/sdk-react")
    await Promise.race([
      cloudStorage.setItem(key, value),
      new Promise<void>((resolve) =>
        setTimeout(() => resolve(), CLOUD_STORAGE_TIMEOUT_MS)
      ),
    ])
  } catch {
    // cloudStorage unavailable outside Telegram — localStorage is the fallback
  }
}