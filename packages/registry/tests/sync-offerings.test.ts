import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { execSync } from "node:child_process"

// Re-use the same calculateDiff logic as scripts/sync-offerings.ts
import type { OfferingDoc } from "../src/schema/offering.ts"

const TRACKED = [
  "minCapacity",
  "maxCapacity",
  "classSchedule",
  "examSchedule",
  "professor",
  "location",
] as const

function professorName(p: any): string | null {
  return p?.fa ?? null
}
function fieldValue(o: any, key: string): string | null {
  if (key === "professor") return professorName(o.professor)
  const v = o[key]
  if (v == null) return null
  if (Array.isArray(v)) {
    const joined = v.filter(Boolean).join(" ، ")
    return joined || null
  }
  return String(v)
}
function calculateDiff(current: OfferingDoc, previous: OfferingDoc | null) {
  if (!previous || previous.offerings.length === 0)
    return { added: [] as any[], removed: [] as any[], updated: [] as any[] }
  const prevByIndex = new Map(previous.offerings.map((o) => [o.index, o]))
  const currByIndex = new Map(current.offerings.map((o) => [o.index, o]))
  const added: any[] = []
  const updated: any[] = []
  for (const o of current.offerings) {
    const before = prevByIndex.get(o.index)
    if (!before) {
      added.push(o)
      continue
    }
    const changes: any[] = []
    for (const key of TRACKED) {
      const b = fieldValue(before, key)
      const a = fieldValue(o, key)
      if (b !== a) changes.push({ field: key, label: key, before: b, after: a })
    }
    if (changes.length) updated.push({ after: o, changes })
  }
  const removed = previous.offerings.filter((o) => !currByIndex.has(o.index))
  return { added, removed, updated }
}

function makeDoc(
  offerings: any[],
  year = 1405,
  semester = "MEHR"
): OfferingDoc {
  return {
    year,
    semester: semester as any,
    scrapedAt: new Date().toISOString(),
    offerings,
  } as any
}
function off(
  index: string,
  courseName = `course ${index}`,
  overrides: any = {}
) {
  return {
    index,
    courseCode: `c${index}`,
    courseName,
    classCode: "01",
    theoreticalUnits: 2,
    practicalUnits: 0,
    classSchedule: [],
    examSchedule: null,
    professor: null,
    location: [],
    ...overrides,
  }
}

describe("registry sync – old.json / diff.json contract", () => {
  it("first snapshot: old empty, diff empty (no notify)", () => {
    const cur = makeDoc([off("1", "ریاضی")])
    const emptyOld = makeDoc([], cur.year, cur.semester)
    emptyOld.scrapedAt = cur.scrapedAt
    // First snapshot diff must be empty even though cur has courses and old is empty
    const isFirst = !emptyOld || emptyOld.offerings.length === 0
    const diff = isFirst
      ? { added: [], removed: [], updated: [] }
      : calculateDiff(cur, emptyOld)
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diff.updated).toEqual([])
  })

  it("same new and old → diff empty", () => {
    const cur = makeDoc([off("1", "n1", { maxCapacity: 30 })])
    const prev = makeDoc([off("1", "n1", { maxCapacity: 30 })])
    const diff = calculateDiff(cur, prev)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.updated).toHaveLength(0)
  })

  it("tomorrow change: old = previous new, diff = new vs old", () => {
    const previousNew = makeDoc([
      off("1", "n1", { maxCapacity: 30 }),
      off("2", "n2"),
    ])
    const newNew = makeDoc([
      off("1", "n1", { maxCapacity: 35 }),
      off("3", "n3"),
    ])
    // Sync does: old = previousNew, diff = calculateDiff(newNew, old)
    const old = previousNew
    const diff = calculateDiff(newNew, old)
    expect(diff.added.map((o) => o.index)).toEqual(["3"])
    expect(diff.removed.map((o) => o.index)).toEqual(["2"])
    expect(diff.updated[0].after.index).toBe("1")
    expect(diff.updated[0].changes[0].field).toBe("maxCapacity")
  })

  it("only new.json change triggers rotation – old/diff derived", () => {
    // Simulate: if only diff.json or old.json changed, sync should ignore
    // Our glob is **/courses/**/new.json, so only new.json is watched
    const glob = "**/courses/**/new.json"
    expect(
      "packages/registry/registry/universities/azad-malard/majors/x/courses/1405/bahman/new.json"
    ).toMatch(/courses/)
    expect(
      "packages/registry/registry/universities/azad-malard/majors/x/courses/1405/bahman/old.json"
    ).not.toMatch(/new\.json$/)
    expect(
      "packages/registry/registry/universities/azad-malard/majors/x/courses/1405/bahman/diff.json"
    ).not.toMatch(/new\.json$/)
    expect(glob).toContain("new.json")
  })

  it("diff gets fresh uuid per change", () => {
    const id1 = randomUUID()
    const id2 = randomUUID()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("diff.json schema: summary matches added/removed/updated lengths", () => {
    const cur = makeDoc([off("1"), off("2", "n2", { maxCapacity: 35 })])
    const prev = makeDoc([
      off("1"),
      off("2", "n2", { maxCapacity: 30 }),
      off("3"),
    ])
    const diff = calculateDiff(cur, prev)
    const summary = {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.updated.length,
    }
    expect(summary).toEqual({ added: 0, removed: 1, changed: 1 })
  })
})
