import { storage } from "#imports";

import type { ExtractionProgress, ScrapedOffering } from "./types";

/** Scraped rows, auto-saved after every page. */
export const offeringsStorage = storage.defineItem<ScrapedOffering[]>(
  "local:offerings",
  { fallback: [] },
);

export interface ExtractState {
  running: boolean;
  progress: ExtractionProgress | null;
}

/** Survives service-worker restarts within the browser session. */
export const extractStateStorage = storage.defineItem<ExtractState | null>(
  "session:extractState",
  { fallback: null },
);

/**
 * Dedicated stop flag - the loop rewrites `running: true` after every page,
 * so a stop request must not live inside the same document.
 */
export const extractStopStorage = storage.defineItem<boolean>(
  "session:extractStop",
  { fallback: false },
);
