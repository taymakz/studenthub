// @ts-check
import { existsSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, "..", ".output");
const built = join(output, "chrome-mv3");
const target = join(output, "extention");

// Single output directory: rename the WXT build instead of copying it, so
// .output only holds the ready-to-load extension plus its zip artifact.
if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
}
if (existsSync(built)) {
  renameSync(built, target);
  console.log("extention/");
}
