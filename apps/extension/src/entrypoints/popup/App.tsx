import { useEffect, useMemo, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/cn";
import {
  buildOfferingDoc,
  offeringFileName,
  serializeOfferingDoc,
} from "../../lib/export-doc";
import {
  buildYearOptions,
  currentJalali,
  detectTerm,
} from "../../lib/jalali";
import { offeringsStorage } from "../../lib/storage";
import {
  SEMESTER_LABELS,
  type BackgroundRequest,
  type ExtractionEvent,
  type ExtractionProgress,
  type Semester,
  type ScrapedOffering,
} from "../../lib/types";
import {
  detectUniversity,
  type UniversityAdapter,
} from "../../universities";
import { browser } from "#imports";

const SEMESTERS: Semester[] = ["MEHR", "BAHMAN", "SUMMER"];

function friendlyMenuError(raw: string): string {
  if (/cannot access contents|cannot be scripted|chrome:\/\//i.test(raw)) {
    return "این صفحه قابل اسکریپت نیست - روی صفحه آموزشیار باشید";
  }
  if (/has not been invoked|activeTab/i.test(raw)) {
    return "دسترسی به صفحه داده نشد - پنجره افزونه را روی همان صفحه باز کنید";
  }
  return raw;
}

export default function App() {
  const [rows, setRows] = useState<ScrapedOffering[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ExtractionProgress | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [university, setUniversity] = useState<UniversityAdapter | null>(null);
  const [year, setYear] = useState(() => String(detectTerm().year));
  const [yearOptions, setYearOptions] = useState<number[]>(() =>
    buildYearOptions(),
  );
  const [semester, setSemester] = useState<Semester>(() => detectTerm().semester);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    void offeringsStorage.getValue().then(setRows);

    // Auto-detect the university portal + the current Shamsi term.
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => {
        const uni = detectUniversity(tab?.url ?? "");
        setUniversity(uni);

        // Term detection only preselects - the user can always override.
        const term = detectTerm();
        setYear(String(term.year));
        setSemester(term.semester);
        setYearOptions(buildYearOptions());
      })
      .catch(() => undefined);

    void browser.runtime
      .sendMessage<BackgroundRequest>({
        type: "GET_EXTRACTION_STATE",
      })
      .then((res) => {
        const state = (res as { state?: { running: boolean; progress: ExtractionProgress | null } })?.state;
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

  const doc = useMemo(
    () => buildOfferingDoc(rows, Number(year), semester),
    [rows, year, semester],
  );

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

  const stopExtraction = () => {
    void browser.runtime.sendMessage<BackgroundRequest>({
      type: "STOP_EXTRACTION",
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
    anchor.download = offeringFileName(Number(year), semester);
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

  const percent =
    progress?.totalPages && progress.page
      ? Math.round((progress.page / progress.totalPages) * 100)
      : null;

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-background p-4 text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3">
        <img src="/icons/icon-48.png" alt="" className="h-9 w-9 rounded-lg" />
        <div className="flex-1">
          <h1 className="text-sm font-bold leading-5">استخراج‌گر دروس</h1>
          <p className="text-[11px] text-subtle">
            {university ? university.name : "در حال تشخیص دانشگاه…"}
          </p>
        </div>
        {rows.length > 0 && (
          <Badge tone="brand">
            {rows.length.toLocaleString("fa-IR")} درس
          </Badge>
        )}
      </div>

      {/* Extract / Stop */}
      {running ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {progress?.message ?? "در حال آماده‌سازی…"}
            </span>
            {percent !== null && (
              <span className="font-bold text-foreground">
                {percent.toLocaleString("fa-IR")}٪
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                "h-full rounded-full bg-brand transition-all duration-500",
                percent === null && "w-1/3 animate-pulse",
              )}
              style={percent !== null ? { width: `${percent}%` } : undefined}
            />
          </div>
          {progress && progress.collectedRows > 0 && (
            <p className="text-[11px] text-subtle">
              ذخیره شده: {progress.collectedRows.toLocaleString("fa-IR")} درس
            </p>
          )}
          <Button variant="destructive" onClick={stopExtraction}>
            توقف
          </Button>
        </div>
      ) : rows.length > 0 ? (
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={startExtraction}>
            استخراج از همه صفحات
          </Button>
          <Button variant="secondary" className="flex-1" onClick={startExtraction}>
            ادامه
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={startExtraction}>
          استخراج از همه صفحات
        </Button>
      )}

      <p className="text-center text-[11px] leading-4 text-subtle">
        صفحه لیست دروس را باز کنید؛ به‌صورت خودکار به صفحه اول برمی‌گردد و
        صفحه‌به‌صفحه ذخیره می‌شود.
      </p>

      {/* Alerts */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
          {error}
        </div>
      )}
      {summary && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-400">
          {summary}
        </div>
      )}

      {/* Export section */}
      {rows.length > 0 && !running && (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">خروجی رجیستری</span>
            <Badge tone="neutral">
              courses/{year}/{semester.toLowerCase()}/new.json
            </Badge>
          </div>

          {/* Term picker - preselected by Shamsi month, user can override */}
          <div className="flex gap-2">
            <select
              dir="ltr"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="h-9 w-28 rounded-lg border border-border bg-card-elevated px-2 text-center text-sm text-foreground outline-none focus:border-brand"
            >
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
            <div className="flex flex-1 gap-1 rounded-lg border border-border bg-card-elevated p-1">
              {SEMESTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSemester(s)}
                  className={cn(
                    "h-7 flex-1 rounded-md text-xs transition-colors",
                    semester === s
                      ? "bg-zinc-700 font-bold text-white"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {SEMESTER_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" onClick={() => void copyJson()}>
              کپی JSON
            </Button>
            <Button onClick={() => downloadJson()}>دانلود</Button>
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        {university?.replaceMenu && (
          <Button
            variant="destructive"
            onClick={() => void openCourseMenu()}
            className="flex-1"
          >
            صفحه دروس نیست؟
          </Button>
        )}
        <Button
          variant="ghost"
          className={cn(
            "w-auto shrink-0 px-3 text-xs text-red-400 hover:text-red-300",
            !university?.replaceMenu && "flex-1",
          )}
          onClick={() => void clearAll()}
          disabled={rows.length === 0}
        >
          پاک‌سازی
        </Button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed inset-x-4 bottom-4 rounded-lg border border-border bg-card-elevated px-3 py-2 text-center text-xs text-foreground shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
