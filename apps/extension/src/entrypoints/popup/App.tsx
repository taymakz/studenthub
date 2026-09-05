import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/cn";
import { type BackgroundRequest, type ExtractionProgress } from "../../lib/types";
import { browser } from "#imports";
import { useExtraction } from "./use-extraction";

/** Pure message sender - no local state, so it lives at module scope. */
function stopExtraction() {
  void browser.runtime.sendMessage<BackgroundRequest>({
    type: "STOP_EXTRACTION",
  });
}

/** Inline logo - the extension icon drawn as SVG (crisp at any DPI). */
function Logo() {
  return (
    <svg viewBox="0 0 512 512" className="h-9 w-9 rounded-lg" aria-hidden="true">
      <defs>
        <linearGradient id="logo-tile" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#18181b" />
          <stop offset="100%" stopColor="#09090b" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#logo-tile)" />
      <rect
        x="4"
        y="4"
        width="504"
        height="504"
        rx="108"
        fill="none"
        stroke="#3f3f46"
        strokeOpacity="0.55"
        strokeWidth="8"
      />
      <g transform="translate(114.36 94.61) scale(0.635)" fill="#ffffff">
        <path d="M439.3,1.2l-213.46,128.62c-1.43.86-3.22.86-4.64,0L6.82.65C3.82-1.15,0,1.01,0,4.51v264.58c0,1.58.83,3.04,2.18,3.85l219.02,131.97c1.43.86,3.22.86,4.64,0l218.1-131.42c1.35-.81,2.18-2.28,2.18-3.85V5.06c0-3.5-3.82-5.66-6.82-3.85Z" />
        <path d="M446.12,315.63v56.77c0,1.58-.83,3.04-2.18,3.85l-218.1,131.42c-1.43.86-3.22.86-4.64,0L2.18,375.7c-1.35-.81-2.18-2.28-2.18-3.85v-56.77c0-3.5,3.82-5.66,6.82-3.85l187.25,112.83h.01l27.12,16.34c1.43.86,3.22.86,4.65,0l213.45-128.62c3-1.81,6.82.35,6.82,3.85Z" />
      </g>
    </svg>
  );
}

function ExtractionHeader({
  count,
  universityName,
}: {
  count: number;
  universityName?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Logo />
      <div className="flex-1">
        <h1 className="text-sm font-bold leading-5">استخراج‌گر دروس</h1>
        <p className="text-[11px] text-subtle">
          {universityName ?? "در حال تشخیص دانشگاه…"}
        </p>
      </div>
      {count > 0 && (
        <Badge tone="brand">{count.toLocaleString("fa-IR")} درس</Badge>
      )}
    </div>
  );
}

function ExtractionStatus({
  progress,
  onStop,
}: {
  progress: ExtractionProgress;
  onStop: () => void;
}) {
  const percent =
    progress?.totalPages && progress.page
      ? Math.round((progress.page / progress.totalPages) * 100)
      : null;

  return (
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
      <Button variant="destructive" onClick={onStop}>
        توقف
      </Button>
    </div>
  );
}

function StartControls({
  hasRows,
  onStart,
}: {
  hasRows: boolean;
  onStart: () => void;
}) {
  return hasRows ? (
    <div className="flex gap-2">
      <Button variant="primary" className="flex-1" onClick={onStart}>
        استخراج از همه صفحات
      </Button>
      <Button variant="secondary" className="flex-1" onClick={onStart}>
        ادامه
      </Button>
    </div>
  ) : (
    <Button variant="primary" onClick={onStart}>
      استخراج از همه صفحات
    </Button>
  );
}

function AlertBanners({
  error,
  summary,
}: {
  error: string | null;
  summary: string | null;
}) {
  return (
    <>
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
    </>
  );
}

function ExportPanel({
  onCopy,
  onDownload,
}: {
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-3">
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={onCopy}>
          کپی JSON
        </Button>
        <Button className="flex-1" onClick={onDownload}>
          دانلود
        </Button>
      </div>
    </div>
  );
}

function FooterActions({
  canFixMenu,
  canClear,
  onMenu,
  onClear,
}: {
  canFixMenu: boolean;
  canClear: boolean;
  onMenu: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
      {canFixMenu && (
        <Button variant="destructive" onClick={onMenu} className="flex-1">
          صفحه دروس نیست؟
        </Button>
      )}
      <Button
        variant="ghost"
        className={cn(
          "w-auto shrink-0 px-3 text-xs text-red-400 hover:text-red-300",
          !canFixMenu && "flex-1",
        )}
        onClick={onClear}
        disabled={!canClear}
      >
        پاک‌سازی
      </Button>
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed inset-x-4 bottom-4 rounded-lg border border-border bg-card-elevated px-3 py-2 text-center text-xs text-foreground shadow-xl">
      {message}
    </div>
  );
}

export default function App() {
  const extraction = useExtraction();

  return (
    <div className="flex min-h-screen flex-col gap-3 bg-background p-4 text-foreground">
      {/* Header */}
      <ExtractionHeader
        count={extraction.rows.length}
        universityName={extraction.university?.name}
      />

      {/* Extract / Stop */}
      {extraction.running ? (
        <ExtractionStatus
          progress={extraction.progress!}
          onStop={stopExtraction}
        />
      ) : (
        <StartControls
          hasRows={extraction.rows.length > 0}
          onStart={() => void extraction.startExtraction()}
        />
      )}

      <p className="text-center text-[11px] leading-4 text-subtle">
        صفحه لیست دروس را باز کنید؛ به‌صورت خودکار به صفحه اول برمی‌گردد و
        صفحه‌به‌صفحه ذخیره می‌شود.
      </p>

      {/* Alerts */}
      <AlertBanners error={extraction.error} summary={extraction.summary} />

      {/* Export section - only download/copy, year/semester inferred from folder */}
      {extraction.rows.length > 0 && !extraction.running && (
        <ExportPanel
          onCopy={() => void extraction.copyJson()}
          onDownload={extraction.downloadJson}
        />
      )}

      {/* Footer actions */}
      <FooterActions
        canFixMenu={extraction.university?.replaceMenu != null}
        canClear={extraction.rows.length > 0}
        onMenu={() => void extraction.openCourseMenu()}
        onClear={() => void extraction.clearAll()}
      />

      {/* Toast */}
      {extraction.toast && <Toast message={extraction.toast} />}
    </div>
  );
}
