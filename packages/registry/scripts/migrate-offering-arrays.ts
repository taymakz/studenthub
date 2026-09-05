#!/usr/bin/env tsx
/**
 * One-time migration: classSchedule/location → arrays.
 *
 * - classSchedule: null | "day from x to y" → [] | ["day from x to y"]
 * - location: same shape
 * - Applies to new.json/old.json offerings AND diff.json
 *   {added, removed, updated[].after}; diff change records (before/after
 *   strings) are left untouched.
 * - Idempotent: files already using arrays are skipped.
 *
 * Run: pnpm --filter @workspace/registry migrate:offering-arrays
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { registryRoot } from "../src/paths.ts"

type Raw = Record<string, unknown>

function toScheduleArray(v: unknown): unknown {
  if (v == null) return []
  if (typeof v === "string") {
    const s = v.trim()
    return s ? [s] : []
  }
  return v
}

function migrateOffering(o: Raw): boolean {
  let changed = false
  for (const key of ["classSchedule", "location"]) {
    const v = o[key]
    if (Array.isArray(v)) continue // already canonical
    o[key] = toScheduleArray(v)
    changed = true
  }
  return changed
}

function migrateDoc(doc: Raw): boolean {
  let changed = false
  const bump = (r: boolean) => {
    changed = changed || r
  }
  if (Array.isArray(doc.offerings)) {
    for (const o of doc.offerings as Raw[]) bump(migrateOffering(o))
  }
  // diff.json
  for (const key of ["added", "removed"]) {
    if (Array.isArray(doc[key])) {
      for (const o of doc[key] as Raw[]) bump(migrateOffering(o))
    }
  }
  if (Array.isArray(doc.updated)) {
    for (const u of doc.updated as Raw[]) {
      const after = u.after as Raw | undefined
      if (after && typeof after === "object") bump(migrateOffering(after))
    }
  }
  return changed
}

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\/courses\/[^/]+\/[^/]+\/(new|old|diff)\.json$/.test(p.replace(/\\/g, "/")))
      out.push(p)
  }
}

const root = join(registryRoot(), "universities")
const files: string[] = []
walk(root, files)

let changedFiles = 0
for (const file of files) {
  const raw = readFileSync(file, "utf-8")
  let doc: Raw
  try {
    doc = JSON.parse(raw) as Raw
  } catch {
    console.error(`parse failed, skipping: ${file}`)
    continue
  }
  if (!migrateDoc(doc)) continue
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n", "utf-8")
  changedFiles++
}
console.log(`offering-arrays migration: ${changedFiles}/${files.length} files updated`)
