import { browser } from "#imports";

import { runExtraction } from "../lib/extractor";
import {
  extractStateStorage,
  extractStopStorage,
} from "../lib/storage";
import type { BackgroundRequest } from "../lib/types";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (message: BackgroundRequest, _sender, sendResponse) => {
      void handleMessage(message).then(sendResponse);
      return true; // async response
    },
  );
});

async function handleMessage(message: BackgroundRequest): Promise<unknown> {
  switch (message.type) {
    case "START_EXTRACTION": {
      // Prefer the tab id the popup saw (reliable); fall back to querying.
      let tabId = message.tabId;
      if (!tabId) {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        tabId = tab?.id;
      }
      if (!tabId) {
        return { ok: false, error: "تب فعالی پیدا نشد" };
      }
      // Fire and forget - progress flows through EXTRACTION_* events.
      void runExtraction(tabId, message.universityId);
      return { ok: true, tabId };
    }

    case "STOP_EXTRACTION": {
      await extractStopStorage.setValue(true);
      return { ok: true };
    }

    case "GET_EXTRACTION_STATE": {
      return { ok: true, state: await extractStateStorage.getValue() };
    }
  }
}
