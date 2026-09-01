import { describe, it, expect } from "vitest";

// Replicate the fixed extractFirstSchedule logic from scrape.ts for testing
function unifyPersian(text: string): string {
  return text.replace(/\u0643/g, "\u06A9").replace(/\u064A/g, "\u06CC").replace(/\u0649/g, "\u06CC");
}
function extractFirstSchedule(scheduleText: string): string {
  if (!scheduleText) return "";
  let cleaned = unifyPersian(scheduleText)
    .replace(/[\u200c\u200d\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  cleaned = cleaned
    .replace(/سهشنبه/g, "سه شنبه")
    .replace(/پنجشنبه/g, "پنج شنبه")
    .replace(/یک\s+شنبه/g, "یکشنبه")
    .replace(/دو\s+شنبه/g, "دوشنبه")
    .replace(/چهار\s+شنبه/g, "چهارشنبه");
  const pattern =
    /(شنبه|یکشنبه|دوشنبه|سه شنبه|چهارشنبه|پنج شنبه|جمعه)\s+از\s+\d{1,2}:\d{2}\s+تا\s+\d{1,2}:\d{2}/g;
  const matches = [...cleaned.matchAll(pattern)];
  if (matches.length > 0) return matches[0][0]!;
  return cleaned;
}

function getDayName(schedule: string): string {
  const cleaned = unifyPersian(schedule)
    .replace(/[\u200c\u200d\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/سهشنبه/g, "سه شنبه")
    .replace(/پنجشنبه/g, "پنج شنبه")
    .replace(/یک\s+شنبه/g, "یکشنبه")
    .replace(/دو\s+شنبه/g, "دوشنبه")
    .replace(/چهار\s+شنبه/g, "چهارشنبه");
  const m = cleaned.match(/^(شنبه|یکشنبه|دوشنبه|سه شنبه|چهارشنبه|پنج شنبه|جمعه)/);
  return m?.[1] ?? "";
}

const canonicalDays = ["شنبه", "یکشنبه", "دوشنبه", "سه شنبه", "چهارشنبه", "پنج شنبه", "جمعه"] as const;

describe("extension: extractFirstSchedule - bug regression", () => {
  it("should NOT extract شنبه from دوشنبه (original bug)", () => {
    expect(extractFirstSchedule("دوشنبه  از 07:30 تا 10:05 ")).toBe("دوشنبه از 07:30 تا 10:05");
    expect(getDayName(extractFirstSchedule("دوشنبه  از 07:30 تا 10:05 "))).toBe("دوشنبه");
  });

  it("should correctly extract all canonical days", () => {
    const cases: Array<[string, string]> = [
      ["شنبه از 15:00 تا 16:45", "شنبه"],
      ["یکشنبه از 07:30 تا 10:05", "یکشنبه"],
      ["دوشنبه از 07:30 تا 10:05", "دوشنبه"],
      ["سه شنبه از 13:15 تا 15:00", "سه شنبه"],
      ["چهارشنبه از 09:15 تا 11:00", "چهارشنبه"],
      ["پنج شنبه از 16:45 تا 18:30", "پنج شنبه"],
      ["جمعه از 10:00 تا 12:00", "جمعه"],
    ];
    for (const [input, day] of cases) {
      expect(getDayName(extractFirstSchedule(input))).toBe(day);
    }
  });

  it("should handle all style variants for سه شنبه / پنج شنبه", () => {
    expect(getDayName(extractFirstSchedule("سه\u200cشنبه از 13:15 تا 15:00"))).toBe("سه شنبه");
    expect(getDayName(extractFirstSchedule("سهشنبه از 07:30 تا 10:05"))).toBe("سه شنبه");
    expect(getDayName(extractFirstSchedule("پنج\u200cشنبه از 10:10 تا 12:50"))).toBe("پنج شنبه");
    expect(getDayName(extractFirstSchedule("پنجشنبه از 07:30 تا 10:05"))).toBe("پنج شنبه");
  });

  it("should handle یکشنبه/دوشنبه/چهارشنبه variants with space and ZWNJ", () => {
    expect(getDayName(extractFirstSchedule("یک شنبه از 07:30 تا 10:05"))).toBe("یکشنبه");
    expect(getDayName(extractFirstSchedule("یک\u200cشنبه از 07:30 تا 10:05"))).toBe("یکشنبه");
    expect(getDayName(extractFirstSchedule("دو شنبه از 07:30 تا 10:05"))).toBe("دوشنبه");
    expect(getDayName(extractFirstSchedule("دو\u200cشنبه از 07:30 تا 10:05"))).toBe("دوشنبه");
    expect(getDayName(extractFirstSchedule("چهار شنبه از 07:30 تا 10:05"))).toBe("چهارشنبه");
    expect(getDayName(extractFirstSchedule("چهار\u200cشنبه از 07:30 تا 10:05"))).toBe("چهارشنبه");
    expect(getDayName(extractFirstSchedule("يكشنبه از 16:45 تا 18:30"))).toBe("یکشنبه"); // Arabic ya
  });

  it("should handle extra spaces and single-digit hour", () => {
    expect(extractFirstSchedule("دوشنبه  از   07:30   تا   10:05")).toBe("دوشنبه از 07:30 تا 10:05");
    expect(getDayName(extractFirstSchedule("شنبه از 7:30 تا 10:05"))).toBe("شنبه");
  });

  it("should return first schedule when multiple present", () => {
    const multi = "شنبه از 07:30 تا 10:05 دوشنبه از 13:00 تا 15:00";
    expect(extractFirstSchedule(multi)).toBe("شنبه از 07:30 تا 10:05");
  });

  it("should not confuse exam schedule with class schedule", () => {
    expect(extractFirstSchedule("1405/10/19 از 11:00 تا 13:00")).toBe("1405/10/19 از 11:00 تا 13:00");
  });

  it("should handle 100 random structures", () => {
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
      const canonical = canonicalDays[Math.floor(Math.random() * canonicalDays.length)]!;
      const variant = variants[canonical]![Math.floor(Math.random() * variants[canonical]!.length)]!;
      const h = String(Math.floor(Math.random() * 17) + 7).padStart(2, "0");
      const m = ["00", "05", "10", "15", "30", "45"][Math.floor(Math.random() * 6)]!;
      const h2 = String(Math.floor(Math.random() * 17) + 7).padStart(2, "0");
      const spaces = [" ", "  ", " \u200c ", "\u00a0"][Math.floor(Math.random() * 4)]!;
      const raw = `${variant}${spaces}از${spaces}${h}:${m}${spaces}تا${spaces}${h2}:${m}`;
      const extracted = extractFirstSchedule(raw);
      const day = getDayName(extracted);
      expect(day).toBe(canonical);
    }
  });
});
