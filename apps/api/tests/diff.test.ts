import { describe, it, expect } from "vitest";
import { calculateOfferingChanges, diffSummary } from "../src/lib/notifications/diff.ts";
import type { OfferingDoc } from "@workspace/registry";

function makeDoc(offerings: OfferingDoc["offerings"], year = 1405, semester: OfferingDoc["semester"] = "MEHR"): OfferingDoc {
  return {
    year,
    semester,
    scrapedAt: new Date().toISOString(),
    offerings,
  };
}

function offering(overrides: Partial<OfferingDoc["offerings"][number]> & { index: string; courseCode: string; courseName: string; classCode: string }): OfferingDoc["offerings"][number] {
  return {
    theoreticalUnits: 2,
    practicalUnits: 0,
    classSchedule: null,
    examSchedule: null,
    location: null,
    professor: null,
    ...overrides,
  } as any;
}

describe("calculateOfferingChanges – port of Course.calculate_course_changes", () => {
  it("first snapshot (no previous) returns empty diff", () => {
    const cur = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01" })]);
    const diff = calculateOfferingChanges(cur, null);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.updated).toEqual([]);
    expect(diffSummary(diff)).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("same snapshot returns empty", () => {
    const cur = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", maxCapacity: 30 })]);
    const prev = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", maxCapacity: 30 })]);
    const diff = calculateOfferingChanges(cur, prev);
    expect(diffSummary(diff)).toEqual({ added: 0, removed: 0, changed: 0 });
  });

  it("detects added (index in new not old)", () => {
    const cur = makeDoc([
      offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01" }),
      offering({ index: "2", courseCode: "c2", courseName: "n2", classCode: "02" }),
    ]);
    const prev = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01" })]);
    const diff = calculateOfferingChanges(cur, prev);
    expect(diff.added.map((o) => o.index)).toEqual(["2"]);
    expect(diff.removed).toEqual([]);
    expect(diff.updated).toEqual([]);
  });

  it("detects removed (index in old not new)", () => {
    const cur = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01" })]);
    const prev = makeDoc([
      offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01" }),
      offering({ index: "2", courseCode: "c2", courseName: "n2", classCode: "02" }),
    ]);
    const diff = calculateOfferingChanges(cur, prev);
    expect(diff.removed.map((o) => o.index)).toEqual(["2"]);
  });

  it("detects updated – tracked fields only (capacity, schedule, professor, location)", () => {
    const prev = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", maxCapacity: 30, classSchedule: "شنبه 8", professor: { fa: "استاد الف" } })]);
    const cur = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", maxCapacity: 35, classSchedule: "شنبه 8", professor: { fa: "استاد ب" } })]);
    const diff = calculateOfferingChanges(cur, prev);
    expect(diff.updated).toHaveLength(1);
    expect(diff.updated[0].after.index).toBe("1");
    const fields = diff.updated[0].changes.map((c) => c.field);
    expect(fields).toContain("maxCapacity");
    expect(fields).toContain("professor");
    expect(fields).not.toContain("classSchedule");
  });

  it("ignores non-tracked fields (courseName, degree)", () => {
    const prev = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", degree: "کارشناسی", maxCapacity: 30 })]);
    const cur = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1-changed", classCode: "01", degree: "ارشد", maxCapacity: 30 })]);
    const diff = calculateOfferingChanges(cur, prev);
    expect(diff.updated).toEqual([]);
  });

  it("tracks all Persian labels", () => {
    const prev = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", minCapacity: 10, maxCapacity: 30, classSchedule: "a", examSchedule: "b", location: "c", professor: { fa: "p1" } })]);
    const cur = makeDoc([offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", minCapacity: 15, maxCapacity: 35, classSchedule: "aa", examSchedule: "bb", location: "cc", professor: { fa: "p2" } })]);
    const diff = calculateOfferingChanges(cur, prev);
    expect(diff.updated[0].changes).toHaveLength(6);
    const labels = diff.updated[0].changes.map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(["حداقل ظرفیت", "حداکثر ظرفیت", "زمان کلاس‌ها", "زمان امتحان", "استاد", "مکان"]));
  });

  it("diffSummary counts correctly", () => {
    const cur = makeDoc([
      offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", maxCapacity: 35 }),
      offering({ index: "2", courseCode: "c2", courseName: "n2", classCode: "02" }),
    ]);
    const prev = makeDoc([
      offering({ index: "1", courseCode: "c1", courseName: "n1", classCode: "01", maxCapacity: 30 }),
      offering({ index: "3", courseCode: "c3", courseName: "n3", classCode: "03" }),
    ]);
    const diff = calculateOfferingChanges(cur, prev);
    expect(diffSummary(diff)).toEqual({ added: 1, removed: 1, changed: 1 });
  });
});
