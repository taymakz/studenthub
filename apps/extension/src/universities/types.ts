import type { PagingInfo, ScrapeResult } from "../lib/types";

/**
 * One university portal = one folder under src/universities/<id>/.
 *
 * To add a university:
 *   1. create src/universities/<id>/ with an adapter object
 *   2. every injected function (scrape/readPaging/replaceMenu) must be FULLY
 *      self-contained - Chrome serializes fn.toString(), so no imports,
 *      no module-scope references (they break after minification)
 *   3. register it in src/universities/index.ts
 *
 * The popup picks the adapter by matching the active tab's URL (detect);
 * the background worker re-injects adapter functions after every pagination
 * page load.
 */
export interface UniversityAdapter {
  /** Stable id sent in messages (e.g. "azad"). */
  id: string;
  /** Persian display name shown in the popup. */
  name: string;
  /** Does this tab URL belong to this portal? Checked in order. */
  detect(url: string): boolean;

  /** Scrape the course table on the current page (injected). */
  scrape(): ScrapeResult;
  /** Read the pagination bar (injected). */
  readPaging(): PagingInfo;

  /** Selectors of the pagination buttons. */
  nextPageSelector: string;
  prevPageSelector: string;

  /** Injected menu fix for portals hiding the course-list page (optional). */
  replaceMenu?(): void;
}
