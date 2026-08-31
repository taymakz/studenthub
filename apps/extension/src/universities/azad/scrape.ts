import type { PagingInfo, ScrapeResult } from "../../lib/types";

/**
 * Injected via chrome.scripting.executeScript - MUST be fully self-contained.
 * Chrome serializes these functions' sources (func.toString()), so they can
 * not reference ANY module-scope binding: after minification the reference
 * becomes a renamed identifier that does not exist in the page context
 * (symptom: "ReferenceError: a is not defined" at injection time). Every
 * helper lives inside the function body.
 *
 * Improvements over the legacy content script:
 *   - fuzzy Persian header matching (aliases + normalization + containment)
 *   - Persian/Arabic-Indic digit conversion everywhere
 *   - duplicate detection without silently appending duplicates
 *   - rows already keyed by canonical field names
 *   - pagination awareness (ركورد X تا Y از Z + nextPage button state)
 */

/** Read the amoozeshyar paging bar. Digits are normalized, so the Arabic-vs-
 *  Persian ك/ک spelling of "ركورد" never matters. */
export function getPagingInfo(): PagingInfo {
  function toEnglishDigits(text: string): string {
    return text.replace(/[۰-۹٠-٩]/g, (ch) => {
      const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch);
      if (persian !== -1) return String(persian);
      return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
    });
  }

  const pagingText = toEnglishDigits(
    document.querySelector(".paging")?.textContent ?? "",
  ).replace(/\s+/g, " ");

  const match = /(\d+)\s*تا\s*(\d+)\s*از\s*(\d+)/.exec(pagingText);
  const totalFromSpan = Number(
    document.querySelector("#totalSearchCount")?.textContent?.trim() ?? "",
  );

  const nextBtn = document.querySelector<HTMLButtonElement>(
    "span#nextPage button",
  );
  const prevBtn = document.querySelector<HTMLButtonElement>(
    "span#prePage button",
  );

  return {
    totalRecords: match
      ? Number(match[3])
      : Number.isFinite(totalFromSpan) && totalFromSpan > 0
        ? totalFromSpan
        : null,
    from: match ? Number(match[1]) : null,
    to: match ? Number(match[2]) : null,
    hasNext: nextBtn !== null && !nextBtn.disabled,
    hasPrev: prevBtn !== null && !prevBtn.disabled,
  };
}

