// @ts-check
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = dirname(fileURLToPath(import.meta.url));
const svg = join(root, "..", "assets", "icon.svg");
const outDir = join(root, "..", "public", "icons");

const SIZES = [16, 32, 48, 128];

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

for (const size of SIZES) {
  await sharp(svg, { density: 512 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, `icon-${size}.png`));
  console.log(`icon-${size}.png`);
}

console.log("done");
