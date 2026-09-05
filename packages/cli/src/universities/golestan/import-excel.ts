#!/usr/bin/env tsx
/**
 * Golestan Excel → courses.json exporter.
 *
 * Interactive (default):
 *   pnpm --filter @workspace/cli import:golestan
 *
 * Non-interactive (scripts / verification — same code path):
 *   pnpm --filter @workspace/cli import:golestan -- \
 *     --excel ./export.xlsx --groups "مهندسي فضاي سبز" \
 *     --degree "کارشناسی پیوسته" --yes
 *
 * Output: SINGLE `packages/cli/output/courses.json` (gitignored), shape
 * `{ exportedAt, offerings }` — year/semester/degree metadata are NOT
 * stored; the registry folder the file is promoted into carries them.
 * Promoting it into `packages/registry/registry/.../new.json` is a
 * separate, reviewed step — never automatic.
 */
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { confirm, multiselect, selectOne, textInput } from "../../prompts.ts";
import { ensureRtlDisplay, t } from "../../rtl.ts";
import { writeOutput } from "../../output.ts";
import { parseGolestanExcel, toOffering } from "./excel.ts";

const DEGREES = [
  "کارشناسی پیوسته",
  "کارشناسی ناپیوسته",
  "کارشناسی ارشد",
  "دکتری عمومی",
  "دکتری تخصصی",
];

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/**
 * pnpm `--filter` runs package scripts with cwd = the package dir, so a
 * relative `./export.xlsx` would resolve inside `packages/cli`. Resolve
 * relative paths against the workspace root (where pnpm-workspace.yaml
 * lives) instead — that matches where users invoke the command from.
 */
function findWorkspaceRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export async function main(): Promise<void> {
  // ── RTL display fix (asks once, persists to output/terminal.json) ──
  await ensureRtlDisplay(!hasFlag("yes") && process.stdout.isTTY === true);

  // ── excel path ──
  let excel = flag("excel");
  if (!excel) {
    excel = await textInput(
      t("Excel file path? (relative to repo root)"),
      "./export.xlsx"
    );
  }
  const abs = isAbsolute(excel)
    ? excel
    : resolve(findWorkspaceRoot(), excel);
  if (!existsSync(abs)) {
    console.error(t(`File not found: ${abs}`));
    process.exit(1);
  }

  const { rows, groups } = parseGolestanExcel(abs);
  console.log(t(`Loaded ${rows.length} rows in ${groups.length} گروه آموزشی.`));

  // ── group selection (arrows + Space, A = toggle all) ──
  const groupsFlag = flag("groups");
  let selectedKeys: string[];
  if (groupsFlag) {
    const wanted = groupsFlag.split(",").map((s) => s.trim()).filter(Boolean);
    selectedKeys = groups
      .filter((g) => wanted.includes(g.name) || wanted.includes(g.code))
      .map((g) => `${g.code} ${g.name}`);
    if (selectedKeys.length === 0) {
      console.error(t(`No گروه آموزشی matched: ${groupsFlag}`));
      process.exit(1);
    }
  } else {
    selectedKeys = await multiselect(
      t("Which گروه آموزشی to export?"),
      groups.map((g) => ({
        title: t(g.name || g.code),
        value: `${g.code} ${g.name}`,
        hint: t(`${g.count} درس`),
      }))
    );
    if (selectedKeys.length === 0) {
      console.log("Nothing selected. Exiting.");
      process.exit(0);
    }
  }
  const picked = new Set(selectedKeys);
  const filtered = rows.filter((r) => picked.has(`${r.groupCode} ${r.groupName}`));

  // ── degree (asked every run — Excel has no degree column) ──
  const degree =
    flag("degree") ??
    (await selectOne(
      "Degree?",
      DEGREES.map((d) => ({ title: t(d), value: d }))
    ));

  // ── convert + stats ──
  const offerings = filtered.map((r) => toOffering(r, degree));
  const multi = offerings.filter((o) => o.classSchedule.length > 1).length;
  const noSched = offerings.filter((o) => o.classSchedule.length === 0).length;
  const noExam = offerings.filter((o) => !o.examSchedule).length;
  const withLocation = offerings.filter((o) =>
    o.location.some((l) => l != null)
  ).length;

  console.log(
    t(`
Groups:    ${selectedKeys.length}
Offerings: ${offerings.length}
Multi-session (2+): ${multi}
No schedule:        ${noSched}
No exam:            ${noExam}
With مکان:          ${withLocation}`)
  );

  if (!hasFlag("yes") && !(await confirm(t("Write output/courses.json?"), true))) {
    console.log("Cancelled.");
    process.exit(0);
  }

  const doc = {
    exportedAt: new Date().toISOString(),
    offerings,
  };
  const out = writeOutput("courses.json", doc);
  console.log(`Wrote ${offerings.length} offerings → ${out}`);
}

/** Auto-run only when invoked directly — the `import` router imports this
 *  module and calls `main()` itself after the university menu. */
const isDirectRun = (() => {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    return (
      realpathSync(entry).toLowerCase() ===
      realpathSync(fileURLToPath(import.meta.url)).toLowerCase()
    );
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
