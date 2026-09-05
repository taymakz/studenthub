#!/usr/bin/env tsx
/**
 * Golestan parser self-check: parse coverage over a real export.
 *
 *   pnpm --filter @workspace/cli verify:golestan -- --excel ./export.xlsx
 *
 * Fails (exit 1) if any `درس(` session marker does not parse — that means
 * the source format drifted and excel.ts needs updating before exporting.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadRtlState, setRtlReverse, t } from "../../rtl.ts";
import { parseGolestanExcel, parseScheduleCell } from "./excel.ts";

setRtlReverse(loadRtlState().reverse);

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

/** pnpm runs this with cwd = packages/cli; relative paths resolve from the
 *  workspace root (same convention as import-excel.ts). */
function findWorkspaceRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

const raw = flag("excel") ?? "./export.xlsx";
const excel = resolve(findWorkspaceRoot(), raw);
const { rows } = parseGolestanExcel(excel);

let sessions = 0;
let unparsed = 0;
const unparsedExamples: string[] = [];
const sessionCounts = new Map<number, number>();

for (const row of rows) {
  const p = parseScheduleCell(row.scheduleCell);
  sessions += p.classSchedule.length;
  unparsed += p.unparsedMarkers;
  if (p.unparsedMarkers > 0 && unparsedExamples.length < 5) {
    unparsedExamples.push(`row ${row.rowNumber}: ${row.scheduleCell}`);
  }
  sessionCounts.set(
    p.classSchedule.length,
    (sessionCounts.get(p.classSchedule.length) ?? 0) + 1
  );
}

console.log(t(`rows: ${rows.length}`));
console.log(t(`sessions parsed: ${sessions}`));
console.log(
  t(
    `distribution: ${[...sessionCounts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" ")}`
  )
);
if (unparsed > 0) {
  console.error(t(`UNPARSED session markers: ${unparsed}`));
  for (const ex of unparsedExamples) console.error(t(`  ${ex}`));
  process.exit(1);
}
console.log(t("OK: every درس( session parsed."));
