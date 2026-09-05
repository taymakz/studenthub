import { describe, it, expect } from "vitest"

// Copy of the new detectConflicts logic for isolated testing
// (mirrors apps/mini-app/components/app/courses/conflicts.tsx)

interface Offering {
  index: string
  courseName: string
  classSchedule: string[]
  examSchedule: string | null
}

function detectConflicts(
  notedOfferings: Offering[],
  opts: {
    moarefNames: Set<string>
    chartCourses: Array<{
      name: string
      prerequisites: string[] | number
      corequisites: string[]
    }>
    passedNames: Set<string>
    failedNames: Set<string>
    isLastTerm?: boolean
  }
) {
  const {
    moarefNames,
    chartCourses,
    passedNames,
    failedNames,
    isLastTerm = false,
  } = opts
  const out: any[] = []
  let id = 0

  // Moaref: 1 per term, 2 for last term
  const moaref = notedOfferings.filter((o) => moarefNames.has(o.courseName))
  const maxMoaref = isLastTerm ? 2 : 1
  if (moaref.length > maxMoaref) {
    out.push({
      id: `moaref-${id++}`,
      reason: `moaref`,
      type: "moaref",
      courses: moaref,
    })
  }

  const chartMap = new Map<
    string,
    { prerequisites: string[] | number; corequisites: string[] }
  >()
  for (const c of chartCourses)
    chartMap.set(c.name, {
      prerequisites: c.prerequisites,
      corequisites: c.corequisites,
    })

  const passedUnits = [...passedNames].reduce((sum, name) => sum + 3, 0) // simplified 3 units per passed

  const preReqMap = new Map<string, Offering[]>()
  const coReqMap = new Map<string, Offering[]>()

  for (const offering of notedOfferings) {
    const entry = chartMap.get(offering.courseName)
    if (!entry) continue
    const pre = entry.prerequisites
    if (Array.isArray(pre)) {
      for (const reqName of pre) {
        if (passedNames.has(reqName as string)) continue
        if (failedNames.has(reqName as string)) {
          if (!notedOfferings.some((o) => o.courseName === reqName)) {
            const arr = preReqMap.get(reqName as string) ?? []
            arr.push(offering)
            preReqMap.set(reqName as string, arr)
          }
        } else {
          const arr = preReqMap.get(reqName as string) ?? []
          arr.push(offering)
          preReqMap.set(reqName as string, arr)
        }
      }
    } else if (typeof pre === "number") {
      if (passedUnits < pre) {
        const key = `حداقل ${pre} واحد`
        const arr = preReqMap.get(key) ?? []
        arr.push(offering)
        preReqMap.set(key, arr)
      }
    }
    const co = entry.corequisites
    if (Array.isArray(co)) {
      for (const reqName of co) {
        if (
          !passedNames.has(reqName) &&
          !notedOfferings.some((o) => o.courseName === reqName)
        ) {
          const arr = coReqMap.get(reqName) ?? []
          arr.push(offering)
          coReqMap.set(reqName, arr)
        }
      }
    }
  }

  for (const [name, courses] of preReqMap.entries()) {
    out.push({
      id: `pre-${id++}`,
      reason: name,
      type: "pre_requisites",
      courses,
    })
  }
  for (const [name, courses] of coReqMap.entries()) {
    out.push({ id: `co-${id++}`, reason: name, type: "co_requisites", courses })
  }

  return out
}

function off(
  index: string,
  courseName: string,
  overrides: Partial<Offering> = {}
): Offering {
  return {
    index,
    courseName,
    classSchedule: [],
    examSchedule: null,
    ...overrides,
  } as Offering
}

