/**
 * @workspace/cli — shared interactive exporters for university data.
 *
 * Each university system gets its own folder under `src/universities/`
 * (Golestan-excel, amoozeshyar-scraper, ...) reusing the shared
 * `prompts` / `fa` / `output` helpers. Run without npx — via package
 * scripts, e.g. `pnpm --filter @workspace/cli import:golestan`.
 */
export * as prompts from "./prompts.ts";
export * as fa from "./fa.ts";
export * as output from "./output.ts";
