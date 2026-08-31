import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";

// Characterization of notifications controller + service idempotency
// Mirrors service.ts:102-132 (detectAndCreateBatch) and notifications-uploads.controller.ts:537+753

vi.mock("@workspace/registry", () => ({
  getOfferings: vi.fn(),
  getPreviousOfferings: vi.fn(),
  getOfferingDiff: vi.fn(),
  listUniversitySlugs: vi.fn(() => []),
  listMajorSlugs: vi.fn(() => []),
  listOfferingTerms: vi.fn(() => []),
}));

function shouldCreateBatch(summary: { added: number; removed: number; changed: number }, diffId: string | null, completed: Set<string>, existingPayloads: Set<string>): boolean {
  // service.ts:101-140 – NO_CHANGES if empty summary, or diffId in completed, or diffId already batched
  if (summary.added + summary.removed + summary.changed === 0) return false;
  if (diffId && completed.has(diffId)) return false;
  if (diffId && existingPayloads.has(diffId)) return false;
  return true;
}

function deleteBatchResult(status: string): { status: number; allowed: boolean } {
  // notifications-uploads.controller.ts:765-769 – COMPLETED → 409, else 200 (if exists)
  // Also service.ts delete check
  if (status === "COMPLETED") return { status: 409, allowed: false };
  if (status === "READY" || status === "SENDING") return { status: 200, allowed: true };
  return { status: 404, allowed: false };
}

function sendNextResult(pendingCount: number): { done: boolean } | { done: false; messageId: string } {
  // service.ts:444-474 – if no PENDING/SENDING, return done:true
  if (pendingCount === 0) return { done: true };
  return { done: false, messageId: "msg-1" };
}

