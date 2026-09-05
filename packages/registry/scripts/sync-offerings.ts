#!/usr/bin/env tsx
/**
 * Sync offering snapshots: git-aware old.json + diff.json generator.
 *
 * - Walks all courses/<year>/<semester>/new.json via loader.listOfferingTerms
 *   and ensures old.json + diff.json exist (empty placeholders for first snapshots).
 * - If new.json changed (git diff against <before> or HEAD), copies the previous
 *   new.json to old.json and regenerates diff.json with a fresh UUID (random)
 *   containing {added, removed, updated{after, changes}} — same tracked fields
 *   as apps/api diff.ts (capacity/classSchedule/examSchedule/professor/location).
 * - Only new.json edits trigger rotation; old.json/diff.json are derived.
 *
 * Usage:
 *   pnpm --filter @workspace/registry sync              # local: diff vs HEAD
 *   pnpm --filter @workspace/registry sync -- <before> # CI: diff vs <before-sha>
 *   pnpm --filter @workspace/registry sync -- --ensure-only  # only create missing placeholders
 */

import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { randomUUID } from "node:crypto"

import {
  listOfferingTerms,
  getOfferings,
  getPreviousOfferings,
  getOfferingDiff,
} from "../src/loader.ts"
import { listUniversitySlugs, listMajorSlugs } from "../src/loader.ts"
import { offeringDiffDocSchema } from "../src/schema/offering.ts"
import {
  registryRoot,
  offeringDiffPath,
  offeringOldPath,
  offeringPath,
} from "../src/paths.ts"
import type { Offering, OfferingDoc } from "../src/schema/offering.ts"
import { syncProfessors } from "./sync-professors.ts"

const TRACKED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "minCapacity", label: "حداقل ظرفیت" },
  { key: "maxCapacity", label: "حداکثر ظرفیت" },
  { key: "classSchedule", label: "زمان کلاس‌ها" },
  { key: "examSchedule", label: "زمان امتحان" },
  { key: "professor", label: "استاد" },
  { key: "location", label: "مکان" },
]

function professorName(p: Offering["professor"]): string | null {
  if (!p) return null
  // Raw new.json stores professor as a plain string OR { fa } — handle both,
  // otherwise diff tracking silently ignores string-form professors.
  if (typeof p === "string") {
    const t = p.trim()
    return t ? t : null
  }
  return p.fa ?? null
}
function fieldValue(o: Offering, key: string): string | null {
  if (key === "professor") return professorName(o.professor)
  const v = (o as unknown as Record<string, unknown>)[key]
  if (v == null) return null
  // classSchedule/location are arrays — join for the diff record.
  if (Array.isArray(v)) {
    const joined = v.filter((x) => x != null && String(x).trim() !== "").join(" ، ")
    return joined || null
  }
  return String(v)
}
function calculateDiff(current: OfferingDoc, previous: OfferingDoc | null) {
  if (!previous)
    return {
      added: [] as Offering[],
      removed: [] as Offering[],
      updated: [] as Array<{
        after: Offering
        changes: Array<{
          field: string
          label: string
          before: string | null
          after: string | null
        }>
      }>,
    }
  const prevByIndex = new Map(previous.offerings.map((o) => [o.index, o]))
  const currByIndex = new Map(current.offerings.map((o) => [o.index, o]))
  const added: Offering[] = []
  const updated: Array<{
    after: Offering
    changes: Array<{
      field: string
      label: string
      before: string | null
      after: string | null
    }>
  }> = []
  for (const o of current.offerings) {
    const before = prevByIndex.get(o.index)
    if (!before) {
      added.push(o)
      continue
    }
    const changes: Array<{
      field: string
      label: string
      before: string | null
      after: string | null
    }> = []
    for (const { key, label } of TRACKED_FIELDS) {
      const b = fieldValue(before, key)
      const a = fieldValue(o, key)
      if (b !== a) changes.push({ field: key, label, before: b, after: a })
    }
    if (changes.length > 0) updated.push({ after: o, changes })
  }
  const removed = previous.offerings.filter((o) => !currByIndex.has(o.index))
  return { added, removed, updated }
}

function git(args: string): string {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim()
  } catch {
    return ""
  }
}

function parseArgs(): { before: string | null; ensureOnly: boolean } {
  const raw = process.argv.slice(2).filter((a) => a !== "--")
  let before: string | null = null
  let ensureOnly = false
  for (const a of raw) {
    if (a === "--ensure-only") ensureOnly = true
    else if (!a.startsWith("-") && !before) before = a
  }
  if (before === "0000000000000000000000000000000000000000") before = null
  return { before, ensureOnly }
}

