import type { PagingInfo } from "../../lib/types";
import type { UniversityAdapter } from "../types";
import { scrapeOfferingsFromPage } from "./scrape";
import { replaceMainMenu } from "./replace-menu";

/**
 * Islamic Azad University - the EServices (آموزشیار) student portal.
 * The same software is used by many Iranian universities, so the generic
 * fallback adapter reuses these functions.
 */
export const azad: UniversityAdapter = {
  id: "azad",
  name: "دانشگاه آزاد اسلامی",
  detect: (url) => /iau\.ir|eservices|amoozesh|sanjesh/i.test(url),

  scrape: scrapeOfferingsFromPage,
  readPaging: readAzadPaging,

  nextPageSelector: "span#nextPage button",
  prevPageSelector: "span#prePage button",

  replaceMenu: replaceMainMenu,
};

/** Self-contained injected paging reader (ركورد X تا Y از Z). */
export function readAzadPaging(): PagingInfo {
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
