import { describe, it, expect } from "vitest";

// Replicate core Golestan parsing helpers from scrape.ts for unit testing.
// These run in Node.js (no DOM) so we test the pure data-parsing logic only.

function toEnglishDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (ch) => {
    const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch);
    if (persian !== -1) return String(persian);
    return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
  });
}

function unifyPersian(text: string): string {
  return text
    .replace(/\u0643/g, "\u06A9")
    .replace(/\u064A/g, "\u06CC")
    .replace(/\u0649/g, "\u06CC");
}

function cleanText(text: string): string {
  return unifyPersian(
    toEnglishDigits(
      text
        .replace(/[\u200c\u200d\u200e\u200f\u00a0\u2060\ufeff]/g, " ")
        .replace(/\s+/g, " "),
    ).replace(/\u00a0/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function toFloat(value: string): number | null {
  if (!value) return null;
  const normalized = value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g, "")
    .replace(/[,،\u066C\s]/g, "")
    .replace(/[\u066B\u00B7\u2044\u2215\uFF0F/]/g, ".");
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

function toInt(value: string): number | null {
  if (!value) return null;
  const normalized = value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g, "")
    .replace(/[,،\s]/g, "");
  return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

function parseCode(rawCode: string): { courseCode: string; classCode: string; index: string } | null {
  const codeMatch = rawCode.match(/(\d{4,10})[_\-\/\u2044\u2215\uFF0F](\d+)/);
  if (!codeMatch) return null;
  return {
    courseCode: codeMatch[1]!,
    classCode: codeMatch[2]!,
    index: `${codeMatch[1]}-${codeMatch[2]}`,
  };
}

function parseScheduleLocation(schedRaw: string): {
  classSchedule: string | null;
  location: string | null;
} {
  let classSchedule: string | null = null;
  let locationStr: string | null = null;

  if (schedRaw) {
    const locMatch = schedRaw.match(/مکان:\s*([^;,\n]+)/);
    if (locMatch) {
      locationStr = locMatch[1]!.trim();
    }

    const schedPart = schedRaw.split(/[;\n]/)[0]!.trim();

    const dayMatch = schedPart.match(
      /(شنبه|یکشنبه|دوشنبه|سه شنبه|چهارشنبه|پنج شنبه|جمعه)\s*(?:از\s*)?(\d{1,2}[:.]\d{2})\s*(?:تا|الی|[-_])\s*(\d{1,2}[:.]\d{2})/,
    );
    if (dayMatch) {
      classSchedule = `${dayMatch[1]} از ${dayMatch[2]!.replace(/[:.]/g, ":")} تا ${dayMatch[3]!.replace(/[:.]/g, ":")}`;
    } else if (schedPart) {
      classSchedule = schedPart;
    }
  }

  return { classSchedule, location: locationStr };
}

// ─── Simulated data rows from the user's Golestan HTML ─────────────────────
// Each array represents cells[0] through cells[10] (the fields we parse).

const DATA_ROWS = [
  {
    rawCells: [
      "۹۰۱۱۰۱۲_۰۱",        // 0: شماره و گروه درس
      "كارورزي كارشناسي۲(۰/۵واحدي)", // 1: نام درس
      "۰/۵",                   // 2: واحد (کل)
      "۰/۵",                   // 3: واحد (ع)
      "۹۹۹",                   // 4: ظرفیت
      "۰",                     // 5: ثبت نام شده
      "مختلط",                 // 7: جنس
      "اساتيد گروه آموزشي",   // 8: نام استاد
      "",                      // 9: زمان و مكان ارائه
      " ",                     // 10: زمان و مكان امتحان
    ],
    expected: {
      courseCode: "9011012",
      classCode: "01",
      index: "9011012-01",
      courseName: "کارورزی کارشناسی2(0/5واحدی)",
      theoreticalUnits: 0,
      practicalUnits: 0.5,
      maxCapacity: 999,
      currentEnrollment: 0,
    },
  },
  {
    rawCells: [
      "۹۰۱۱۰۱۶_۰۱",
      "كارورزي كارشناسي ۲(۳واحدي)",
      "۳",                     // کل = 3
      "۳",                     // ع = 3
      "۹۹۹",
      "۰",
      "مختلط",
      "اساتيد گروه آموزشي",
      "",
      " ",
    ],
    expected: {
      courseCode: "9011016",
      classCode: "01",
      index: "9011016-01",
      courseName: "كارورزي كارشناسي 2(3واحدي)",
      theoreticalUnits: 0,
      practicalUnits: 3,
      maxCapacity: 999,
      currentEnrollment: 0,
    },
  },
  {
    rawCells: [
      "۹۰۱۱۶۰۳_۰۱",
      "پايان نامه (۴ واحدي) كارشناسي ارشد",
      "۴",                     // کل = 4
      "۴",                     // ع = 4
      "۹۹۹",
      "۰",
      "مختلط",
      "اساتيد گروه آموزشي",
      "",
      " ",
    ],
    expected: {
      courseCode: "9011603",
      classCode: "01",
      index: "9011603-01",
      courseName: "پايان نامه (4 واحدي) كارشناسي ارشد",
      theoreticalUnits: 0,
      practicalUnits: 4,
      maxCapacity: 999,
      currentEnrollment: 0,
    },
  },
];

describe("extension: golestan parsing", () => {
  describe("code parsing and index generation", () => {
    it("should extract courseCode and classCode from Persian format", () => {
      for (const row of DATA_ROWS) {
        const rawCode = cleanText(row.rawCells[0]!);
        const parsed = parseCode(rawCode);
        expect(parsed).not.toBeNull();
        expect(parsed!.courseCode).toBe(row.expected.courseCode);
        expect(parsed!.classCode).toBe(row.expected.classCode);
        expect(parsed!.index).toBe(row.expected.index);
      }
    });

    it("should produce unique indexes", () => {
      const indexes = DATA_ROWS.map((r) => {
        const rawCode = cleanText(r.rawCells[0]!);
        return parseCode(rawCode)!.index;
      });
      const unique = new Set(indexes);
      expect(unique.size).toBe(indexes.length);
    });
  });

  describe("unit parsing: کل (total) and ع (practical)", () => {
    it("should compute theoreticalUnits = totalUnits - practicalUnits", () => {
      for (const row of DATA_ROWS) {
        const totalUnits = toFloat(cleanText(row.rawCells[2]!)) ?? 0;
        const practicalUnits = toFloat(cleanText(row.rawCells[3]!)) ?? 0;
        const theoreticalUnits = Math.max(0, totalUnits - practicalUnits);

        expect(theoreticalUnits).toBe(row.expected.theoreticalUnits);
        expect(practicalUnits).toBe(row.expected.practicalUnits);
      }
    });

    it("should handle zero units", () => {
      const totalUnits = toFloat(cleanText("۰")) ?? 0;
      const practicalUnits = toFloat(cleanText("۰")) ?? 0;
      expect(Math.max(0, totalUnits - practicalUnits)).toBe(0);
      expect(practicalUnits).toBe(0);
    });

    it("should handle mixed units: کل=2 ع=1 → theoretical=1 practical=1", () => {
      const totalUnits = toFloat(cleanText("۲")) ?? 0;
      const practicalUnits = toFloat(cleanText("۱")) ?? 0;
      expect(Math.max(0, totalUnits - practicalUnits)).toBe(1);
      expect(practicalUnits).toBe(1);
    });

    it("should handle 0.5 units (کل=0.5 ع=0.5 → theoretical=0)", () => {
      const totalUnits = toFloat(cleanText("۰/۵")) ?? 0;
      const practicalUnits = toFloat(cleanText("۰/۵")) ?? 0;
      expect(Math.max(0, totalUnits - practicalUnits)).toBe(0);
      expect(practicalUnits).toBe(0.5);
    });
  });

  describe("tolerant Persian/Arabic digit conversion", () => {
    it("should convert Persian digits", () => {
      expect(toEnglishDigits("۹۰۱۱۰۱۲")).toBe("9011012");
    });

    it("should convert Arabic-Indic digits", () => {
      expect(toEnglishDigits("٩٠١١٠١٢")).toBe("9011012");
    });

    it("should handle mixed Persian decimal", () => {
      expect(toFloat(cleanText("۰/۵"))).toBe(0.5);
      expect(toFloat(cleanText("۳"))).toBe(3);
      expect(toFloat(cleanText("۶"))).toBe(6);
    });
  });

  describe("schedule and location parsing", () => {
    it("should parse schedule without location", () => {
      const result = parseScheduleLocation("شنبه از 07:30 تا 10:05");
      expect(result.classSchedule).toBe("شنبه از 07:30 تا 10:05");
      expect(result.location).toBeNull();
    });

    it("should parse schedule with location after semicolon", () => {
      const result = parseScheduleLocation("شنبه از 07:30 تا 10:05; مکان: فنی مهندسی-2106");
      expect(result.classSchedule).toBe("شنبه از 07:30 تا 10:05");
      expect(result.location).toBe("فنی مهندسی-2106");
    });

    it("should parse empty schedule", () => {
      const result = parseScheduleLocation("");
      expect(result.classSchedule).toBeNull();
      expect(result.location).toBeNull();
    });

    it("should handle Persian dot as time separator", () => {
      const result = parseScheduleLocation("پنج شنبه از 09.15 تا 11.00");
      expect(result.classSchedule).toBe("پنج شنبه از 09:15 تا 11:00");
    });
  });

  describe("full row parsing simulation", () => {
    it("should parse first data row correctly", () => {
      const cells = DATA_ROWS[0]!.rawCells;
      const rawCode = cleanText(cells[0]!);
      const parsed = parseCode(rawCode)!;
      const totalUnits = toFloat(cleanText(cells[2]!)) ?? 0;
      const practicalUnits = toFloat(cleanText(cells[3]!)) ?? 0;
      const theoreticalUnits = Math.max(0, totalUnits - practicalUnits);

      expect(parsed.index).toBe("9011012-01");
      expect(parsed.courseCode).toBe("9011012");
      expect(parsed.classCode).toBe("01");
      expect(theoreticalUnits).toBe(0);
      expect(practicalUnits).toBe(0.5);
      expect(toInt(cleanText(cells[4]!))).toBe(999);
      expect(toInt(cleanText(cells[5]!))).toBe(0);
    });

    it("should parse third data row (ارشد) correctly", () => {
      const cells = DATA_ROWS[2]!.rawCells;
      const rawCode = cleanText(cells[0]!);
      const parsed = parseCode(rawCode)!;
      const totalUnits = toFloat(cleanText(cells[2]!)) ?? 0;
      const practicalUnits = toFloat(cleanText(cells[3]!)) ?? 0;
      const theoreticalUnits = Math.max(0, totalUnits - practicalUnits);

      expect(parsed.index).toBe("9011603-01");
      expect(cleanText(cells[1]!)).toBe("پایان نامه (4 واحدی) کارشناسی ارشد");
      expect(theoreticalUnits).toBe(0);
      expect(practicalUnits).toBe(4);
    });
  });

  describe("column mapping validation", () => {
    it("should NOT treat کل as theoreticalUnits (the original bug)", () => {
      // The original bug: cells[2] was used directly as theoreticalUnits
      // With the fix: theoreticalUnits = cells[2] - cells[3]
      // For ع=0.5, کل=0.5: old code would give theoretical=0.5 (wrong), new code gives theoretical=0 (correct)
      const totalUnits = toFloat(cleanText("۰/۵")) ?? 0;
      const practicalUnits = toFloat(cleanText("۰/۵")) ?? 0;

      // Old (wrong): theoreticalUnits = totalUnits → 0.5
      const oldWrong = totalUnits;
      // New (correct): theoreticalUnits = totalUnits - practicalUnits → 0
      const newCorrect = Math.max(0, totalUnits - practicalUnits);

      expect(oldWrong).toBe(0.5); // This was the bug
      expect(newCorrect).toBe(0); // This is the fix
    });
  });

  describe("fractional units: unicode slash + invisible char variants", () => {
    // Real Golestan pages emit the decimal slash as unicode variants or hide
    // zero-width chars between digits - clipboard paste normalizes them to
    // ASCII, which is why only the live site showed units collapsing to 0.
    it.each([
      ["ASCII slash", "۰/۵"],
      ["fraction slash U+2044", "۰\u2044۵"],
      ["division slash U+2215", "۰\u2215۵"],
      ["fullwidth solidus U+FF0F", "۰\uFF0F۵"],
      ["Arabic decimal mark U+066B", "۰\u066B۵"],
      ["zero-width space U+200B between digits", "۰\u200B/۵"],
      ["ZWNJ between digits", "۰\u200C/۵"],
      ["soft hyphen between digits", "۰\u00AD/۵"],
      ["bidi marks around value", "\u200F۰/۵\u200E"],
      ["word joiner between digits", "۰\u2060/۵"],
    ])("parses %s as 0.5", (_label, input) => {
      expect(toFloat(cleanText(input))).toBe(0.5);
    });

    it("integer units still parse", () => {
      expect(toFloat(cleanText("۳"))).toBe(3);
      expect(toFloat(cleanText("۱"))).toBe(1);
    });

    it("non-numeric text stays null", () => {
      expect(toFloat(cleanText("مختلط"))).toBeNull();
      expect(toFloat(cleanText(""))).toBeNull();
    });

    it("capacity with zero-width space still parses (toInt)", () => {
      expect(toInt(cleanText("۹۹۹\u200B"))).toBe(999);
      expect(toInt(cleanText("۹۹۹"))).toBe(999);
    });

    it("code cell with unicode slash separator still yields index", () => {
      const parsed = parseCode(cleanText("۹۰۱۱۰۱۲\u2044۰۱"));
      expect(parsed).not.toBeNull();
      expect(parsed!.index).toBe("9011012-01");
    });

    it("full 0.5-unit row: theoretical=0, practical=0.5", () => {
      const totalUnits = toFloat(cleanText("۰\u2044۵")) ?? 0;
      const practicalUnits = toFloat(cleanText("۰\u200B∕۵".replace("\u2215", "/"))) ?? 0;
      expect(Math.max(0, totalUnits - practicalUnits)).toBe(0);
      expect(practicalUnits).toBe(0.5);
    });
  });

  describe("dynamic unit column resolution from header grid", () => {
    interface FakeCell {
      text: string;
      colspan?: number;
      rowspan?: number;
    }

    // Replicates findUnitColumns() from scrape.ts over a simplified grid.
    function findUnitColumnsFromHeader(
      grid: FakeCell[][],
    ): { total: number; practical: number } {
      const occupied: boolean[][] = grid.map(() => []);
      let totalIdx = -1;
      let practicalIdx = -1;
      for (let r = 0; r < grid.length; r++) {
        let col = 0;
        for (const cell of grid[r]!) {
          while (occupied[r]![col]) col++;
          const colspan = cell.colspan ?? 1;
          const rowspan = cell.rowspan ?? 1;
          const text = cleanText(cell.text);
          if (text === "کل") totalIdx = col;
          else if (text === "ع") practicalIdx = col;
          for (let rr = r; rr < Math.min(r + rowspan, grid.length); rr++) {
            for (let cc = col; cc < col + colspan; cc++) occupied[rr]![cc] = true;
          }
          col += colspan;
        }
      }
      if (totalIdx !== -1 || practicalIdx !== -1) {
        return { total: totalIdx, practical: practicalIdx };
      }
      return { total: 2, practical: 3 };
    }

    const h3 = (text: string): FakeCell => ({ text, rowspan: 3 });

    // Canonical Golestan header (Table3Prim): 15 rowspan-3 columns, the two
    // unit placeholders at visual cols 2-3, then "واحد" colspan-2 and كل/ع.
    const canonicalRow0: FakeCell[] = [
      h3("شماره و گروه درس"),
      h3("نام درس"),
      { text: "" },
      { text: "" },
      h3("ظر فيت"),
      h3("ثبت نام شده"),
      h3("تعداد ليست انتظار"),
      h3("جنس"),
      h3("نام استاد"),
      h3("زمان و مكان ارائه"),
      h3("زمان و مكان امتحان"),
      h3("محدوديت اخذ"),
      h3("مخصوص ورودي"),
      h3("دروس اجبار/متضاد"),
      h3("نحوه ارائه درس"),
      h3("دوره درس"),
      h3("توضيحات"),
    ];
    const canonicalHeader = [
      canonicalRow0,
      [{ text: "واحد", colspan: 2 }],
      [{ text: "كل" }, { text: "ع" }], // Arabic ك, unified by cleanText
    ];

    it("resolves كل/ع to columns 2 and 3 in the canonical layout", () => {
      expect(findUnitColumnsFromHeader(canonicalHeader)).toEqual({
        total: 2,
        practical: 3,
      });
    });

    it("adapts when an extra column shifts units right", () => {
      const shifted = [
        [h3("extra"), ...canonicalRow0],
        [{ text: "واحد", colspan: 2 }],
        [{ text: "كل" }, { text: "ع" }],
      ];
      expect(findUnitColumnsFromHeader(shifted)).toEqual({
        total: 3,
        practical: 4,
      });
    });

    it("reports -1 when the ع column is absent (single unit column)", () => {
      const onlyTotal = [
        canonicalRow0,
        [{ text: "واحد", colspan: 2 }],
        [{ text: "كل" }],
      ];
      expect(findUnitColumnsFromHeader(onlyTotal)).toEqual({
        total: 2,
        practical: -1,
      });
    });

    it("falls back to 2/3 when no header markers exist", () => {
      expect(
        findUnitColumnsFromHeader([
          [{ text: "a" }, { text: "b" }, { text: "c" }],
        ]),
      ).toEqual({ total: 2, practical: 3 });
    });

    it("parses units through resolved columns with unicode slashes", () => {
      const cols = findUnitColumnsFromHeader(canonicalHeader);
      const dataCells = [
        "۹۰۱۱۰۱۲_۰۱",
        "كارورزي كارشناسي۲",
        "۰\u2044۵", // كل
        "۰\u2215۵", // ع
        "۹۹۹",
        "۰",
        "۰",
        "مختلط",
        "استاد",
        "",
        " ",
        "",
        "",
        "",
        "عادي",
        "روزانه",
        "",
      ];
      const totalUnits = toFloat(cleanText(dataCells[cols.total]!)) ?? 0;
      const practicalUnits = toFloat(cleanText(dataCells[cols.practical]!)) ?? 0;
      expect(totalUnits).toBe(0.5);
      expect(practicalUnits).toBe(0.5);
      expect(Math.max(0, totalUnits - practicalUnits)).toBe(0);
    });
  });

  describe("progress bar math (Golestan has no page counter)", () => {
    // Mirrors the extractor: while navigation keeps succeeding, estimate one
    // page ahead so percent = page / (page + 1) creeps toward 100%.
    const percent = (page: number, total: number) =>
      Math.round((page / total) * 100);

    it("creeps upward one page ahead of reality while more pages exist", () => {
      expect(percent(1, 2)).toBe(50);
      expect(percent(2, 3)).toBe(67);
      expect(percent(3, 4)).toBe(75);
      expect(percent(9, 10)).toBe(90);
    });

    it("the estimate keeps growing - bar never stalls on one value", () => {
      let prev = -1;
      for (let p = 1; p <= 15; p++) {
        // Raw fraction strictly increases every page (bar width is not rounded).
        const raw = (p / (p + 1)) * 100;
        expect(raw).toBeGreaterThan(prev);
        prev = raw;
        // Rounded percent displayed in the UI never goes backwards.
        if (p > 1) {
          expect(Math.round(raw)).toBeGreaterThanOrEqual(
            Math.round(((p - 1) / p) * 100),
          );
        }
      }
      expect(prev).toBeLessThan(100); // only DONE reaches the end
    });

    it("uses the real counter when a deployment renders one", () => {
      expect(percent(3, 15)).toBe(20);
      expect(percent(15, 15)).toBe(100);
    });

    it("final tick lands exactly on 100% before EXTRACTION_DONE", () => {
      // Extractor broadcasts page=totalPages=lastPage right before DONE.
      expect(percent(12, 12)).toBe(100);
    });
  });
});
