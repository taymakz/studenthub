import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  chartDocSchema,
  findChartYearDirForYear,
  getArchives,
  getChart,
  getGroups,
  getLatestOfferings,
  getOfferings,
  getPreviousOfferings,
  getProfessors,
  listChartYearDirs,
  listMajorSlugs,
  listOfferingTerms,
  listUniversitySlugs,
  registryRoot,
} from "@workspace/registry"
import type { ChartDoc, Semester } from "@workspace/registry"

/**
 * Registry access for the API. Everything list-shaped reads the GENERATED
 * index files (registry/index/*.json) - one small read per request, never a
 * directory walk (serverless-friendly). Single documents load through the
 * validated fs loader.
 *
 * Index-entry types are declared here (not imported from the builder) so the
 * API contract stays decoupled from build-index internals.
 */

export interface UniversityIndexEntry {
  slug: string
  name: { fa: string; en?: string }
  location: { fa: string; en?: string }
}

export interface MajorIndexEntry {
  uniSlug: string
  slug: string
  name: { fa: string; en?: string }
  degrees: Array<{
    slug: string
    name: { fa: string; en?: string }
    termCount: number
    maxTermCount?: number
  }>
}

export interface ChartIndexEntry {
  uniSlug: string
  majorSlug: string
  degreeSlug: string
  yearDir: string
  semesters: Semester[]
  path: string
}

export interface OfferingTermIndexEntry {
  uniSlug: string
  majorSlug: string
  year: number
  semester: Semester
  hasPrevious: boolean
}

export interface CourseIndexEntry {
  name: string
  code?: string
  theoreticalUnits: number
  practicalUnits: number
  refs: Array<{ uniSlug: string; majorSlug: string; degreeSlug: string }>
}

export interface RegistryIndexes {
  universities: UniversityIndexEntry[]
  majors: MajorIndexEntry[]
  charts: ChartIndexEntry[]
  offeringTerms: OfferingTermIndexEntry[]
  courses: CourseIndexEntry[]
}

const indexCache = new Map<string, { at: number; data: unknown }>()

/**
 * On Vercel the bundled server.js lives in dist/, and build.mjs copies
 * the full registry to dist/registry/. We resolve that path and override
 * registryRoot() so ALL registry reads (index, charts, offerings) work.
 */
const distRegistryDir = (function () {
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const candidate = join(here, "registry")
    // Only use if it actually exists (Vercel); local dev uses registryRoot().
    const { existsSync } = require("node:fs")
    return existsSync(candidate) ? candidate : null
  } catch {
    return null
  }
})()

/** Effective registry root: dist/registry/ on Vercel, registryRoot() locally. */
function effectiveRegistryRoot(): string {
  return distRegistryDir ?? registryRoot()
}

function readIndexFile<T>(name: string): T[] {
  const cached = indexCache.get(name)
  if (cached && Date.now() - cached.at < 60_000) return cached.data as T[]

  try {
    const raw = readFileSync(
      join(effectiveRegistryRoot(), "index", `${name}.json`),
      "utf-8"
    )
    const data = JSON.parse(raw) as T[]
    indexCache.set(name, { at: Date.now(), data })
    return data
  } catch {
    // Missing index = registry not built yet; degrade to empty lists.
    return []
  }
}

export function readIndexes(): RegistryIndexes {
  return {
    universities: readIndexFile<UniversityIndexEntry>("universities"),
    majors: readIndexFile<MajorIndexEntry>("majors"),
    charts: readIndexFile<ChartIndexEntry>("charts"),
    offeringTerms: readIndexFile<OfferingTermIndexEntry>("offering-terms"),
    courses: readIndexFile<CourseIndexEntry>("courses"),
  }
}

/**
 * Loads ONE chart document by its registry-relative path. Only chart files
 * inside universities/** are reachable; traversal and everything else is
 * rejected before touching the filesystem.
 */
export function getChartByPath(relPath: string): ChartDoc | null {
  const normalized = relPath.replaceAll("\\", "/")
  if (
    !normalized.startsWith("universities/") ||
    normalized.includes("..") ||
    !/[\d\]]\/(mehr|bahman|summer|both)\.json$/.test(normalized)
  ) {
    return null
  }
  try {
    const raw = readFileSync(join(registryRoot(), normalized), "utf-8")
    return chartDocSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export {
  findChartYearDirForYear,
  getArchives,
  getChart,
  getGroups,
  getLatestOfferings,
  getOfferings,
  getPreviousOfferings,
  getProfessors,
  listChartYearDirs,
  listMajorSlugs,
  listOfferingTerms,
  listUniversitySlugs,
}

/** Vercel-aware registry root — re-exports for callers that import from here. */
export { effectiveRegistryRoot as registryRoot }
