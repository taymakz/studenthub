import { createHash } from "node:crypto"

/**
 * Content identity for offering diffs (no imports beyond node:crypto, so unit
 * tests need no DB or config).
 *
 * Problem: detect identifies batches by diff.json's random UUID, but that
 * file can be stale relative to on-disk old.json/new.json (rotation runs
 * separately, or never). A deleted batch then resurrects as a "combined"
 * batch filed under the old UUID. Identity must derive from the CONTENT that
 * was actually diffed instead.
 */

export interface CanonicalOffering {
  index: string
  courseCode?: string | null
  courseName?: string | null
  classCode?: string | null
  degree?: string | null
  minCapacity?: number | null
  maxCapacity?: number | null
  classSchedule?: string | null
  examSchedule?: string | null
  professor?: string | null
  location?: string | null
}

export interface SnapshotLike {
  offerings?: Array<Record<string, unknown>> | null
}

function professorText(professor: unknown): string | null {
  if (!professor) return null
  if (typeof professor === "string") return professor
  if (typeof professor === "object") {
    const fa = (professor as Record<string, unknown>).fa
    return typeof fa === "string" ? fa : null
  }
  return null
}

function asRecord(o: Record<string, unknown>, key: string): unknown {
  return o[key] ?? null
}

/** Notification-relevant projection (mirrors the sync/API tracked fields). */
export function canonicalOfferings(
  doc: SnapshotLike | null | undefined
): CanonicalOffering[] {
  const list = doc?.offerings ?? []
  return list
    .map((o) => ({
      index: String(asRecord(o, "index") ?? ""),
      courseCode: (asRecord(o, "courseCode") as string | null) ?? null,
      courseName: (asRecord(o, "courseName") as string | null) ?? null,
      classCode: (asRecord(o, "classCode") as string | null) ?? null,
      degree: (asRecord(o, "degree") as string | null) ?? null,
      minCapacity: (asRecord(o, "minCapacity") as number | null) ?? null,
      maxCapacity: (asRecord(o, "maxCapacity") as number | null) ?? null,
      classSchedule: (asRecord(o, "classSchedule") as string | null) ?? null,
      examSchedule: (asRecord(o, "examSchedule") as string | null) ?? null,
      professor: professorText(asRecord(o, "professor")),
      location: (asRecord(o, "location") as string | null) ?? null,
    }))
    .sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 0))
}

/** Stable sha256 over the canonical snapshot (order-insensitive). */
export function snapshotContentHash(doc: SnapshotLike | null | undefined): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalOfferings(doc)))
    .digest("hex")
}

/** RFC 4122 v5 UUID (sha1 namespace + name). Fixed namespace for diffs. */
export const DIFF_ID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"

export function uuidv5(name: string, namespace: string = DIFF_ID_NAMESPACE): string {
  const ns = Buffer.from(namespace.replaceAll("-", ""), "hex")
  const hash = createHash("sha1")
    .update(ns)
    .update(name, "utf8")
    .digest()
  hash[6] = (hash[6]! & 0x0f) | 0x50
  hash[8] = (hash[8]! & 0x3f) | 0x80
  const hex = hash.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** Deterministic batch identity for a (baseline -> current) content pair. */
export function contentDiffUuid(
  baseline: SnapshotLike | null | undefined,
  current: SnapshotLike | null | undefined
): string {
  return uuidv5(
    `${snapshotContentHash(baseline)}\n${snapshotContentHash(current)}`
  )
}

export interface LiveDiffShape {
  added: Array<{ index: string }>
  removed: Array<{ index: string }>
  updated: Array<{
    after: { index: string }
    changes: Array<{ field: string; before: string | null; after: string | null }>
  }>
}

export interface FileDiffShape {
  added?: Array<{ index: string }> | null
  removed?: Array<{ index: string }> | null
  updated?: Array<{
    after?: { index: string } | null
    changes?: Array<{ field: string; before?: string | null; after?: string | null }> | null
  }> | null
  summary?: { added?: number; removed?: number; changed?: number } | null
}

function sortedIndexes(items: Array<{ index: string }>): string[] {
  return items.map((o) => o.index).sort()
}

function normalizedUpdated(
  items: LiveDiffShape["updated"] | FileDiffShape["updated"]
): string[] {
  return (items ?? [])
    .map((u) => {
      const index = (u as { after?: { index: string } | null }).after?.index ?? ""
      const changes = ((u as { changes?: Array<{ field: string; before?: unknown; after?: unknown }> | null }).changes ?? [])
        .map((c) => `${c.field}:${String(c.before ?? "")}->${String(c.after ?? "")}`)
        .sort()
        .join(",")
      return `${index}|${changes}`
    })
    .sort()
}

/**
 * Does diff.json describe exactly the live (old,new) content? Compares index
 * sets + per-course change fields, so a stale file (rotation not run, manual
 * edits) is detected and its random UUID is NOT reused for the new content.
 */
export function diffFileMatchesLive(
  live: LiveDiffShape,
  file: FileDiffShape | null | undefined
): boolean {
  if (!file) return false
  const eq = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i])
  if (!eq(sortedIndexes(live.added), sortedIndexes(file.added ?? []))) return false
  if (!eq(sortedIndexes(live.removed), sortedIndexes(file.removed ?? []))) return false
  const liveUpd = normalizedUpdated(live.updated)
  const fileUpd = normalizedUpdated(file.updated)
  if (!eq(liveUpd, fileUpd)) return false
  const s = file.summary
  if (s && (s.added !== undefined || s.removed !== undefined || s.changed !== undefined)) {
    if (
      (s.added ?? live.added.length) !== live.added.length ||
      (s.removed ?? live.removed.length) !== live.removed.length ||
      (s.changed ?? live.updated.length) !== live.updated.length
    ) {
      return false
    }
  }
  return true
}
