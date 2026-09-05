/**
 * Shared output writer for @workspace/cli.
 *
 * All exporters write a SINGLE intermediate `courses.json` into the
 * gitignored `packages/cli/output/` directory (never commit it — it may
 * contain raw university data). Promoting it into
 * `packages/registry/registry/.../new.json` is a separate, reviewed step.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path of the gitignored output directory. */
export function outputDir(): string {
  // src/ -> packages/cli/output
  return join(here, "..", "output");
}

/** Write `data` as pretty JSON into the output dir. Returns absolute path. */
export function writeOutput(fileName: string, data: unknown): string {
  const dir = outputDir();
  mkdirSync(dir, { recursive: true });
  const abs = join(dir, fileName);
  writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf-8");
  return abs;
}
