// Schemas & types
export * from "./schema/index"

// Year directory utilities
export * from "./year-dir"

// Path builders
export * from "./paths"

// Loader
export {
  getArchives,
  getChart,
  getChartCourses,
  getDegree,
  getGroups,
  getLatestOfferings,
  getMajor,
  getOfferingDiff,
  getOfferings,
  getPreviousOfferings,
  getProfessors,
  getUniversity,
  findChartYearDirForYear,
  listChartFiles,
  listChartYearDirs,
  listMajorSlugs,
  listOfferingTerms,
  listUniversitySlugs,
  RegistryNotFoundError,
  RegistryParseError,
  type OfferingTermRef,
} from "./loader"

// Whole-tree validation (CI)
export { validateRegistry } from "./validate"

// Search index generation (CI)
export { buildRegistryIndex } from "./build-index"
