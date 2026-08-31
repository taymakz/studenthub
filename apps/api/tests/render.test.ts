import { describe, it, expect, vi } from "vitest";

vi.mock("../src/config.ts", () => ({
  config: {
    TELEGRAM_APP_URL: "https://t.me/testapp",
    TELEGRAM_BOT_TOKEN: "test",
    DATABASE_URL: "postgresql://test:test@localhost/test",
  },
}));

import {
  buildGreeting,
  renderAnnouncementMessage,
  renderCourseChangeMessage,
  termLabel,
} from "../src/lib/notifications/render.ts";
import type { OfferingDiff } from "../src/lib/notifications/diff.ts";
import type { Offering } from "@workspace/registry";

function makeOffering(overrides: Partial<Offering> & { index: string; courseCode: string; courseName: string; classCode: string }): Offering {
  return {
    theoreticalUnits: 2,
    practicalUnits: 0,
    classSchedule: null,
    examSchedule: null,
    location: null,
    professor: null,
    degree: "کارشناسی",
    ...overrides,
  } as any;
}

function chart(names: string[]) {
  return new Map(names.map((n) => [n, { name: n, code: "c", theoreticalUnits: 2, practicalUnits: 0 } as any]));
}

describe("renderCourseChangeMessage – per-user unique (port of notify_users_about_update)", () => {
  const diff: OfferingDiff = {
    added: [makeOffering({ index: "1", courseCode: "c1", courseName: "ریاضی 1", classCode: "01" })],
    removed: [makeOffering({ index: "2", courseCode: "c2", courseName: "فیزیک 1", classCode: "02" })],
    updated: [
      {
        after: makeOffering({ index: "3", courseCode: "c3", courseName: "برنامه نویسی", classCode: "03" }),
        changes: [{ field: "maxCapacity", label: "حداکثر ظرفیت", before: "30", after: "35" }],
      },
    ],
  };

  it("unique per user – chart filtering (like old chart_data + moaref filtering)", () => {
    const alice = renderCourseChangeMessage(
      { chatId: 1, firstName: "علی", chartCourses: chart(["ریاضی 1", "برنامه نویسی"]), passedNames: new Set(), notedIndexes: new Set() },
      diff,
      termLabel(1405, "MEHR"),
    );
    const bob = renderCourseChangeMessage(
      { chatId: 2, firstName: "سارا", chartCourses: chart(["فیزیک 1"]), passedNames: new Set(), notedIndexes: new Set() },
      diff,
      termLabel(1405, "MEHR"),
    );
    // General summary is counts only – like old code: 🆕/🔄/❌ with Persian digits
    // Alice relevant: ریاضی 1 (added) + برنامه نویسی (updated) => 1 new + 1 updated
    // Bob relevant: فیزیک 1 (removed) => 1 removed
    expect(alice).toContain("درس جدید: ۱ مورد");
    expect(alice).toContain("تغییرات جزئی: ۱ مورد");
    expect(alice).not.toContain("حذف:");
    expect(bob).toContain("حذف: ۱ مورد");
    expect(bob).not.toContain("درس جدید");
    expect(alice).not.toEqual(bob);
  });

  it("excludes passed courses (like old PassedCourse filter)", () => {
    const msg = renderCourseChangeMessage(
      { chatId: 1, firstName: "علی", chartCourses: chart(["ریاضی 1"]), passedNames: new Set(["ریاضی 1"]), notedIndexes: new Set() },
      diff,
      termLabel(1405, "MEHR"),
    );
    // RelevantNew is filtered by passed, so no “درس جدید” line for ریاضی 1
    expect(msg).not.toContain("ریاضی 1");
    expect(msg).not.toContain("درس جدید");
  });

  it("noted courses get detailed section (index-based, like NotedCourse)", () => {
    const msg = renderCourseChangeMessage(
      { chatId: 1, firstName: "علی", chartCourses: chart(["برنامه نویسی"]), passedNames: new Set(), notedIndexes: new Set(["3", "2"]) },
      diff,
      termLabel(1405, "MEHR"),
    );
    expect(msg).toContain("در درس‌های انتخابی شما");
    expect(msg).toContain("برنامه نویسی");
    expect(msg).toContain("حداکثر ظرفیت");
    expect(msg).toContain("قبلی: 30");
    expect(msg).toContain("جدید: 35");
    expect(msg).toContain("فیزیک 1"); // noted deleted
  });

  it("counts are Persian digits, like old telegram messages", () => {
    const msg = renderCourseChangeMessage(
      { chatId: 1, firstName: "علی", chartCourses: chart(["ریاضی 1"]), passedNames: new Set(), notedIndexes: new Set() },
      { added: [makeOffering({ index: "1", courseCode: "c1", courseName: "ریاضی 1", classCode: "01" })], removed: [], updated: [] },
      termLabel(1405, "MEHR"),
    );
    expect(msg).toContain("۱ مورد");
  });

  it("truncates to 4096 bytes (Telegram limit, like old code – noted detailed section makes it huge)", () => {
    // Make huge noted updated section – that's what old code truncated (detailed noted courses)
    const hugeUpdated: OfferingDiff["updated"] = Array.from({ length: 200 }, (_, i) => ({
      after: makeOffering({ index: String(i), courseCode: `c${i}`, courseName: `درس خیلی طولانی ${i} `.repeat(20), classCode: "01" }),
      changes: [
        { field: "maxCapacity", label: "حداکثر ظرفیت", before: "30", after: "35" },
        { field: "professor", label: "استاد", before: "استاد الف خیلی طولانی نام ".repeat(10), after: "استاد ب خیلی طولانی نام ".repeat(10) },
      ],
    }));
    const hugeDiff: OfferingDiff = { added: [], removed: [], updated: hugeUpdated };
    const noted = new Set(hugeUpdated.map((u) => u.after.index));
    const chart = new Map(hugeUpdated.map((u) => [u.after.courseName, { name: u.after.courseName } as any]));
    const msg = renderCourseChangeMessage(
      { chatId: 1, firstName: "علی", chartCourses: chart, passedNames: new Set(), notedIndexes: noted },
      hugeDiff,
      termLabel(1405, "MEHR"),
    );
    expect(Buffer.byteLength(msg, "utf-8")).toBeLessThanOrEqual(4096);
    expect(msg.endsWith("…")).toBe(true);
  });

  it("termLabel Persian", () => {
    expect(termLabel(1405, "MEHR")).toContain("مهر");
    expect(termLabel(1405, "BAHMAN")).toContain("بهمن");
  });

  it("greeting uses firstName", () => {
    const msg = renderCourseChangeMessage(
      { chatId: 1, firstName: "رضا", chartCourses: chart([]), passedNames: new Set(), notedIndexes: new Set() },
      { added: [], removed: [], updated: [] },
      termLabel(1405, "MEHR"),
    );
    expect(msg).toContain("رضا");
  });
});

