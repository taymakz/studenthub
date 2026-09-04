import type { UniversityAdapter } from "./types";
import {
  azad,
  readAzadPaging,
} from "./azad";
import { golestan } from "./golestan";
import { scrapeOfferingsFromPage } from "./azad/scrape";

export type { UniversityAdapter } from "./types";

/**
 * Registry of supported university portals. Add new universities as a folder
 * under src/universities/<id>/ and list the adapter here - first match wins,
 * so put specific portals before the generic fallback.
 */
export const UNIVERSITIES: UniversityAdapter[] = [
  golestan,
  azad,
];

/** Structural fallback: the azad scraper is table-driven and works on any
 *  آموزشیار-style portal, so unknown hosts still extract fine. */
const generic: UniversityAdapter = {
  id: "generic",
  name: "سایت ناشناس (حالت عمومی)",
  detect: () => true,

  scrape: scrapeOfferingsFromPage,
  readPaging: readAzadPaging,

  nextPageSelector: "span#nextPage button",
  prevPageSelector: "span#prePage button",
};

/** Pick the adapter for a tab URL - always returns one (generic fallback). */
export function detectUniversity(url: string): UniversityAdapter {
  return UNIVERSITIES.find((u) => u.detect(url)) ?? generic;
}

export function getUniversityAdapter(id: string): UniversityAdapter {
  return UNIVERSITIES.find((u) => u.id === id) ?? generic;
}
