/**
 * Golestan university Excel exporter — parser.
 *
 * Source: the `.xlsx` Golestan gives (one sheet, first row = headers):
 *   - A/B: دانشكده (code + name)      C/D: گروه آموزشي (code + name)
 *   - E: شماره و گروه درس (`1010102_01`)  F: نام درس
 *   - G: کل (TOTAL units)  H: ع (practical units) → theory = total - practical
 *   - I: ظرفيت (maxCapacity)  J: ثبت نام شده (currentEnrollment)
 *   - L: جنسيت (no registry field — carried as `_gender` for review)
 *   - M: نام استاد
 *   - N: زمان و مكان ارائه/ امتحان — the gold cell:
 *       `درس(ت|ع): <DAY> <HH:MM-HH:MM> [مکان: <loc>]` × N
 *       + optional `امتحان(<YYYY.MM.DD>) ساعت : <HH:MM-HH:MM>`
 *   - O: توضيحات (no registry field — carried as `_note` for review)
 *
 * Multi-session is the norm here (~1/3 of rows have 2+ sessions), so
 * `classSchedule` is an ARRAY of `DAY از START تا END` strings and
 * `location` is an index-matched array (`location[i]` belongs to
 * `classSchedule[i]`, null when that session has no مکان).
 */
import { createRequire } from "node:module";
import { canonicalDay, formatSession, squeeze, unifyPersian } from "../../fa.ts";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

// ── raw row ────────────────────────────────────────────────────────────────

export interface GolestanRawRow {
  facultyCode: string;
  facultyName: string;
  groupCode: string;
  groupName: string;
  courseRef: string;
  courseName: string;
  totalUnits: number | null;
  practicalUnits: number | null;
  maxCapacity: number | null;
  currentEnrollment: number | null;
  gender: string | null;
  professor: string | null;
  scheduleCell: string | null;
  note: string | null;
  rowNumber: number;
}

// ── parsed offering (intermediate, mirrors registry shape with arrays) ─────

export interface GolestanOffering {
  index: string;
  courseCode: string;
  courseName: string;
  courseType: string | null;
  theoreticalUnits: number;
  practicalUnits: number;
  classCode: string;
  degree: string;
  presentationType: null;
  minCapacity: null;
  maxCapacity: number | null;
  currentEnrollment: number | null;
  classSchedule: string[];
  examSchedule: string | null;
  professor: string | null;
  location: Array<string | null>;
  /** Reviewer-only extras (NOT registry fields). */
  _group: string;
  _faculty: string;
  _gender: string | null;
  _note: string | null;
}

// ── schedule cell ──────────────────────────────────────────────────────────

const DAY =
  "(شنبه|یک\\s*شنبه|دو\\s*شنبه|سه\\s*شنبه|چهار\\s*شنبه|پنج\\s*شنبه|جمعه)";

const SESSION_RE = new RegExp(
  `درس\\s*\\((ت|ع)\\)\\s*:\\s*${DAY}\\s+(\\d{1,2}:\\d{2})\\s*[-–—]\\s*(\\d{1,2}:\\d{2})`,
  "g"
);

const EXAM_RE =
  /امتحان\s*\((\d{4})[./](\d{1,2})[./](\d{1,2})\)\s*ساعت\s*:\s*(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/;

/** Stray single-char artifact sometimes printed before مکان: (`09:30 ز مکان:`). */
const STRAY_BEFORE_MAKAN = /^\S\s+(?=مکان:)/;

export interface ParsedSchedule {
  classSchedule: string[];
  location: Array<string | null>;
  examSchedule: string | null;
  kinds: Array<"ت" | "ع">;
  /** Sessions the regex could not parse (should stay 0 — surfaced in stats). */
  unparsedMarkers: number;
}

export function parseScheduleCell(cell: string | null): ParsedSchedule {
  const out: ParsedSchedule = {
    classSchedule: [],
    location: [],
    examSchedule: null,
    kinds: [],
    unparsedMarkers: 0,
  };
  if (!cell) return out;

  const text = unifyPersian(cell);

  const exam = text.match(EXAM_RE);
  if (exam) {
    const [, y, mo, d, s, e] = exam;
    out.examSchedule = `${y}/${mo!.padStart(2, "0")}/${d!.padStart(2, "0")} از ${s} تا ${e}`;
  }

  const matches = [...text.matchAll(SESSION_RE)];
  // Count درس( markers that did NOT parse (format drift alarm).
  const markers = (text.match(/درس\s*\((ت|ع)\)/g) ?? []).length;
  out.unparsedMarkers = markers - matches.length;

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const kind = m[1] as "ت" | "ع";
    const day = canonicalDay(m[2]!);
    out.kinds.push(kind);
    out.classSchedule.push(formatSession(day, m[3]!, m[4]!));

    // Location = text between end of this session and the next session /
    // exam marker / end of cell.
    const sliceStart = (m.index ?? 0) + m[0].length;
    const nextSession = matches[i + 1]?.index ?? text.length;
    const examIdx = exam?.index ?? text.length;
    const sliceEnd = Math.min(nextSession, examIdx, text.length);
    let loc = text.slice(sliceStart, sliceEnd).trim();
    loc = loc.replace(STRAY_BEFORE_MAKAN, "").trim();
    loc = loc.replace(/^مکان:\s*/, "").trim();
    out.location.push(loc ? loc : null);
  }
  return out;
}

