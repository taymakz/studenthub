import { describe, it, expect } from "vitest";

// Replicate the extractAllSessions logic from azad/scrape.ts for testing
function unifyPersian(text: string): string {
  return text.replace(/\u0643/g, "\u06A9").replace(/\u064A/g, "\u06CC").replace(/\u0649/g, "\u06CC");
}
function extractAllSessions(scheduleText: string): string[] {
  if (!scheduleText) return [];
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
  if (matches.length > 0) return matches.map((m) => m[0]!);
  return cleaned ? [cleaned] : [];
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

describe("extension: extractAllSessions - bug regression", () => {
  it("should NOT extract شنبه from دوشنبه (original bug)", () => {
    expect(extractAllSessions("دوشنبه  از 07:30 تا 10:05 ")).toEqual(["دوشنبه از 07:30 تا 10:05"]);
    expect(getDayName(extractAllSessions("دوشنبه  از 07:30 تا 10:05 ")[0]!)).toBe("دوشنبه");
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
      const sessions = extractAllSessions(input);
      expect(sessions).toHaveLength(1);
      expect(getDayName(sessions[0]!)).toBe(day);
    }
  });

  it("should handle all style variants for سه شنبه / پنج شنبه", () => {
    expect(getDayName(extractAllSessions("سه\u200cشنبه از 13:15 تا 15:00")[0]!)).toBe("سه شنبه");
    expect(getDayName(extractAllSessions("سهشنبه از 07:30 تا 10:05")[0]!)).toBe("سه شنبه");
    expect(getDayName(extractAllSessions("پنج\u200cشنبه از 10:10 تا 12:50")[0]!)).toBe("پنج شنبه");
    expect(getDayName(extractAllSessions("پنجشنبه از 07:30 تا 10:05")[0]!)).toBe("پنج شنبه");
  });

  it("should handle یکشنبه/دوشنبه/چهارشنبه variants with space and ZWNJ", () => {
    expect(getDayName(extractAllSessions("یک شنبه از 07:30 تا 10:05")[0]!)).toBe("یکشنبه");
    expect(getDayName(extractAllSessions("یک\u200cشنبه از 07:30 تا 10:05")[0]!)).toBe("یکشنبه");
    expect(getDayName(extractAllSessions("دو شنبه از 07:30 تا 10:05")[0]!)).toBe("دوشنبه");
    expect(getDayName(extractAllSessions("دو\u200cشنبه از 07:30 تا 10:05")[0]!)).toBe("دوشنبه");
    expect(getDayName(extractAllSessions("چهار شنبه از 07:30 تا 10:05")[0]!)).toBe("چهارشنبه");
    expect(getDayName(extractAllSessions("چهار\u200cشنبه از 07:30 تا 10:05")[0]!)).toBe("چهارشنبه");
    expect(getDayName(extractAllSessions("يكشنبه از 16:45 تا 18:30")[0]!)).toBe("یکشنبه"); // Arabic ya
  });

  it("should handle extra spaces and single-digit hour", () => {
    expect(extractAllSessions("دوشنبه  از   07:30   تا   10:05")).toEqual(["دوشنبه از 07:30 تا 10:05"]);
    expect(getDayName(extractAllSessions("شنبه از 7:30 تا 10:05")[0]!)).toBe("شنبه");
  });

  // THE fix for the reported issue: a course meeting twice a week must keep
  // ALL sessions, not just the first one.
  it("should keep ALL sessions when multiple present", () => {
    const multi = "شنبه از 07:30 تا 10:05 دوشنبه از 13:00 تا 15:00";
    expect(extractAllSessions(multi)).toEqual([
      "شنبه از 07:30 تا 10:05",
      "دوشنبه از 13:00 تا 15:00",
    ]);
  });

  it("should keep three+ sessions", () => {
    const multi = "درس(ت): یکشنبه از 07:30 تا 09:30 درس(ت): سه شنبه از 09:30 تا 11:30 درس(ع): سه شنبه از 15:00 تا 17:00";
    const sessions = extractAllSessions(multi);
    expect(sessions).toHaveLength(3);
    expect(getDayName(sessions[0]!)).toBe("یکشنبه");
    expect(getDayName(sessions[1]!)).toBe("سه شنبه");
    expect(getDayName(sessions[2]!)).toBe("سه شنبه");
  });

  it("should not confuse exam schedule with class schedule", () => {
    expect(extractAllSessions("1405/10/19 از 11:00 تا 13:00")).toEqual(["1405/10/19 از 11:00 تا 13:00"]);
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
      const extracted = extractAllSessions(raw);
      expect(extracted).toHaveLength(1);
      expect(getDayName(extracted[0]!)).toBe(canonical);
    }
  });
});
