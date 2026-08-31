import { browser } from "#imports";

import { mergeRows } from "../lib/export-doc";
import { getUniversityAdapter } from "../universities";
import {
  extractStateStorage,
  extractStopStorage,
  offeringsStorage,
  type ExtractState,
} from "../lib/storage";
import type {
  ExtractionEvent,
  ExtractionProgress,
  PagingInfo,
} from "../lib/types";

/**
 * Drives multi-page extraction from the background worker.
 *
 * The target site does FULL page reloads for pagination (a form submit
 * re-renders everything, no URL change), so the injected function dies with
 * every page. Only the worker survives - it re-injects on each page:
 *
 *   rewind: click "صفحه قبل" until disabled  (user may start on page 3)
 *   collect: scrape -> auto-save -> click "صفحه بعد" -> wait -> ...
 *
 * Waiting is the tricky part: the tab's status stays "complete" for a moment
 * AFTER the click (the submit starts asynchronously), so waiting on tab
 * status alone resolves against the OLD page. Instead we fingerprint the
 * document with performance.timeOrigin - it changes when the new page's
 * document is created - and only then wait for its readyState.
 *
 * activeTab keeps the injection grant across same-origin navigations, which
 * paging always is.
 */

const LOAD_TIMEOUT_MS = 25_000;
const POLL_INTERVAL_MS = 350;
const SETTLE_DELAY_MS = 600;

class StopSignal extends Error {
  constructor() {
    super("stopped");
    this.name = "StopSignal";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function broadcast(event: ExtractionEvent) {
  try {
    await browser.runtime.sendMessage(event);
  } catch {
    // Popup closed - nothing to update.
  }
}

async function setState(state: ExtractState) {
  await extractStateStorage.setValue(state);
}

async function isStopped() {
  return extractStopStorage.getValue();
}

/** Friendly message for the two failure modes users actually hit. */
function friendlyInjectError(raw: string): string {
  if (/cannot access contents|cannot be scripted|chrome:\/\//i.test(raw)) {
    return "این صفحه قابل اسکریپت نیست - روی صفحه لیست دروس (آموزشیار) باشید";
  }
  if (/has not been invoked|activeTab/i.test(raw)) {
    return "دسترسی به صفحه داده نشد - پنجره افزونه را روی همان صفحه باز کنید و دوباره تلاش کنید";
  }
  return raw;
}

async function inject<T>(tabId: number, func: () => T): Promise<T> {
  let result: T | null | undefined;
  try {
    const [entry] = await browser.scripting.executeScript({
      target: { tabId },
      func,
    });
    result = entry?.result as T | null | undefined;
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    throw new Error(friendlyInjectError(raw));
  }

  // A thrown/serialized-away page-side function resolves with null here -
  // fail loudly instead of leaking null into callers (null.hasPrev etc).
  if (result === null || result === undefined) {
    throw new Error(
      "اسکریپت تزریق‌شده نتیجه‌ای برنگرداند - صفحه را دوباره باز کنید",
    );
  }
  return result;
}

/** Best-effort read - used for polling where a throw just means "not yet". */
async function tryInject<T>(tabId: number, func: () => T): Promise<T | null> {
  try {
    return await inject<T>(tabId, func);
  } catch {
    return null;
  }
}

interface DocState {
  epoch: number;
  readyState: string;
}

async function readDocState(tabId: number): Promise<DocState | null> {
  return tryInject<DocState>(tabId, () => ({
    epoch: performance.timeOrigin,
    readyState: document.readyState,
  }));
}

/**
 * Wait until the tab shows a NEW document (epoch differs from prevEpoch) and
 * that document finished loading. Falls back to the timeout on pathological
 * hosts so the loop always makes progress or fails loudly.
 */
async function waitForNewPage(
  tabId: number,
  prevEpoch: number,
): Promise<void> {
  const deadline = Date.now() + LOAD_TIMEOUT_MS;

  // Phase 1: a document with a different timeOrigin must appear.
  while (Date.now() < deadline) {
    if (await isStopped()) throw new StopSignal();
    const state = await readDocState(tabId);
    if (state && state.epoch !== prevEpoch) break;
    await sleep(POLL_INTERVAL_MS);
  }

  // Phase 2: that document must reach readyState complete.
  while (Date.now() < deadline) {
    const state = await readDocState(tabId);
    if (!state || state.readyState === "complete") break;
    await sleep(POLL_INTERVAL_MS);
  }

  // Let the table render.
  await sleep(SETTLE_DELAY_MS);
}

async function clickPaginator(
  tabId: number,
  selector: string,
): Promise<boolean> {
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId },
      func: (sel: string) => {
        const btn = document.querySelector<HTMLButtonElement>(sel);
        if (!btn || btn.disabled) return false;
        btn.click();
        return true;
      },
      args: [selector],
    });
    return (result?.result as boolean) ?? false;
  } catch {
    return true; // navigation started mid-injection - the click landed
  }
}

async function readPaging(
  tabId: number,
  readFn: () => PagingInfo,
): Promise<PagingInfo> {
  return (
    (await tryInject<PagingInfo>(tabId, readFn)) ?? {
      totalRecords: null,
      from: null,
      to: null,
      hasNext: false,
      hasPrev: false,
    }
  );
}