// ── workbook reading ───────────────────────────────────────────────────────

/** Header match ignoring spaces/ZWNJ (source has `ظر فيت`, trailing spaces…). */
function normHeader(h: unknown): string {
  return squeeze(String(h ?? "")).replace(/[\s\u200c]/g, "");
}

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const s = String(v).replace(/[,،\s]/g, "");
  return /^\d+$/.test(s) ? Number(s) : null;
}

function toText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s ? s : null;
}

export interface GolestanDataset {
  rows: GolestanRawRow[];
  groups: Array<{ code: string; name: string; count: number }>;
}

export function parseGolestanExcel(excelPath: string): GolestanDataset {
  const wb = XLSX.readFile(excelPath);
  const sheetName = wb.SheetNames.includes("row") ? "row" : wb.SheetNames[0]!;
  const ws = wb.Sheets[sheetName]!;
  const grid = XLSX.utils.sheet_to_json<Array<unknown>>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (grid.length === 0) throw new Error(`Sheet "${sheetName}" is empty.`);

  const header = (grid[0] ?? []).map(normHeader);
  const col = (...needles: string[]): number => {
    const idx = header.findIndex((h) =>
      needles.some((n) => h.includes(normHeader(n)))
    );
    if (idx === -1)
      throw new Error(
        `Column not found (${needles.join("/")}).
Found headers: ${(grid[0] ?? []).join(" | ")}`
      );
    return idx;
  };

  // A/B share the same header text (دانشكده درس) — position disambiguates.
  const cFacultyCode = 0;
  const cFacultyName = 1;
  const cGroupCode = 2;
  const cGroupName = 3;
  const cRef = col("شماره و گروه درس");
  const cName = col("نام درس");
  const cTotal = col("کل");
  // `ع` is a single char — match exactly to avoid colliding with other headers.
  const cPrac = header.findIndex((h) => h === "ع");
  if (cPrac === -1) throw new Error("Column not found (ع).");
  const cCap = col("ظرفیت");
  const cEnrolled = col("ثبت نام شده");
  const cGender = col("جنسیت");
  const cProf = col("نام استاد");
  const cSched = col("زمان و مكان");
  const cNote = col("توضيحات");

  const rows: GolestanRawRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const line = grid[r] ?? [];
    const courseRef = toText(line[cRef]);
    const courseName = toText(line[cName]);
    if (!courseRef && !courseName) continue; // blank row
    rows.push({
      facultyCode: toText(line[cFacultyCode]) ?? "",
      facultyName: toText(line[cFacultyName]) ?? "",
      groupCode: toText(line[cGroupCode]) ?? "",
      groupName: toText(line[cGroupName]) ?? "",
      courseRef: courseRef ?? "",
      courseName: courseName ?? "",
      totalUnits: toInt(line[cTotal]),
      practicalUnits: toInt(line[cPrac]),
      maxCapacity: toInt(line[cCap]),
      currentEnrollment: toInt(line[cEnrolled]),
      gender: toText(line[cGender]),
      professor: toText(line[cProf]),
      scheduleCell: toText(line[cSched]),
      note: toText(line[cNote]),
      rowNumber: r + 1,
    });
  }

  const byGroup = new Map<string, { code: string; name: string; count: number }>();
  for (const row of rows) {
    const key = `${row.groupCode} ${row.groupName}`;
    const g = byGroup.get(key) ?? {
      code: row.groupCode,
      name: row.groupName,
      count: 0,
    };
    g.count++;
    byGroup.set(key, g);
  }
  return { rows, groups: [...byGroup.values()].sort((a, b) => b.count - a.count) };
}

// ── row → offering ─────────────────────────────────────────────────────────

export function toOffering(row: GolestanRawRow, degree: string): GolestanOffering {
  const parts = row.courseRef.split(/[_\-/]/).filter(Boolean);
  const courseCode = parts[0] ?? row.courseRef;
  const classCode = parts[1] ?? "";
  const index = classCode ? `${courseCode}-${classCode}` : courseCode;

  const prac = row.practicalUnits ?? 0;
  const total = row.totalUnits ?? prac;
  const theoretical = Math.max(0, total - prac);

  const sched = parseScheduleCell(row.scheduleCell);
  const onlyT = sched.kinds.length > 0 && sched.kinds.every((k) => k === "ت");
  const onlyA = sched.kinds.length > 0 && sched.kinds.every((k) => k === "ع");

  return {
    index,
    courseCode,
    courseName: row.courseName,
    courseType: sched.kinds.length === 0 ? null : onlyT ? "نظری" : onlyA ? "عملی" : "نظری-عملی",
    theoreticalUnits: theoretical,
    practicalUnits: prac,
    classCode,
    degree,
    presentationType: null,
    minCapacity: null,
    maxCapacity: row.maxCapacity,
    currentEnrollment: row.currentEnrollment,
    classSchedule: sched.classSchedule,
    examSchedule: sched.examSchedule,
    professor: row.professor,
    location: sched.location,
    _group: row.groupName,
    _faculty: row.facultyName,
    _gender: row.gender,
    _note: row.note,
  };
}