function ensurePlaceholders(): number {
  let created = 0
  const root = registryRoot()
  for (const uni of listUniversitySlugs()) {
    for (const major of listMajorSlugs(uni)) {
      for (const term of listOfferingTerms(uni, major)) {
        const newAbs = join(
          root,
          offeringPath(uni, major, term.year, term.semester)
        )
        if (!existsSync(newAbs)) continue
        const oldAbs = join(
          root,
          offeringOldPath(uni, major, term.year, term.semester)
        )
        const diffAbs = join(
          root,
          offeringDiffPath(uni, major, term.year, term.semester)
        )
        const current = getOfferings(uni, major, term.year, term.semester)
        if (!current) continue

        if (!existsSync(oldAbs)) {
          // First snapshot: old is empty (no previous) – diff must be empty too
          const emptyOld: OfferingDoc = {
            year: current.year,
            semester: current.semester,
            scrapedAt: current.scrapedAt,
            offerings: [],
          }
          writeFileSync(
            oldAbs,
            JSON.stringify(emptyOld, null, 2) + "\n",
            "utf-8"
          )
          console.log(
            `placeholder: ${offeringOldPath(uni, major, term.year, term.semester)} (empty)`
          )
          created++
        }
        if (!existsSync(diffAbs)) {
          const prev = getPreviousOfferings(
            uni,
            major,
            term.year,
            term.semester
          )
          // For first snapshot (old empty or missing), diff is empty – don't notify "everything added"
          const isFirst = !prev || prev.offerings.length === 0
          const diff = isFirst
            ? {
                added: [] as Offering[],
                removed: [] as Offering[],
                updated: [] as Array<{
                  after: Offering
                  changes: Array<{
                    field: string
                    label: string
                    before: string | null
                    after: string | null
                  }>
                }>,
              }
            : calculateDiff(current, prev)
          const doc = {
            id: randomUUID(),
            generatedAt: new Date().toISOString(),
            beforeSha: null,
            afterSha: git("rev-parse HEAD") || null,
            universitySlug: uni,
            majorSlug: major,
            year: term.year,
            semester: term.semester,
            summary: {
              added: diff.added.length,
              removed: diff.removed.length,
              changed: diff.updated.length,
            },
            added: diff.added,
            removed: diff.removed,
            updated: diff.updated,
          }
          // validate before write
          offeringDiffDocSchema.parse(doc)
          mkdirSync(dirname(diffAbs), { recursive: true })
          writeFileSync(diffAbs, JSON.stringify(doc, null, 2) + "\n", "utf-8")
          console.log(
            `placeholder: ${offeringDiffPath(uni, major, term.year, term.semester)} id=${doc.id} (empty)`
          )
          created++
        }
      }
    }
  }
  return created
}

