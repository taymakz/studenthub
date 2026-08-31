#!/usr/bin/env tsx
/**
 * Sync professors.json from offerings: append-only generator.
 *
 * - Walks all courses/<year>/<semester>/new.json via loader.listOfferingTerms
 *   and collects every professor name found in the offerings.
 * - Ensures professors.json exists per major: existing entries are NEVER
 *   removed or re-ordered (votes in the DB reference professorSlug), new
 *   names are appended with unique sequential slugs (`prof-<n>` continuing
 *   after the highest existing id).
 * - Deterministic: new names are appended in sorted order; idempotent (a
 *   second run is a no-op).
 *
 * Called from sync-offerings (pnpm reg:build) — professors.json is therefore
 * auto-generated, never hand-edited.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"

import {
  getOfferings,
  listMajorSlugs,
  listOfferingTerms,
  listUniversitySlugs,
} from "../src/loader.ts"
import { professorsDocPath, registryRoot } from "../src/paths.ts"
import type { ProfessorsDoc } from "../src/schema/professor.ts"

/** Raw new.json stores `professor` as a plain string OR `{ fa }`. */
function professorName(p: unknown): string | null {
  if (typeof p === "string") {
    const t = p.trim()
    return t ? t : null
  }
  if (p && typeof p === "object" && "fa" in p) {
    const fa = (p as { fa?: unknown }).fa
    if (typeof fa === "string") {
      const t = fa.trim()
      return t ? t : null
    }
  }
  return null
}

function normalizeName(name: string): string {
  // Normalize Arabic/Persian look-alikes + whitespace so the same professor
  // scraped with different unicode forms doesn't get a second identity.
  return name
    .replace(/\u064A/g, "\u06CC") // ي -> ی
    .replace(/\u0643/g, "\u06A9") // ك -> ک
    .replace(/\u200c+/g, "\u200c") // collapse ZWNJ runs
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Append new professor names found in new.json snapshots to each major's
 * professors.json. Existing entries (and their optional fields like
 * `department`) are preserved untouched — append-only, never delete.
 * Returns the number of majors whose professors.json was updated.
 */
export function syncProfessors(): number {
  const root = registryRoot()
  let updated = 0

  for (const uni of listUniversitySlugs()) {
    for (const major of listMajorSlugs(uni)) {
      // Collect every professor name present in ANY new.json of this major.
      const names = new Set<string>()
      for (const term of listOfferingTerms(uni, major)) {
        let doc
        try {
          doc = getOfferings(uni, major, term.year, term.semester)
        } catch {
          continue // unreadable snapshot — validator reports it separately
        }
        if (!doc) continue
        for (const o of doc.offerings) {
          const n = professorName(o.professor)
          if (n) names.add(normalizeName(n))
        }
      }

      const path = professorsDocPath(uni, major)
      const abs = `${root}/${path}`

      let existing: ProfessorsDoc["professors"] = []
      if (existsSync(abs)) {
        try {
          const raw = JSON.parse(readFileSync(abs, "utf-8"))
          existing = Array.isArray(raw.professors) ? raw.professors : []
        } catch {
          console.warn(`⚠ unparseable ${path} — leaving as-is`)
          continue
        }
      }

      const byName = new Map(existing.map((p) => [p.name, p]))
      // Unique numeric ids: continue after the highest existing prof-<n>.
      let nextId = 1
      for (const slug of existing.map((p) => p.slug)) {
        const m = /^prof-(\d+)$/.exec(slug)
        if (m) nextId = Math.max(nextId, Number(m[1]) + 1)
      }

      let addedCount = 0
      for (const name of [...names].sort((a, b) => a.localeCompare(b, "fa"))) {
        if (byName.has(name)) continue
        const slug = `prof-${nextId++}`
        existing.push({ slug, name })
        byName.set(name, { slug, name })
        addedCount++
      }

      if (existing.length === 0) continue // nothing known yet — don't create an empty (invalid) doc

      const docOut: ProfessorsDoc = {
        $schema: "../../../../../schemas/professors.json",
        type: "professors",
        professors: existing,
      }
      const out = `${JSON.stringify(docOut, null, 2)}\n`

      if (existsSync(abs)) {
        const before = readFileSync(abs, "utf-8")
        if (before === out) continue
      }
      writeFileSync(abs, out, "utf-8")
      console.log(
        `professors: ${uni}/${major} -> ${existing.length} entries, ${addedCount} added`
      )
      updated++
    }
  }
  return updated
}

// CLI entry: `pnpm --filter @workspace/registry sync:professors`
const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("sync-professors.ts")
if (invokedDirectly) {
  const n = syncProfessors()
  console.log(`Done. professorsUpdated=${n}`)
}