describe("renderAnnouncementMessage – consolidated greeting helper", () => {
  it("includeGreeting:false returns body without greeting", () => {
    const msg = renderAnnouncementMessage("علی", null, "متن تست", {
      includeGreeting: false,
    })
    expect(msg).toBe("متن تست")
    expect(msg).not.toContain("سلام")
  })

  it("includeGreeting:true with custom template درود {name} uses name", () => {
    const msg = renderAnnouncementMessage("TaymaZ", null, "سلام دنیا", {
      includeGreeting: true,
      greetingTemplate: "درود {name}",
    })
    expect(msg).toContain("درود TaymaZ")
    expect(msg).toContain("سلام دنیا")
  })

  it("fallback to دانشجوی عزیز when names null", () => {
    const msg = renderAnnouncementMessage(null, null, "body", {
      includeGreeting: true,
      greetingTemplate: "سلام {name} عزیز",
    })
    expect(msg).toContain("دانشجوی عزیز")
  })

  it("buildGreeting helper replaces {name} with display name", () => {
    expect(buildGreeting("Ali", "Reza", "سلام {name}")).toBe("سلام Ali Reza")
    expect(buildGreeting(null, null, "درود {name}")).toBe("درود دانشجوی عزیز")
  })

  it("truncate still applies to announcement", () => {
    const huge = "a".repeat(5000)
    const msg = renderAnnouncementMessage(null, null, huge, {
      includeGreeting: false,
    })
    expect(Buffer.byteLength(msg, "utf-8")).toBeLessThanOrEqual(4096)
  })
});
