import { describe, it, expect } from "vitest";
import {
  getCourseScheduleDayName,
  extractClassScheduleStartTime,
  extractClassScheduleEndTime,
  extractExamScheduleDate,
  extractExamScheduleStartTime,
  extractExamScheduleEndTime,
  persianWeekDays,
} from "./schedule";

describe("schedule: getCourseScheduleDayName", () => {
  it("handles canonical days", () => {
    for (const day of persianWeekDays) {
      expect(getCourseScheduleDayName(`${day} از 08:00 تا 10:00`)).toBe(day);
    }
  });

  it("handles bug: دوشنبه not truncated to شنبه", () => {
    expect(getCourseScheduleDayName("دوشنبه از 07:30 تا 10:05")).toBe("دوشنبه");
    expect(getCourseScheduleDayName("شنبه از 07:30 تا 10:05")).toBe("شنبه");
  });

  it("handles all variants (ZWNJ, no-space, spaced)", () => {
    const cases: Array<[string, string]> = [
      ["سه\u200cشنبه از 13:15 تا 15:00", "سه شنبه"],
      ["سهشنبه از 07:30 تا 10:05", "سه شنبه"],
      ["پنج\u200cشنبه از 10:10 تا 12:50", "پنج شنبه"],
      ["پنجشنبه از 07:30 تا 10:05", "پنج شنبه"],
      ["یک شنبه از 07:30 تا 10:05", "یکشنبه"],
      ["یک\u200cشنبه از 07:30 تا 10:05", "یکشنبه"],
      ["دو شنبه از 07:30 تا 10:05", "دوشنبه"],
      ["دو\u200cشنبه از 07:30 تا 10:05", "دوشنبه"],
      ["چهار شنبه از 07:30 تا 10:05", "چهارشنبه"],
      ["چهار\u200cشنبه از 07:30 تا 10:05", "چهارشنبه"],
      ["يكشنبه از 16:45 تا 18:30", "یکشنبه"],
    ];
    for (const [input, expected] of cases) {
      expect(getCourseScheduleDayName(input)).toBe(expected);
    }
  });

  it("returns empty for invalid", () => {
    expect(getCourseScheduleDayName("")).toBe("");
    expect(getCourseScheduleDayName("نامشخص")).toBe("");
    expect(getCourseScheduleDayName("1405/10/19 از 11:00 تا 13:00")).toBe("");
  });

  it("handles random class_schedule structures (100)", () => {
    const variants: Record<string, string[]> = {
      شنبه: ["شنبه"],
      یکشنبه: ["یکشنبه", "یک شنبه", "یک\u200cشنبه", "يكشنبه"],
      دوشنبه: ["دوشنبه", "دو شنبه", "دو\u200cشنبه"],
      "سه شنبه": ["سه شنبه", "سه\u200cشنبه", "سهشنبه"],
      چهارشنبه: ["چهارشنبه", "چهار شنبه", "چهار\u200cشنبه"],
      "پنج شنبه": ["پنج شنبه", "پنج\u200cشنبه", "پنجشنبه"],
      جمعه: ["جمعه"],
    };
    for (let i = 0; i < 100; i++) {
      const canonical = persianWeekDays[Math.floor(Math.random() * persianWeekDays.length)]!;
      const variant = variants[canonical]![Math.floor(Math.random() * variants[canonical]!.length)]!;
      const h = String(Math.floor(Math.random() * 17) + 7).padStart(2, "0");
      const m = ["00", "05", "10", "15", "30", "45"][Math.floor(Math.random() * 6)]!;
      const h2 = String(Math.floor(Math.random() * 17) + 7).padStart(2, "0");
      const spaces = [" ", "  ", " \u200c ", "\u00a0"][Math.floor(Math.random() * 4)]!;
      const raw = `${variant}${spaces}از${spaces}${h}:${m}${spaces}تا${spaces}${h2}:${m}`;
      expect(getCourseScheduleDayName(raw)).toBe(canonical);
      expect(extractClassScheduleStartTime(raw)).toBe(`${h}:${m}`);
      expect(extractClassScheduleEndTime(raw)).toBe(`${h2}:${m}`);
    }
  });
});

describe("schedule: exam schedule", () => {
  it("parses exam dates and times", () => {
    expect(extractExamScheduleDate("1405/10/19 از 11:00 تا 13:00")).toEqual({ year: 1405, month: 9, day: 19 });
    expect(extractExamScheduleStartTime("1405/10/19 از 11:00 تا 13:00")).toBe("11:00");
    expect(extractExamScheduleEndTime("1405/10/19 از 11:00 تا 13:00")).toBe("13:00");
  });

  it("handles random exam structures (100)", () => {
    for (let i = 0; i < 100; i++) {
      const year = 1403 + Math.floor(Math.random() * 3);
      const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
      const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
      const dateStr = `${year}/${month}/${day}`;
      const h = String(Math.floor(Math.random() * 17) + 7).padStart(2, "0");
      const m = ["00", "15", "30"][Math.floor(Math.random() * 3)]!;
      const h2 = String(Math.floor(Math.random() * 17) + 7).padStart(2, "0");
      const spaces = [" ", "  ", " \u200c "][Math.floor(Math.random() * 3)]!;
      const raw = `${dateStr}${spaces}از${spaces}${h}:${m}${spaces}تا${spaces}${h2}:${m}`;
      const d = extractExamScheduleDate(raw);
      expect(d).toEqual({ year, month: Number(month) - 1, day: Number(day) });
      expect(extractExamScheduleStartTime(raw)).toBe(`${h}:${m}`);
      expect(extractExamScheduleEndTime(raw)).toBe(`${h2}:${m}`);
    }
  });

  it("handles ZWNJ in exam schedule", () => {
    expect(extractExamScheduleStartTime("1405/10/19\u200c از 11:00 تا 13:00")).toBe("11:00");
  });
});
