/**
 * Telegram image proxy helpers. Telegram CDN photo URLs (t.me, *.telegram-cdn.org)
 * are blocked/unreachable from some clients (especially inside the webview / Iran),
 * so avatars are proxied through our own Next route the same way the old
 * frontend-next did.
 */

const TELEGRAM_DOMAINS = [
  "cdn1.telegram-cdn.org",
  "cdn2.telegram-cdn.org",
  "cdn3.telegram-cdn.org",
  "cdn4.telegram-cdn.org",
  "cdn5.telegram-cdn.org",
  "t.me",
] as const

export function isTelegramUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return TELEGRAM_DOMAINS.some(
      (domain) =>
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

/** Proxy Telegram images through /api/proxy-image; all else passes through. */
export function proxyImage(
  imageUrl: string | null | undefined
): string | undefined {
  if (!imageUrl) return undefined
  return isTelegramUrl(imageUrl)
    ? `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`
    : imageUrl
}