function syncChanged(before: string | null): number {
  const afterSha = git("rev-parse HEAD") || null
  let changed: string[] = []
  const glob = ":(glob)**/courses/**/new.json"
  if (before) {
    const out = git(
      `diff --name-only --diff-filter=ACMR ${before} HEAD -- "${glob}"`
    )
    if (out) changed = out.split("\n").filter(Boolean)
  } else {
    // local: staged + unstaged + untracked new.json
    const staged = git(`diff --name-only --diff-filter=ACMR HEAD -- "${glob}"`)
    const untracked = git(`ls-files --others --exclude-standard -- "${glob}"`)
    const all = [
      ...(staged ? staged.split("\n") : []),
      ...(untracked ? untracked.split("\n") : []),
    ].filter(Boolean)
    changed = [...new Set(all)]
  }

  if (changed.length === 0) {
    console.log("No offering snapshots changed - nothing to rotate.")
    return 0
  }

  const root = registryRoot()
  let rotated = 0
  for (const file of changed) {
    // file is repo-relative like packages/registry/registry/universities/.../new.json or registry/... ?
    // Normalize to registryRoot-relative: find "universities/" segment
    const idx = file.indexOf("universities/")
    if (idx === -1) {
      console.log(`skip (not a registry path): ${file}`)
      continue
    }
    const rel = file.slice(idx) // universities/.../courses/.../new.json
    const abs = join(root, rel)
    if (!existsSync(abs)) {
      console.log(`snapshot removed, skipping: ${file}`)
      continue
    }
    // Parse uni/major/year/semester from rel
    const m = rel.match(
      /^universities\/([^/]+)\/majors\/([^/]+)\/courses\/(\d{4})\/([^/]+)\/new\.json$/
    )
    if (!m) {
      console.log(`skip (unparseable): ${file}`)
      continue
    }
    const [, uni, major, yearStr, semDir] = m
    const year = Number(yearStr)
    const semester =
      semDir === "mehr"
        ? "MEHR"
        : semDir === "bahman"
          ? "BAHMAN"
          : semDir === "summer"
            ? "SUMMER"
            : null
    if (!semester) {
      console.log(`skip (unknown semester): ${file}`)
      continue
    }

    const oldRel = offeringOldPath(
      uni,
      major,
      year,
      semester as "MEHR" | "BAHMAN" | "SUMMER"
    )
    const oldAbs = join(root, oldRel)
    const diffRel = offeringDiffPath(
      uni,
      major,
      year,
      semester as "MEHR" | "BAHMAN" | "SUMMER"
    )
    const diffAbs = join(root, diffRel)

    // If file is new to BEFORE/HEAD, there is no previous version - treat as first snapshot
    let hadBefore = true
    const ref = before ?? "HEAD"
    try {
      execSync(`git cat-file -e ${ref}:"${file}"`, { stdio: "ignore" })
    } catch {
      hadBefore = false
    }

    if (!hadBefore) {
      console.log(`first snapshot, creating placeholders: ${file}`)
      // First snapshot: old empty, diff empty
      const current = JSON.parse(readFileSync(abs, "utf-8")) as OfferingDoc
      const emptyOld: OfferingDoc = {
        year: current.year,
        semester: current.semester,
        scrapedAt: current.scrapedAt,
        offerings: [],
      }
      writeFileSync(oldAbs, JSON.stringify(emptyOld, null, 2) + "\n", "utf-8")
      const doc = {
        id: randomUUID(),
        generatedAt: new Date().toISOString(),
        beforeSha: before,
        afterSha,
        universitySlug: uni,
        majorSlug: major,
        year,
        semester,
        summary: { added: 0, removed: 0, changed: 0 },
        added: [],
        removed: [],
        updated: [],
      }
      offeringDiffDocSchema.parse(doc)
      mkdirSync(dirname(diffAbs), { recursive: true })
      writeFileSync(diffAbs, JSON.stringify(doc, null, 2) + "\n", "utf-8")
      console.log(`  -> ${oldRel} + ${diffRel} id=${doc.id}`)
      rotated++
      continue
    }

    // Existing file: previous new.json -> old.json
    let prevContent: string
    try {
      if (before)
        prevContent = execSync(`git show ${before}:"${file}"`, {
          encoding: "utf-8",
        })
      else {
        // local: HEAD version
        prevContent = execSync(`git show HEAD:"${file}"`, { encoding: "utf-8" })
        // if HEAD doesn't have it (staged new file), fallback to empty
        if (!prevContent) prevContent = readFileSync(abs, "utf-8")
      }
    } catch {
      prevContent = ""
    }

    if (!prevContent) {
      console.log(`no previous content, skipping: ${file}`)
      continue
    }

    // Only rotate if content actually changed (git diff already implies change, but handle whitespace)
    const curContent = readFileSync(abs, "utf-8")
    if (prevContent === curContent) {
      console.log(`content unchanged, no rotation needed: ${file}`)
      // Still ensure diff exists
      if (!existsSync(diffAbs)) {
        const cur = JSON.parse(curContent)
        const prev = JSON.parse(prevContent)
        const d = calculateDiff(cur, prev)
        const doc = {
          id: randomUUID(),
          generatedAt: new Date().toISOString(),
          beforeSha: before,
          afterSha,
          universitySlug: uni,
          majorSlug: major,
          year,
          semester,
          summary: {
            added: d.added.length,
            removed: d.removed.length,
            changed: d.updated.length,
          },
          added: d.added,
          removed: d.removed,
          updated: d.updated,
        }
        mkdirSync(dirname(diffAbs), { recursive: true })
        writeFileSync(diffAbs, JSON.stringify(doc, null, 2) + "\n", "utf-8")
        console.log(`  -> created missing ${diffRel} id=${doc.id}`)
        rotated++
      }
      continue
    }

    writeFileSync(
      oldAbs,
      prevContent.endsWith("\n") ? prevContent : prevContent + "\n",
      "utf-8"
    )
    console.log(`rotated: ${file} -> ${oldRel}`)

    // Generate diff.json with fresh UUID
    const currentDoc = JSON.parse(curContent)
    const prevDoc = JSON.parse(prevContent)
    const d = calculateDiff(currentDoc, prevDoc)
    const doc = {
      id: randomUUID(),
      generatedAt: new Date().toISOString(),
      beforeSha: before,
      afterSha,
      universitySlug: uni,
      majorSlug: major,
      year,
      semester,
      summary: {
        added: d.added.length,
        removed: d.removed.length,
        changed: d.updated.length,
      },
      added: d.added,
      removed: d.removed,
      updated: d.updated,
    }
    offeringDiffDocSchema.parse(doc)
    mkdirSync(dirname(diffAbs), { recursive: true })
    writeFileSync(diffAbs, JSON.stringify(doc, null, 2) + "\n", "utf-8")
    console.log(
      `  -> ${diffRel} id=${doc.id} summary=${JSON.stringify(doc.summary)}`
    )
    rotated++
  }
  return rotated
}

const { before, ensureOnly } = parseArgs()
const professorsMajors = syncProfessors()
const placeholders = ensurePlaceholders()
if (ensureOnly) {
  console.log(
    `Done (ensure-only). placeholders created: ${placeholders}, professors updated: ${professorsMajors}`
  )
  process.exit(0)
}
const rotated = syncChanged(before)
console.log(
  `Done. placeholders=${placeholders} rotated=${rotated} professorsUpdated=${professorsMajors}`
)
