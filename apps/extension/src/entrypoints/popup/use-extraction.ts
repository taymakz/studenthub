import { useEffect, useMemo, useState } from "react";

import {
  buildOfferingDoc,
  offeringFileName,
  serializeOfferingDoc,
  type OfferingDoc,
} from "../../lib/export-doc";
import { offeringsStorage } from "../../lib/storage";
import {
  type BackgroundRequest,
  type ExtractionEvent,
  type ExtractionProgress,
  type ScrapedOffering,
} from "../../lib/types";
import {
  detectUniversity,
  type UniversityAdapter,
} from "../../universities";
import { browser } from "#imports";

function friendlyMenuError(raw: string): string {
  if (/cannot access contents|cannot be scripted|chrome:\/\//i.test(raw)) {
    return "این صفحه قابل اسکریپت نیست - روی صفحه آموزشیار باشید";
  }
  if (/has not been invoked|activeTab/i.test(raw)) {
    return "دسترسی به صفحه داده نشد - پنجره افزونه را روی همان صفحه باز کنید";
  }
  return raw;
}

/**
 * All popup state and side effects in one hook - App stays a thin
 * composition of presentational components.
 */
export function useExtraction() {
  const [rows, setRows] = useState<ScrapedOffering[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [university, setUniversity] = useState<UniversityAdapter | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void offeringsStorage.getValue().then(setRows);

    // Auto-detect the university portal + the current Shamsi term.
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        const uni = detectUniversity(tab?.url ?? "");
        setUniversity(uni);
      })
      .catch(() => undefined);

    void browser.runtime
      .sendMessage<BackgroundRequest>({
        type: "GET_EXTRACTION_STATE",
      })
      .then((res) => {
        const state = (
          res as {
            state?: { running: boolean; progress: ExtractionProgress | null };
          }
        )?.state;
        if (state?.running) {
          setRunning(true);
          setProgress(state.progress);
        }
      })
      .catch(() => undefined);

    const listener = (event: ExtractionEvent) => {
      if (!event?.type?.startsWith("EXTRACTION_")) return;

      switch (event.type) {
        case "EXTRACTION_STARTED":
          setRunning(true);
          setProgress(null);
          setSummary(null);
          setError(null);
          break;
        case "EXTRACTION_PROGRESS":
          setProgress(event.progress);
          break;
        case "EXTRACTION_DONE":
          setRunning(false);
          setProgress(null);
          setSummary(
            `${event.pages} صفحه استخراج شد - ${event.totalRows} درس ذخیره شد`,
          );
          void offeringsStorage.getValue().then(setRows);
          break;
        case "EXTRACTION_STOPPED":
          setRunning(false);
          setProgress(null);
          setSummary(`متوقف شد - ${event.totalRows} درس ذخیره شده باقی ماند`);
          void offeringsStorage.getValue().then(setRows);
          break;
        case "EXTRACTION_ERROR":
          setRunning(false);
          setProgress(null);
          setError(event.error);
          break;
      }
    };

    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const doc: OfferingDoc = useMemo(() => buildOfferingDoc(rows), [rows]);

  const startExtraction = async () => {
    setError(null);
    setSummary(null);
    // The popup reliably knows the active tab - pass it through so the
    // background worker injects into the right one.
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    void browser.runtime.sendMessage<BackgroundRequest>({
      type: "START_EXTRACTION",
      tabId: tab?.id,
      universityId: university?.id,
    });
  };

  const copyJson = async () => {
    await navigator.clipboard.writeText(serializeOfferingDoc(doc));
    setToast("JSON کپی شد");
  };

  const downloadJson = () => {
    const blob = new Blob([serializeOfferingDoc(doc)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = offeringFileName();
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("فایل ذخیره شد");
  };

  const clearAll = async () => {
    await offeringsStorage.setValue([]);
    setRows([]);
    setSummary(null);
    setError(null);
  };

  /** Same action as the legacy "صفحه دروس نیست؟" button: injects the
   *  university's menu fix so the course-list page becomes reachable. */
  const openCourseMenu = async () => {
    if (!university?.replaceMenu) return;
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      setError("تب فعالی پیدا نشد");
      return;
    }
    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        func: university.replaceMenu,
      });
      setToast("منوی کلاس‌ها جایگزین شد");
    } catch (error) {
      setError(
        error instanceof Error
          ? friendlyMenuError(error.message)
          : "اجرای اسکریپت ممکن نیست",
      );
    }
  };

  return {
    rows,
    running,
    progress,
    summary,
    error,
    university,
    toast,
    startExtraction,
    copyJson,
    downloadJson,
    clearAll,
    openCourseMenu,
  };
}