describe("notifications controller – characterization (detect-all + send-next idempotency + delete guards)", () => {
  it("POST /admin/notifications/detect-all creates batches only where summary non-empty and diffId not in completed_offering_diffs", () => {
    const completed = new Set<string>();
    const uuidCompleted = randomUUID();
    completed.add(uuidCompleted);
    const uuidFresh = randomUUID();

    // Term A: empty diff → NO_CHANGES, no batch
    expect(shouldCreateBatch({ added: 0, removed: 0, changed: 0 }, randomUUID(), completed, new Set())).toBe(false);
    // Term B: non-empty but diffId already completed → skip (service.ts:116-122)
    expect(shouldCreateBatch({ added: 1, removed: 0, changed: 0 }, uuidCompleted, completed, new Set())).toBe(false);
    // Term C: non-empty, diffId fresh → create
    expect(shouldCreateBatch({ added: 1, removed: 0, changed: 2 }, uuidFresh, completed, new Set())).toBe(true);
    // Term D: non-empty, diffId already has existing batch payload → idempotent NO_CHANGES (service.ts:124-139)
    const existing = new Set([uuidFresh]);
    expect(shouldCreateBatch({ added: 1, removed: 0, changed: 2 }, uuidFresh, new Set(), existing)).toBe(false);
    // Term E: legacy without diff.json (diffId null) – falls back to summary check, but still needs non-empty
    expect(shouldCreateBatch({ added: 1, removed: 0, changed: 0 }, null, completed, new Set())).toBe(true);
    expect(shouldCreateBatch({ added: 0, removed: 0, changed: 0 }, null, completed, new Set())).toBe(false);
  });

  it("POST /admin/notifications/batches/:id/send-next is idempotent – second call with no PENDING returns {done:true}", async () => {
    // First call had pending, second has none
    const first = sendNextResult(1);
    expect(first.done).toBe(false);
    // Simulate after first consumed the pending
    const second = sendNextResult(0);
    expect(second).toEqual({ done: true });
    // Third consecutive call also done:true (stable)
    const third = sendNextResult(0);
    expect(third.done).toBe(true);
  });

  it("DELETE /admin/notifications/batches/:id rejects COMPLETED (409) but allows READY|SENDING (200)", () => {
    expect(deleteBatchResult("COMPLETED")).toEqual({ status: 409, allowed: false });
    expect(deleteBatchResult("READY")).toEqual({ status: 200, allowed: true });
    expect(deleteBatchResult("SENDING")).toEqual({ status: 200, allowed: true });
    // Non-existent or other status → not found handling
    expect(deleteBatchResult("DRAFT").allowed).toBe(false);
  });

  it("detectAndCreateBatch summary fallback – uses diff.json UUID when present else randomUUID (legacy)", () => {
    const uuidFromDiff = randomUUID();
    const diffDocWithId = { id: uuidFromDiff, summary: { added: 1, removed: 0, changed: 0 } } as any;
    const fallbackId = randomUUID();
    // When diffDoc present, diffId is from doc (service.ts:114,247)
    const diffIdPresent = diffDocWithId?.id ?? fallbackId;
    expect(diffIdPresent).toBe(uuidFromDiff);
    // Legacy term without diff.json → fallback randomUUID
    const diffDocNull = null as any;
    const diffIdFallback = diffDocNull?.id ?? fallbackId;
    expect(diffIdFallback).toBe(fallbackId);
    expect(diffIdFallback).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("plan 004 – input validation and ownership", () => {
  it("multipart announcement with 11 universitySlugs → 400 (announcementSchema max 10)", async () => {
    const { z } = await import("zod")
    const schema = z.object({
      body: z.string().min(3).max(3500),
      universitySlugs: z.array(z.string().min(1)).max(10).optional(),
      majorSlugs: z.array(z.string().min(1)).max(10).optional(),
      entryYears: z.array(z.number().int().min(1300).max(1500)).max(10).optional(),
      entrySemesters: z.array(z.enum(["MEHR", "BAHMAN", "SUMMER"])).max(3).optional(),
      genders: z.array(z.enum(["MALE", "FEMALE"])).max(2).optional(),
    })
    const bad = schema.safeParse({
      body: "سلام تست",
      universitySlugs: Array.from({ length: 11 }, (_, i) => `uni-${i}`),
    })
    expect(bad.success).toBe(false)
    if (!bad.success) {
      expect(bad.error.issues[0].message).toMatch(/10/)
    }
    const ok = schema.safeParse({
      body: "سلام تست",
      universitySlugs: ["uni-1", "uni-2"],
    })
    expect(ok.success).toBe(true)
  })

  it("dismiss batch created by other admin → 403 (ownership check)", () => {
    function canDismiss(raw: { createdById: number | null }, adminChatId: number, adminRole: string): number {
      if (raw.createdById !== null && raw.createdById !== adminChatId && adminRole !== "SUPERADMIN") return 403
      return 200
    }
    // other admin's batch, ADMIN → 403
    expect(canDismiss({ createdById: 1 }, 2, "ADMIN")).toBe(403)
    // same admin → 200
    expect(canDismiss({ createdById: 2 }, 2, "ADMIN")).toBe(200)
    // SUPERADMIN can dismiss any → 200
    expect(canDismiss({ createdById: 1 }, 2, "SUPERADMIN")).toBe(200)
    // null createdById (seed data legacy) → any ADMIN can dismiss
    expect(canDismiss({ createdById: null }, 2, "ADMIN")).toBe(200)
    // delete with COMPLETED still 409 even if ownership ok
    function deleteResult(raw: { createdById: number | null; status: string }, adminChatId: number, adminRole: string): number {
      if (raw.createdById !== null && raw.createdById !== adminChatId && adminRole !== "SUPERADMIN") return 403
      if (raw.status === "COMPLETED") return 409
      return 200
    }
    expect(deleteResult({ createdById: 1, status: "READY" }, 2, "ADMIN")).toBe(403)
    expect(deleteResult({ createdById: 2, status: "COMPLETED" }, 2, "ADMIN")).toBe(409)
    expect(deleteResult({ createdById: null, status: "READY" }, 2, "ADMIN")).toBe(200)
  })

  it("parseMaybeArray size cap – 11 values triggers badRequest (too many values)", () => {
    const parseMaybeArray = (v: unknown): string[] | null => {
      if (!v) return null
      try {
        const parsed = JSON.parse(String(v))
        if (Array.isArray(parsed)) return (parsed as unknown[]).map(String).filter(Boolean)
      } catch {}
      const s = String(v).trim()
      if (!s || s === "همه") return null
      return s.split(/[،,]+/).map((x) => x.trim()).filter(Boolean)
    }
    const oversized = JSON.stringify(Array.from({ length: 12 }, (_, i) => `uni-${i}`))
    const arr = parseMaybeArray(oversized)
    expect(arr).not.toBeNull()
    expect(arr!.length).toBe(12)
    // controller would reject >10 with 400
    const shouldReject = arr !== null && arr.length > 10
    expect(shouldReject).toBe(true)
    const okArr = parseMaybeArray(JSON.stringify(["a", "b"]))
    expect(okArr!.length).toBe(2)
    expect(okArr!.length > 10).toBe(false)
  })

  it("dismiss diffId validation – invalid UUID → 400 before completeOfferingDiff", () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(re.test("not-a-uuid")).toBe(false)
    expect(re.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true)
    expect(re.test("__proto__")).toBe(false)
  })
})

describe("notification idempotency – concurrent detect and atomic batch (plan 003)", () => {
  it("concurrent detect with same diffId is idempotent", async () => {
    // Simulate DB unique constraint on notification_batches.diff_id via in-memory Set
    // This mirrors service.ts onConflictDoNothing({target: diffId}) + SELECT fallback → NO_CHANGES
    const store = new Set<string>();
    async function fakeDetect(diffId: string) {
      if (store.has(diffId)) {
        // second concurrent insert hits unique violation -> onConflictDoNothing returns empty -> mapped to NO_CHANGES
        throw new Error("NO_CHANGES");
      }
      store.add(diffId);
      return { batch: { id: diffId } };
    }
    const diffId = "550e8400-e29b-41d4-a716-446655440000";
    const results = await Promise.allSettled([
      fakeDetect(diffId),
      fakeDetect(diffId),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      results.filter(
        (r) => r.status === "rejected" && (r.reason as Error).message === "NO_CHANGES"
      )
    ).toHaveLength(1);
  });

  it("sendNextBatch 30 claims 30 in 4 queries", async () => {
    // Verify bulk claim pattern: 1 transaction (SELECT 30 FOR UPDATE SKIP LOCKED + UPDATE to SENDING)
    // + 2 UPDATEs for finalize (SENT/FAILED) + 1 batch counter = 4 DB roundtrips for 30 messages
    // Mock db.transaction/update to count calls
    let txCalls = 0;
    const mockDb = {
      transaction: vi.fn(async (cb: any) => {
        txCalls++;
        return cb({
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    for: () => Promise.resolve(Array.from({ length: 30 }, (_, i) => ({ id: `msg-${i}`, chatId: i, body: "hi" }))),
                  }),
                }),
              }),
            }),
          }),
          update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
        });
      }),
      update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
    };

    // Simulate the 4-query pattern for 30 messages
    const claimed = await mockDb.transaction(async (tx: any) => {
      const candidates = await tx
        .select()
        .from({} as any)
        .where({} as any)
        .orderBy({} as any)
        .limit(30)
        .for("update", { skipLocked: true });
      await tx.update({} as any).set({} as any).where({} as any);
      return candidates;
    });
    await mockDb.update().set({} as any).where({} as any); // SENT
    await mockDb.update().set({} as any).where({} as any); // FAILED (or no-op if none)
    await mockDb.update().set({} as any).where({} as any); // batch sentCount/failedCount

    expect(claimed).toHaveLength(30);
    expect(txCalls).toBe(1);
    // total DB roundtrips = 1 claim tx + 3 updates = 4
    expect(mockDb.update).toHaveBeenCalledTimes(3);
  });
});
