import { describe, it, expect } from "vitest"
import {
  getChart,
  getOfferings,
  getChartCourses,
  listOfferingTerms,
  findChartYearDirForYear,
  listChartYearDirs,
} from "../src/loader"

// azad-malard / computer-engineering is the only fully-populated university
const UNI = "azad-malard"
const MAJOR = "computer-engineering"
const DEGREE = "bachelors-degree"

describe("listOfferingTerms", () => {
  it("returns terms sorted newest-first", () => {
    const terms = listOfferingTerms(UNI, MAJOR)
    expect(terms.length).toBeGreaterThan(0)
    expect(terms[0].year).toBeGreaterThanOrEqual(terms[terms.length - 1].year)
  })

  it("returns empty for non-existent major", () => {
    expect(listOfferingTerms("fake-uni", "fake-major")).toEqual([])
  })
})

describe("getChart", () => {
  it("returns a chart for a valid year+semester", () => {
    const chart = getChart(UNI, MAJOR, DEGREE, "[1400-1401]", "MEHR")
    expect(chart).not.toBeNull()
    expect(chart!.degree).toBe(DEGREE)
    expect(Object.keys(chart!.terms).length).toBeGreaterThan(0)
  })

  it("falls back to both.json when mehr.json is absent", () => {
    const chart = getChart(UNI, MAJOR, DEGREE, "[1400-1401]", "MEHR")
    expect(chart).not.toBeNull()
    expect(chart!.semester).toBe("BOTH")
  })

  it("returns null for SUMMER semester", () => {
    expect(getChart(UNI, MAJOR, DEGREE, "[1400-1401]", "SUMMER")).toBeNull()
  })

  it("returns null for non-existent year directory", () => {
    expect(getChart(UNI, MAJOR, DEGREE, "9999", "MEHR")).toBeNull()
  })
})

describe("getChartCourses", () => {
  it("flattens all terms + moaref into a flat list", () => {
    const chart = getChart(UNI, MAJOR, DEGREE, "[1400-1401]", "MEHR")!
    const courses = getChartCourses(chart)
    expect(courses.length).toBeGreaterThan(0)
    // Should include moaref courses
    const moarefNames = chart.moaref.map((c) => c.name)
    for (const name of moarefNames) {
      expect(courses.some((c) => c.name === name)).toBe(true)
    }
  })
})

describe("getOfferings", () => {
  it("returns offerings for an existing term", () => {
    const terms = listOfferingTerms(UNI, MAJOR)
    expect(terms.length).toBeGreaterThan(0)
    const t = terms[0]
    const doc = getOfferings(UNI, MAJOR, t.year, t.semester)
    expect(doc).not.toBeNull()
    expect(doc!.offerings.length).toBeGreaterThan(0)
  })

  it("returns null for non-existent term", () => {
    expect(getOfferings(UNI, MAJOR, 9999, "MEHR")).toBeNull()
  })
})

describe("findChartYearDirForYear", () => {
  it("finds the year dir for year 1400", () => {
    const ydir = findChartYearDirForYear(UNI, MAJOR, DEGREE, 1400)
    expect(ydir).not.toBeNull()
  })

  it("returns null for year outside any range", () => {
    expect(findChartYearDirForYear(UNI, MAJOR, DEGREE, 9999)).toBeNull()
  })
})

describe("listChartYearDirs", () => {
  it("returns year directories sorted newest-first", () => {
    const dirs = listChartYearDirs(UNI, MAJOR, DEGREE)
    expect(dirs.length).toBeGreaterThan(0)
  })
})
