import type { Offering, OfferingDoc } from "@workspace/registry"

/**
 * Offering diff:
 *   - identity = offering `index` (شماره)
 *   - added   = indexes in new but not in old
 *   - removed = indexes in old but not in new
 *   - changed = same index, any tracked field differs
 */

export interface ChangedField {
  field: string
  label: string
  before: string | null
  after: string | null
}

export interface UpdatedOffering {
  after: Offering
  changes: ChangedField[]
}

export interface OfferingDiff {
  added: Offering[]
  removed: Offering[]
  updated: UpdatedOffering[]
}

const TRACKED_FIELDS: Array<{
  key:
    | keyof Pick<
        Offering,
        | "minCapacity"
        | "maxCapacity"
        | "classSchedule"
        | "examSchedule"
        | "location"
      >
    | "professor"
  label: string
}> = [
  { key: "minCapacity", label: "حداقل ظرفیت" },
  { key: "maxCapacity", label: "حداکثر ظرفیت" },
  { key: "classSchedule", label: "زمان کلاس‌ها" },
  { key: "examSchedule", label: "زمان امتحان" },
  { key: "professor", label: "استاد" },
  { key: "location", label: "مکان" },
]

function professorName(professor: Offering["professor"]): string | null {
  if (!professor) return null
  if (typeof professor === "string") return professor
  return professor.fa ?? null
}

function fieldValue(offering: Offering, key: string): string | null {
  switch (key) {
    case "professor":
      return professorName(offering.professor)
    default:
      return (
        (
          offering[key as keyof Offering] as string | number | null | undefined
        )?.toString() ?? null
      )
  }
}

/** Diffs a term's latest snapshot against its rotated previous snapshot. */
export function calculateOfferingChanges(
  current: OfferingDoc,
  previous: OfferingDoc | null
): OfferingDiff {
  if (!previous) {
    // First-ever snapshot: nothing to compare, everything is "added" but we
    // deliberately do NOT notify on first snapshots - there is no baseline.
    return { added: [], removed: [], updated: [] }
  }

  const prevByIndex = new Map(previous.offerings.map((o) => [o.index, o]))
  const currByIndex = new Map(current.offerings.map((o) => [o.index, o]))

  const added: Offering[] = []
  const updated: UpdatedOffering[] = []

  for (const offering of current.offerings) {
    const before = prevByIndex.get(offering.index)
    if (!before) {
      added.push(offering)
      continue
    }
    const changes: ChangedField[] = []
    for (const { key, label } of TRACKED_FIELDS) {
      const beforeValue = fieldValue(before, key)
      const afterValue = fieldValue(offering, key)
      if (beforeValue !== afterValue) {
        changes.push({
          field: key,
          label,
          before: beforeValue,
          after: afterValue,
        })
      }
    }
    if (changes.length > 0) updated.push({ after: offering, changes })
  }

  const removed = previous.offerings.filter((o) => !currByIndex.has(o.index))

  return { added, removed, updated }
}

/** Every affected offering index - the recipient-matching key set. */
export function affectedIndexes(diff: OfferingDiff): Set<string> {
  const out = new Set<string>()
  for (const o of diff.added) out.add(o.index)
  for (const o of diff.removed) out.add(o.index)
  for (const u of diff.updated) out.add(u.after.index)
  return out
}

export function diffSummary(diff: OfferingDiff) {
  return {
    added: diff.added.length,
    removed: diff.removed.length,
    changed: diff.updated.length,
  }
}
