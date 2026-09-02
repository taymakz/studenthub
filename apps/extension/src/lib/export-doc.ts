import type { ScrapedOffering, Semester } from "./types";

/** Canonical key order for serialized offerings (readable diffs in PRs). */
const OFFERING_KEY_ORDER = [
  "index",
  "courseCode",
  "courseName",
  "courseType",
  "theoreticalUnits",
  "practicalUnits",
  "classCode",
  "degree",
  "presentationType",
  "minCapacity",
  "maxCapacity",
  "currentEnrollment",
  "classSchedule",
  "examSchedule",
  "professor",
  "location",
] as const;

const NULLABLE_KEYS = new Set([
  "courseType",
  "presentationType",
  "minCapacity",
  "maxCapacity",
  "currentEnrollment",
  "classSchedule",
  "examSchedule",
  "professor",
  "location",
]);

function orderOffering(offering: ScrapedOffering): Record<string, unknown> {
  const record = offering as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of OFFERING_KEY_ORDER) {
    const value = record[key];
    if (value === undefined) continue;
    if (NULLABLE_KEYS.has(key) && value === null) {
      out[key] = null;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export interface OfferingDoc {
  scrapedAt: string;
  offerings: Array<Record<string, unknown>>;
}

/** Build the registry document - year/semester are now inferred from the
    folder path, not stored in the JSON. */
export function buildOfferingDoc(rows: ScrapedOffering[]): OfferingDoc {
  return {
    scrapedAt: new Date().toISOString(),
    offerings: rows.map(orderOffering),
  };
}

export function serializeOfferingDoc(doc: OfferingDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function offeringFileName(): string {
  return `studenthub-offerings.json`;
}

/**
 * Merge freshly scraped rows into stored rows. Existing rows win on index
 * collision (re-scraping a page refreshes its rows instead of duplicating).
 * Rows without an index have no identity - they are dropped (they would all
 * collide on "" and collapse the whole page into one row).
 */
export function mergeRows(
  stored: ScrapedOffering[],
  incoming: ScrapedOffering[],
): { merged: ScrapedOffering[]; added: number; refreshed: number } {
  const byIndex = new Map<string, ScrapedOffering>();
  for (const row of stored) if (row.index) byIndex.set(row.index, row);

  let added = 0;
  let refreshed = 0;
  for (const row of incoming) {
    if (!row.index) continue;
    if (byIndex.has(row.index)) refreshed++;
    else added++;
    byIndex.set(row.index, row);
  }

  return { merged: [...byIndex.values()], added, refreshed };
}
