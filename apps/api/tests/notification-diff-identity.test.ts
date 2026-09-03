import { describe, it, expect } from "vitest";

import {
  contentDiffUuid,
  DIFF_ID_NAMESPACE,
  diffFileMatchesLive,
  snapshotContentHash,
  uuidv5,
} from "../src/lib/notifications/diff-identity.ts";

function offering(index: string, extra: Record<string, unknown> = {}) {
  return {
    index,
    courseCode: "c1",
    courseName: `Course ${index}`,
    classCode: "01",
    theoreticalUnits: 2,
    practicalUnits: 0,
    classSchedule: null,
    examSchedule: null,
    professor: null,
    location: null,
    ...extra,
  };
}

describe("uuidv5", () => {
  it("matches the RFC 4122 test vector (dns + www.example.com)", () => {
    expect(uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2"
    );
  });

  it("is deterministic and versioned", () => {
    const a = uuidv5("hello", DIFF_ID_NAMESPACE);
    expect(uuidv5("hello", DIFF_ID_NAMESPACE)).toBe(a);
    expect(a[14]).toBe("5");
    expect(uuidv5("other", DIFF_ID_NAMESPACE)).not.toBe(a);
  });
});

describe("snapshotContentHash", () => {
  it("is order-insensitive but content-sensitive", () => {
    const doc = { offerings: [offering("2"), offering("1")] };
    const reordered = { offerings: [offering("1"), offering("2")] };
    const changed = {
      offerings: [offering("1"), offering("2", { professor: "X" })],
    };
    expect(snapshotContentHash(doc)).toBe(snapshotContentHash(reordered));
    expect(snapshotContentHash(doc)).not.toBe(snapshotContentHash(changed));
    expect(snapshotContentHash(null)).toBe(snapshotContentHash({ offerings: [] }));
  });

  it("ignores volatile fields (enrollment churn must not re-notify)", () => {
    const a = { offerings: [offering("1", { currentEnrollment: 10 })] };
    const b = { offerings: [offering("1", { currentEnrollment: 99 })] };
    expect(snapshotContentHash(a)).toBe(snapshotContentHash(b));
  });
});

describe("contentDiffUuid", () => {
  it("identifies the (baseline, current) pair deterministically", () => {
    const base = { offerings: [offering("1")] };
    const cur = { offerings: [offering("1"), offering("2")] };
    expect(contentDiffUuid(base, cur)).toBe(contentDiffUuid(base, cur));
    expect(contentDiffUuid(base, cur)).not.toBe(
      contentDiffUuid(cur, { offerings: [offering("1"), offering("2"), offering("3")] })
    );
  });
});

describe("diffFileMatchesLive", () => {
  const live = {
    added: [{ index: "5" }],
    removed: [{ index: "3" }],
    updated: [
      {
        after: { index: "7" },
        changes: [{ field: "professor", before: "A", after: "B" }],
      },
    ],
  };
  it("matches an identical file doc regardless of order", () => {
    expect(
      diffFileMatchesLive(live, {
        added: [{ index: "5" }],
        removed: [{ index: "3" }],
        updated: [
          {
            after: { index: "7" },
            changes: [{ field: "professor", before: "A", after: "B" }],
          },
        ],
        summary: { added: 1, removed: 1, changed: 1 },
      })
    ).toBe(true);
  });

  it("rejects stale files (deleted batch must not lend its uuid)", () => {
    // File still describes the old content while live moved on.
    expect(
      diffFileMatchesLive(
        { ...live, added: [{ index: "5" }, { index: "9" }] },
        {
          added: [{ index: "5" }],
          removed: [{ index: "3" }],
          updated: [],
          summary: { added: 1, removed: 1, changed: 0 },
        }
      )
    ).toBe(false);
    expect(diffFileMatchesLive(live, null)).toBe(false);
    expect(
      diffFileMatchesLive(live, {
        added: [{ index: "5" }],
        removed: [{ index: "3" }],
        updated: [],
        summary: { added: 99, removed: 1, changed: 0 },
      })
    ).toBe(false);
  });
});
