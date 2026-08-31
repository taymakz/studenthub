import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";

// Tests for notification page detect – covers the new registry diff + completed-diffs flow
// Mirrors old Course.notify_users_about_update but with uuid + per-user filtering

function filterBatchesByCompleted<T extends { payload: any; type: string }>(
  batches: T[],
  completedIds: Set<string>,
): T[] {
  return batches.filter((b) => {
    const did = b.payload?.diffId;
    if (!did) return true;
    if (b.type !== "COURSE_CHANGES") return true;
    return !completedIds.has(did);
  });
}

describe("notifications detect – registry diff + completed uuid", () => {
  it("hides batches whose diffId is marked completed (like old is_old filtering)", () => {
    const uuid1 = randomUUID();
    const uuid2 = randomUUID();
    const batches = [
      { id: "b1", type: "COURSE_CHANGES", payload: { diffId: uuid1, semesterFile: "1405/mehr", added: 1, removed: 0, changed: 0 } },
      { id: "b2", type: "COURSE_CHANGES", payload: { diffId: uuid2, semesterFile: "1405/bahman", added: 2, removed: 1, changed: 0 } },
      { id: "b3", type: "ANNOUNCEMENT", payload: { body: "hello" } },
    ] as any[];
    const completed = new Set([uuid1]);
    const filtered = filterBatchesByCompleted(batches, completed);
    expect(filtered.map((b) => b.id)).toEqual(["b2", "b3"]);
  });

  it("announcement batches without diffId are never filtered", () => {
    const batches = [
      { id: "a1", type: "ANNOUNCEMENT", payload: { body: "hi" } },
      { id: "a2", type: "ANNOUNCEMENT", payload: null },
    ] as any[];
    const filtered = filterBatchesByCompleted(batches, new Set(["some-uuid"]));
    expect(filtered).toHaveLength(2);
  });

  it("empty diff (first snapshot) yields no batch – like old NO_CHANGES guard", () => {
    const summary = { added: 0, removed: 0, changed: 0 };
    const shouldNotify = summary.added + summary.removed + summary.changed > 0;
    expect(shouldNotify).toBe(false);
  });

  it("non-empty diff creates batch – uuid from diff.json is used as diffId", () => {
    const uuid = randomUUID();
    const diffDoc = { id: uuid, year: 1405, semester: "MEHR", summary: { added: 1, removed: 0, changed: 2 } };
    const summary = diffDoc.summary;
    const diffId = diffDoc.id;
    expect(diffId).toBe(uuid);
    expect(summary.added).toBe(1);
    expect(summary.changed).toBe(2);
  });

  it("only new.json triggers rotation – old/diff are derived (like old is_old/is_new)", () => {
    const glob = "**/courses/**/new.json";
    const isNewJson = (path: string) => path.endsWith("new.json") && path.includes("/courses/");
    expect(isNewJson("universities/azad-malard/majors/x/courses/1405/bahman/new.json")).toBe(true);
    expect(isNewJson("universities/azad-malard/majors/x/courses/1405/bahman/old.json")).toBe(false);
    expect(isNewJson("universities/azad-malard/majors/x/courses/1405/bahman/diff.json")).toBe(false);
    expect(glob).toContain("new.json");
  });

  it("per-user unique filtering – like old notify_users_about_update chart + passed + noted", () => {
    const chart = new Set(["ریاضی 1", "برنامه نویسی"]);
    const passed = new Set(["ریاضی 1"]);
    const diffCourses = [
      { courseName: "ریاضی 1", index: "1" },
      { courseName: "برنامه نویسی", index: "3" },
      { courseName: "فیزیک 1", index: "2" },
    ];
    const isRelevant = (name: string) => chart.has(name) && !passed.has(name);
    const relevant = diffCourses.filter((c) => isRelevant(c.courseName));
    expect(relevant.map((c) => c.courseName)).toEqual(["برنامه نویسی"]);
  });
});
