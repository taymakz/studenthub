export interface PagingInfo {
  /** Total records across all pages (from "ركورد X تا Y از Z"). */
  totalRecords: number | null;
  /** First record index on this page (1-based). */
  from: number | null;
  /** Last record index on this page. */
  to: number | null;
  hasNext: boolean;
  hasPrev: boolean;
  /** Current page number when the portal renders a counter (Golestan "صفحه X از Y"). */
  page?: number | null;
  /** Total page count from the counter, when rendered. */
  totalPages?: number | null;
}

export interface ScrapedOffering {
  index: string;
  courseCode: string;
  courseName: string;
  courseType: string | null;
  theoreticalUnits: number;
  practicalUnits: number;
  classCode: string;
  degree: string;
  presentationType: string | null;
  minCapacity: number | null;
  maxCapacity: number | null;
  currentEnrollment: number | null;
  /** Sessions per week: ["یکشنبه از 07:30 تا 09:30", "سه شنبه از 09:30 تا 11:30"]. */
  classSchedule: string[];
  /** Index-matched with classSchedule when lengths align; single element broadcasts. */
  location: Array<string | null>;
  examSchedule: string | null;
  professor: string | null;
}

export interface ScrapeResult {
  rows: ScrapedOffering[];
  /** How many of the known fields were matched to table headers. */
  matchedFields: number;
  totalFields: number;
  duplicateCount: number;
  paging: PagingInfo;
  pageTitle: string;
  pageUrl: string;
}

export type Semester = "MEHR" | "BAHMAN" | "SUMMER";

export const SEMESTER_LABELS: Record<Semester, string> = {
  MEHR: "مهر",
  BAHMAN: "بهمن",
  SUMMER: "تابستان",
};

// ── Background ⇄ popup messaging ────────────────────────────────────────────

export type ExtractionPhase = "rewind" | "collect" | "done";

export interface ExtractionProgress {
  phase: ExtractionPhase;
  /** Current page number (1-based, estimated when totals are known). */
  page: number;
  totalPages: number | null;
  collectedRows: number;
  addedRows: number;
  message: string;
}

export type ExtractionEvent =
  | { type: "EXTRACTION_STARTED"; tabId: number }
  | { type: "EXTRACTION_PROGRESS"; progress: ExtractionProgress }
  | {
      type: "EXTRACTION_DONE";
      totalRows: number;
      pages: number;
      duplicateCount: number;
    }
  | { type: "EXTRACTION_ERROR"; error: string }
  | { type: "EXTRACTION_STOPPED"; totalRows: number };

export type BackgroundRequest =
  | { type: "START_EXTRACTION"; tabId?: number; universityId?: string }
  | { type: "STOP_EXTRACTION" }
  | { type: "GET_EXTRACTION_STATE" };
