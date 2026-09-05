#!/usr/bin/env tsx
/**
 * Generic `import` entry point.
 *
 * Asks which university to import from, then routes to that university's
 * exporter. Universities sharing a system (e.g. Golestan) still get their
 * own entry — each Golestan installation exports different columns/quirks,
 * so every university is parsed and validated separately.
 *
 * Usage:
 *   pnpm --filter @workspace/cli import                # interactive menu
 *   pnpm --filter @workspace/cli import -- --type sistan-baluchestan --excel ./export.xlsx --yes
 */
import { selectOne } from "../prompts.ts";
import { ensureRtlDisplay, t } from "../rtl.ts";

interface Importer {
  /** Stable id for `--type`. */
  id: string;
  /** Persian menu label (shown as-is). */
  title: string;
  run: () => Promise<void>;
}

const IMPORTERS: Importer[] = [
  {
    id: "sistan-baluchestan",
    title: "سیستان و بلوچستان (گلستان)",
    run: async () => {
      const m = await import("../universities/golestan/import-excel.ts");
      await m.main();
    },
  },
];

function flag(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  await ensureRtlDisplay(!hasFlag("yes") && process.stdout.isTTY === true);

  const type = flag("type");
  let importer: Importer | undefined;
  if (type) {
    importer = IMPORTERS.find((i) => i.id === type);
    if (!importer) {
      console.error(
        `Unknown --type "${type}". Available: ${IMPORTERS.map((i) => i.id).join(", ")}`
      );
      process.exit(1);
    }
  } else {
    const value = await selectOne(
      t("Which university?"),
      IMPORTERS.map((i) => ({ title: t(i.title), value: i.id }))
    );
    importer = IMPORTERS.find((i) => i.id === value);
  }

  await importer!.run();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
