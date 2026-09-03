import { lookup } from "node:dns/promises"

/**
 * SSRF-guarded URL downloader for the admin media pipeline (download-link
 * flow). Admin-only endpoint, but a pasted URL must still never reach
 * internal hosts: every redirect hop is re-validated, private/loopback
 * ranges are rejected, and the body is capped.
 */

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".")
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n >>> 0
}

function normalizeIp(ip: string): string {
  // Unwrap IPv4-mapped IPv6 (::ffff:1.2.3.4).
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped?.[1] ?? ip.toLowerCase()
}

/** True for loopback, private, link-local, multicast and reserved ranges. */
export function ipIsPrivate(rawIp: string): boolean {
  const ip = normalizeIp(rawIp)
  const v4 = ipv4ToInt(ip)
  if (v4 !== null) {
    const inRange = (base: string, bits: number): boolean => {
      const b = ipv4ToInt(base)
      if (b === null) return false
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
      return (v4 & mask) === (b & mask)
    }
    return (
      inRange("0.0.0.0", 8) || // this host
      inRange("10.0.0.0", 8) ||
      inRange("100.64.0.0", 10) || // CGNAT
      inRange("127.0.0.0", 8) ||
      inRange("169.254.0.0", 16) || // link-local (cloud metadata!)
      inRange("172.16.0.0", 12) ||
      inRange("192.0.0.0", 24) || // IETF reserved
      inRange("192.0.2.0", 24) || // TEST-NET-1
      inRange("192.88.99.0", 24) || // deprecated 6to4 relay
      inRange("192.168.0.0", 16) ||
      inRange("198.18.0.0", 15) || // benchmark testing
      inRange("198.51.100.0", 24) || // TEST-NET-2
      inRange("203.0.113.0", 24) || // TEST-NET-3
      inRange("224.0.0.0", 4) || // multicast
      inRange("240.0.0.0", 4) // reserved
    )
  }
  // IPv6: loopback, unspecified, link-local, unique-local, multicast, mapped.
  if (ip === "::1" || ip === "::") return true
  const first = ip.split(":")[0] ?? ""
  const head = Number.parseInt(first, 16)
  if (!Number.isFinite(head)) return true // fail closed on unparseable
  if ((head & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((head & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((head & 0xff00) === 0xff00) return true // ff00::/8 multicast
  return false
}

export interface FetchBytesOptions {
  maxBytes?: number
  timeoutMs?: number
  maxRedirects?: number
  /** Override for tests (offline): resolve a hostname to addresses. */
  lookup?: (hostname: string) => Promise<string[]>
}

async function defaultLookup(hostname: string): Promise<string[]> {
  return (await lookup(hostname, { all: true })).map((a) => a.address)
}

export async function fetchUrlBytesLimited(
  urlStr: string,
  opts?: FetchBytesOptions
): Promise<{ bytes: Buffer; contentType: string | null; finalUrl: string }> {
  const maxBytes = opts?.maxBytes ?? 21 * 1024 * 1024
  const timeoutMs = opts?.timeoutMs ?? 30_000
  const maxRedirects = opts?.maxRedirects ?? 3
  const resolveAddrs = opts?.lookup ?? defaultLookup

  let url: URL
  try {
    url = new URL(urlStr.trim())
  } catch {
    throw new Error("نشانی نامعتبر است")
  }

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("فقط نشانی‌های http و https مجاز است")
    }
    let addresses: string[]
    try {
      // all() resolves every record so a single public answer cannot smuggle
      // a private one past the check (fail closed if ANY is private).
      addresses = await resolveAddrs(url.hostname)
    } catch {
      throw new Error("نام میزبان قابل تشخیص نیست")
    }
    if (addresses.length === 0 || addresses.some(ipIsPrivate)) {
      throw new Error("نشانی مجاز نیست")
    }

    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null)
    if (!res) throw new Error("دریافت فایل ناموفق بود")

    if (res.status >= 300 && res.status < 400) {
      if (hop === maxRedirects) throw new Error("تغییر مسیر بیش از حد مجاز")
      const loc = res.headers.get("location")
      await res.body?.cancel().catch(() => {})
      if (!loc) throw new Error("تغییر مسیر بدون مقصد")
      url = new URL(loc, url)
      continue
    }
    if (!res.ok) throw new Error(`خطای دانلود (${res.status})`)

    const declared = res.headers.get("content-length")
    if (declared && Number(declared) > maxBytes) {
      await res.body?.cancel().catch(() => {})
      throw new Error("فایل بزرگتر از حد مجاز است")
    }
    const reader = res.body?.getReader()
    if (!reader) throw new Error("دریافت فایل ناموفق بود")
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel().catch(() => {})
        throw new Error("فایل بزرگتر از حد مجاز است")
      }
      chunks.push(value)
    }
    const bytes = Buffer.concat(chunks)
    return {
      bytes,
      contentType: res.headers.get("content-type"),
      finalUrl: url.toString(),
    }
  }
  throw new Error("تغییر مسیر بیش از حد مجاز")
}