export async function runExtraction(
  tabId: number,
  universityId?: string,
): Promise<void> {
  const adapter = getUniversityAdapter(universityId ?? "generic");
  const current = await extractStateStorage.getValue();
  if (current?.running) {
    await broadcast({
      type: "EXTRACTION_ERROR",
      error: "استخراج در حال اجراست",
    });
    return;
  }

  await extractStopStorage.setValue(false);
  await setState({ running: true, progress: null });
  await broadcast({ type: "EXTRACTION_STARTED", tabId });

  let pages = 0;
  let totalDuplicateCount = 0;
  let lastProgress: ExtractionProgress | null = null;

  try {
    // ── Direction: last page collects backward, otherwise rewind+forward ──
    const initialPaging = await readPaging(tabId, adapter.readPaging);
    // Last page = the next button is disabled, or the record range ends at
    // the total ("ركورد 201 تا 222 از 222").
    const startOnLastPage =
      !initialPaging.hasNext ||
      (initialPaging.to !== null &&
        initialPaging.totalRecords !== null &&
        initialPaging.to >= initialPaging.totalRecords);
    const direction: "forward" | "backward" = startOnLastPage
      ? "backward"
      : "forward";

    if (direction === "forward") {
      // ── Rewind to page 1 ───────────────────────────────────────────────
      let paging = initialPaging;
      let guard = 0;

      while (paging?.hasPrev && guard < 50) {
        if (await isStopped()) throw new StopSignal();
        await broadcast({
          type: "EXTRACTION_PROGRESS",
          progress: {
            phase: "rewind",
            page: 0,
            totalPages: null,
            collectedRows: 0,
            addedRows: 0,
            message: "برگشت به صفحه اول…",
          },
        });

        const epoch = (await readDocState(tabId))?.epoch ?? 0;
        const clicked = await clickPaginator(tabId, "span#prePage button");
        if (!clicked) break;
        await waitForNewPage(tabId, epoch);
        paging = await readPaging(tabId, adapter.readPaging);
        guard++;
      }
    }

    // ── Collect page by page in the chosen direction ────────────────────
    // pageSize = largest observed page. A short LAST page (e.g. 201..222 of
    // 222) must not shrink it - otherwise page math derails (ceil(201/22)).
    let pageSize = 0;
    let anchorSeen = false; // saw a page starting at record 1

    while (true) {
      if (await isStopped()) throw new StopSignal();

      const result = await inject(tabId, adapter.scrape);
      if (result.rows.length === 0 && result.matchedFields === 0) {
        throw new Error("جدول دروس در این صفحه پیدا نشد");
      }

      if (result.paging.from === 1) anchorSeen = true;
      if (result.paging.to && result.paging.from) {
        pageSize = Math.max(
          pageSize,
          result.paging.to - result.paging.from + 1,
        );
      }
      pages++;
      totalDuplicateCount += result.duplicateCount;

      const stored = await offeringsStorage.getValue();
      const { merged, added } = mergeRows(stored, result.rows);
      await offeringsStorage.setValue(merged); // auto-save after every page

      const isLastPage =
        result.paging.totalRecords !== null &&
        result.paging.to !== null &&
        result.paging.to >= result.paging.totalRecords;

      const totalPages =
        result.paging.totalRecords && pageSize > 0
          ? Math.ceil(result.paging.totalRecords / pageSize)
          : null;
      const computedPage =
        result.paging.from !== null && pageSize > 0
          ? Math.ceil(result.paging.from / pageSize)
          : pages;

      // Numbers are only trustworthy once a full page anchored pageSize.
      // Backward runs start ON the short last page - show a plain label
      // there instead of "صفحه 10 از 11" nonsense.
      const showNumbers = !isLastPage || anchorSeen;
      lastProgress = {
        phase: "collect",
        page: showNumbers ? computedPage : 0,
        totalPages: showNumbers ? totalPages : null,
        collectedRows: merged.length,
        addedRows: added,
        message: showNumbers
          ? `استخراج صفحه ${computedPage} از ${totalPages ?? "?"}…`
          : "استخراج صفحه آخر…",
      };
      await setState({ running: true, progress: lastProgress });
      await broadcast({ type: "EXTRACTION_PROGRESS", progress: lastProgress });

      const hasMore =
        direction === "forward"
          ? result.paging.hasNext
          : result.paging.hasPrev;
      if (!hasMore) break; // reached the end in this direction
      if (await isStopped()) throw new StopSignal();

      // Fingerprint THIS document before clicking so the wait can prove the
      // new page actually arrived (tab status alone is stale after clicks).
      const epoch = (await readDocState(tabId))?.epoch ?? 0;
      const clicked = await clickPaginator(
        tabId,
        direction === "forward"
          ? "span#nextPage button"
          : "span#prePage button",
      );
      if (!clicked) break; // paginator vanished - treat as last page
      await waitForNewPage(tabId, epoch);
    }

    // Prune junk rows (empty index) left over from older buggy runs.
    const stored = await offeringsStorage.getValue();
    if (stored.some((row) => !row.index)) {
      await offeringsStorage.setValue(stored.filter((row) => row.index));
    }

    await setState({ running: false, progress: null });
    await broadcast({
      type: "EXTRACTION_DONE",
      totalRows: (await offeringsStorage.getValue()).length,
      pages,
      duplicateCount: totalDuplicateCount,
    });
  } catch (error) {
    if (error instanceof StopSignal) {
      const totalRows = (await offeringsStorage.getValue()).length;
      await setState({ running: false, progress: null });
      await broadcast({ type: "EXTRACTION_STOPPED", totalRows });
      return;
    }

    const message =
      error instanceof Error ? error.message : "خطای ناشناخته در استخراج";
    await setState({ running: false, progress: null });
    await broadcast({ type: "EXTRACTION_ERROR", error: message });
  }
}
