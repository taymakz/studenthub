import {
  findChartYearDirForYear,
  formatYearDirectory,
  getChart,
  getChartCourses,
  getLatestOfferings,
  getProfessors,
  listChartYearDirs,
  listMajorSlugs,
  listUniversitySlugs,
  parseYearDirectory,
} from "../src/index"

console.log("universities:", listUniversitySlugs())
console.log("azad-malard majors:", listMajorSlugs("azad-malard"))

const dirs = listChartYearDirs(
  "azad-malard",
  "computer-engineering",
  "bachelor"
)
console.log("bachelor chart dirs:", dirs.map(formatYearDirectory))

// Detector unit checks
for (const name of ["1405", "[1403-1404]", "bad", "[1404-1403]", "1300"]) {
  console.log(`parse(${name}):`, JSON.stringify(parseYearDirectory(name)))
}

const match = findChartYearDirForYear(
  "azad-malard",
  "computer-engineering",
  "bachelor",
  1404
)
console.log("chart dir covering 1404:", match && formatYearDirectory(match))

const chart = getChart(
  "azad-malard",
  "computer-engineering",
  "bachelor",
  "[1403-1404]",
  "MEHR" as const
)
console.log(
  "chart courses (terms+moaref):",
  chart ? getChartCourses(chart).length : null
)

const latest = getLatestOfferings("azad-malard", "computer-engineering")
console.log(
  "latest offerings:",
  latest
    ? `${latest.term.year}/${latest.term.semester} x${latest.doc.offerings.length}`
    : null
)

console.log(
  "professors:",
  getProfessors("azad-malard", "computer-engineering").map((p) => p.slug)
)