describe("conflicts – prerequisites", () => {
  const chart = [
    { name: "ریاضی عمومی 1", prerequisites: [], corequisites: [] },
    {
      name: "ریاضی عمومی 2",
      prerequisites: ["ریاضی عمومی 1"],
      corequisites: [],
    },
    { name: "پروژه", prerequisites: 100, corequisites: [] },
  ]

  it("no conflict when prerequisite passed", () => {
    const noted = [off("1", "ریاضی عمومی 2")]
    const passed = new Set(["ریاضی عمومی 1"])
    const conflicts = detectConflicts(noted, {
      moarefNames: new Set(),
      chartCourses: chart,
      passedNames: passed,
      failedNames: new Set(),
    })
    expect(conflicts.filter((c) => c.type === "pre_requisites")).toHaveLength(0)
  })

  it("conflict when prerequisite not passed", () => {
    const noted = [off("1", "ریاضی عمومی 2")]
    const conflicts = detectConflicts(noted, {
      moarefNames: new Set(),
      chartCourses: chart,
      passedNames: new Set(),
      failedNames: new Set(),
    })
    expect(conflicts.some((c) => c.type === "pre_requisites")).toBe(true)
  })

  it("conflict when prerequisite failed but not taken together", () => {
    const noted = [off("1", "ریاضی عمومی 2")]
    const failed = new Set(["ریاضی عمومی 1"])
    const conflicts = detectConflicts(noted, {
      moarefNames: new Set(),
      chartCourses: chart,
      passedNames: new Set(),
      failedNames: failed,
    })
    expect(conflicts.filter((c) => c.type === "pre_requisites")).toHaveLength(1)
  })

  it("no conflict when failed prerequisite taken together", () => {
    const noted = [off("1", "ریاضی عمومی 2"), off("2", "ریاضی عمومی 1")]
    const failed = new Set(["ریاضی عمومی 1"])
    const conflicts = detectConflicts(noted, {
      moarefNames: new Set(),
      chartCourses: chart,
      passedNames: new Set(),
      failedNames: failed,
    })
    expect(conflicts.filter((c) => c.type === "pre_requisites")).toHaveLength(0)
  })

  it("unit prerequisite: conflict when passed units < required", () => {
    const noted = [off("1", "پروژه")]
    const conflicts = detectConflicts(noted, {
      moarefNames: new Set(),
      chartCourses: chart,
      passedNames: new Set(["ریاضی عمومی 1"]), // 3 units
      failedNames: new Set(),
    })
    expect(conflicts.some((c) => c.reason.includes("حداقل 100"))).toBe(true)
  })

  it("unit prerequisite: no conflict when enough units", () => {
    const manyPassed = new Set(Array.from({ length: 40 }, (_, i) => `درس ${i}`))
    const chartMany = [{ name: "پروژه", prerequisites: 100, corequisites: [] }]
    // Mock passedUnits as 120 via 40*3
    const conflicts = detectConflicts([off("1", "پروژه")], {
      moarefNames: new Set(),
      chartCourses: chartMany,
      passedNames: manyPassed,
      failedNames: new Set(),
    })
    // With 40*3=120 units, should not conflict for 100
    expect(conflicts.filter((c) => c.type === "pre_requisites")).toHaveLength(0)
  })
})

describe("conflicts – moaref & last term", () => {
  const chart: any[] = []

  it("1 moaref allowed for normal term", () => {
    const noted = [off("1", "معارف 1"), off("2", "ریاضی")]
    const moaref = new Set(["معارف 1"])
    // Only 1 moaref in noted, should be ok
    const conflicts = detectConflicts(noted, {
      moarefNames: moaref,
      chartCourses: chart,
      passedNames: new Set(),
      failedNames: new Set(),
      isLastTerm: false,
    })
    expect(conflicts.filter((c) => c.type === "moaref")).toHaveLength(0)
  })

  it("2 moaref → conflict for normal term", () => {
    const noted = [off("1", "معارف 1"), off("2", "معارف 2")]
    const moaref = new Set(["معارف 1", "معارف 2"])
    const conflicts = detectConflicts(noted, {
      moarefNames: moaref,
      chartCourses: chart,
      passedNames: new Set(),
      failedNames: new Set(),
      isLastTerm: false,
    })
    expect(conflicts.some((c) => c.type === "moaref")).toBe(true)
  })

  it("2 moaref allowed for last term", () => {
    const noted = [off("1", "معارف 1"), off("2", "معارف 2")]
    const moaref = new Set(["معارف 1", "معارف 2"])
    const conflicts = detectConflicts(noted, {
      moarefNames: moaref,
      chartCourses: chart,
      passedNames: new Set(),
      failedNames: new Set(),
      isLastTerm: true,
    })
    expect(conflicts.filter((c) => c.type === "moaref")).toHaveLength(0)
  })

  it("3 moaref → conflict even for last term", () => {
    const noted = [
      off("1", "معارف 1"),
      off("2", "معارف 2"),
      off("3", "معارف 3"),
    ]
    const moaref = new Set(["معارف 1", "معارف 2", "معارف 3"])
    const conflicts = detectConflicts(noted, {
      moarefNames: moaref,
      chartCourses: chart,
      passedNames: new Set(),
      failedNames: new Set(),
      isLastTerm: true,
    })
    expect(conflicts.some((c) => c.type === "moaref")).toBe(true)
  })
})