export function scrapeOfferingsFromPage(): ScrapeResult {
  function toEnglishDigits(text: string): string {
    return text.replace(/[۰-۹٠-٩]/g, (ch) => {
      const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch);
      if (persian !== -1) return String(persian);
      return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
    });
  }

  /**
   * Unify Arabic/Persian homoglyphs. The target site writes headers with
   * Arabic ك/ي (كدرس، نظري، حداكر ظرفيت) while aliases and the registry use
   * Persian ک/ی - without this, every match silently fails.
   */
  function unifyPersian(text: string): string {
    return text
      .replace(/\u0643/g, "\u06A9") // ك -> ک
      .replace(/\u064A/g, "\u06CC") // ي -> ی
      .replace(/\u0649/g, "\u06CC"); // ى -> ی
  }

  function cleanText(text: string): string {
    return unifyPersian(
      toEnglishDigits(text.replace(/\s+/g, " ")).replace(/\u00a0/g, " "),
    ).trim();
  }

  /** Header normalization: drop ZWNJ, punctuation, collapse spaces. */
  function normalizeHeader(text: string): string {
    return cleanText(text)
      .replace(/[\u200c\u200f\u200e]/g, "")
      .replace(/[«»()\-_/]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Canonical field -> header aliases (normalized containment matching).
  const FIELD_ALIASES: Array<[string, string[]]> = [
    ["courseCode", ["کد درس"]],
    ["courseName", ["نام درس", "عنوان درس"]],
    ["courseType", ["نوع درس"]],
    ["theoreticalUnits", ["تعداد واحد نظری", "واحد نظری"]],
    ["practicalUnits", ["تعداد واحد عملی", "واحد عملی"]],
    [
      "classCode",
      ["کد ارائه کلاس درس", "کد ارائه", "کد کلاس", "گروه درس", "شماره کلاس"],
    ],
    ["degree", ["مقطع", "درجه"]],
    ["presentationType", ["نوع ارائه"]],
    ["minCapacity", ["حداقل ظرفیت"]],
    ["maxCapacity", ["حداکثر ظرفیت"]],
    ["currentEnrollment", ["ثبت نام", "ثبت نام شده", "ظرفیت پر"]],
    [
      "classSchedule",
      ["زمانبندی تشکیل کلاس", "زمان تشکیل کلاس", "ساعات کلاس"],
    ],
    ["examSchedule", ["زمان امتحان"]],
    ["professor", ["استاد", "نام استاد"]],
    ["location", ["مکان برگزاری", "مکان", "محل تشکیل", "محل کلاس"]],
  ];
  const totalFields = FIELD_ALIASES.length;

  const headers = Array.from(document.querySelectorAll("tr th")).map((th) =>
    cleanText(th.textContent ?? ""),
  );

  // Greedy claim: each field takes the best unclaimed header.
  const headerByField = new Map<string, number>();
  const claimedHeaders = new Set<number>();

  for (const [field, aliases] of FIELD_ALIASES) {
    let bestIdx = -1;
    let bestScore = 0;

    headers.forEach((header, idx) => {
      if (claimedHeaders.has(idx) || !header) return;
      const norm = normalizeHeader(header);
      for (const alias of aliases) {
        if (norm === alias) {
          if (bestScore < 3) {
            bestScore = 3;
            bestIdx = idx;
          }
        } else if (norm.includes(alias) && bestScore < 2) {
          bestScore = 2;
          bestIdx = idx;
        } else if (alias.includes(norm) && norm.length >= 3 && bestScore < 1) {
          bestScore = 1;
          bestIdx = idx;
        }
      }
    });

    if (bestIdx !== -1) {
      headerByField.set(field, bestIdx);
      claimedHeaders.add(bestIdx);
    }
  }

  function cell(cells: NodeListOf<HTMLTableCellElement>, field: string): string {
    const idx = headerByField.get(field);
    return idx === undefined ? "" : cleanText(cells[idx]?.textContent ?? "");
  }

  const PERSIAN_DAYS = [
    "شنبه",
    "یکشنبه",
    "دوشنبه",
    "سه شنبه",
    "چهارشنبه",
    "پنج شنبه",
    "جمعه",
  ];

  function extractFirstSchedule(scheduleText: string): string {
    if (!scheduleText) return "";
    // ZWNJ-free, homoglyph-unified copy for matching only (سه‌شنبه -> سه شنبه,
    // يكشنبه -> یکشنبه).
    const cleaned = unifyPersian(scheduleText)
      .replace(/[\u200c]/g, " ")
      .replace(/\s+/g, " ");
    for (const day of PERSIAN_DAYS) {
      const pattern = new RegExp(
        `${day}\\s*(?:از)?\\s*\\d{1,2}:\\d{2}\\s*تا\\s*\\d{1,2}:\\d{2}`,
      );
      const match = cleaned.match(pattern);
      if (match) return match[0];
    }
    return cleaned;
  }

  function toInt(value: string): number | null {
    if (!value) return null;
    const normalized = value.replace(/[,،\s]/g, "");
    return /^\d+$/.test(normalized) ? Number(normalized) : null;
  }

  const rows: ScrapeResult["rows"] = [];
  const seenIndexes = new Set<string>();
  let duplicateCount = 0;

  const rowElements = document.querySelectorAll("tr.even, tr.odd");
  rowElements.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length === 0) return;

    const courseCode = cell(cells, "courseCode");
    const classCode = cell(cells, "classCode");
    // Extract only the numeric/dash parts — professor name and other text must not
    // leak into the identity field.
    const slugPart = (s: string) => s.replace(/[^0-9\-]/g, "").replace(/-+$/, "");
    const index = [slugPart(courseCode), slugPart(classCode)].filter(Boolean).join("-");

    if (seenIndexes.has(index)) {
      duplicateCount++;
      return;
    }
    seenIndexes.add(index);

    rows.push({
      index,
      courseCode,
      courseName: cell(cells, "courseName"),
      courseType: cell(cells, "courseType") || null,
      theoreticalUnits: toInt(cell(cells, "theoreticalUnits")) ?? 0,
      practicalUnits: toInt(cell(cells, "practicalUnits")) ?? 0,
      classCode,
      degree: cell(cells, "degree"),
      presentationType: cell(cells, "presentationType") || null,
      minCapacity: toInt(cell(cells, "minCapacity")),
      maxCapacity: toInt(cell(cells, "maxCapacity")),
      currentEnrollment: toInt(cell(cells, "currentEnrollment")),
      classSchedule: extractFirstSchedule(cell(cells, "classSchedule")) || null,
      examSchedule: cell(cells, "examSchedule") || null,
      professor: cell(cells, "professor") || null,
      location: cell(cells, "location") || null,
    });
  });

  // ── paging (same logic as getPagingInfo, kept inline: serialized fn) ────
  const pagingText = toEnglishDigits(
    document.querySelector(".paging")?.textContent ?? "",
  ).replace(/\s+/g, " ");
  const pageMatch = /(\d+)\s*تا\s*(\d+)\s*از\s*(\d+)/.exec(pagingText);
  const totalFromSpan = Number(
    document.querySelector("#totalSearchCount")?.textContent?.trim() ?? "",
  );
  const nextBtn = document.querySelector<HTMLButtonElement>(
    "span#nextPage button",
  );
  const prevBtn = document.querySelector<HTMLButtonElement>(
    "span#prePage button",
  );

  return {
    rows,
    matchedFields: headerByField.size,
    totalFields,
    duplicateCount,
    paging: {
      totalRecords: pageMatch
        ? Number(pageMatch[3])
        : Number.isFinite(totalFromSpan) && totalFromSpan > 0
          ? totalFromSpan
          : null,
      from: pageMatch ? Number(pageMatch[1]) : null,
      to: pageMatch ? Number(pageMatch[2]) : null,
      hasNext: nextBtn !== null && !nextBtn.disabled,
      hasPrev: prevBtn !== null && !prevBtn.disabled,
    },
    pageTitle: document.title,
    pageUrl: location.href,
  };
}
