import * as esbuild from "esbuild"
import { cpSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

await esbuild.build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outdir: "dist",
  alias: {
    "@": "./src",
  },
  // Provide a `require` shim so that bundled CJS deps (e.g. grammy) that
  // dynamically require Node built-ins work in the ESM output on Vercel.
  banner: {
    js: `import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);`,
  },
  // Bundle everything (including workspace packages) except node built-ins
  packages: "bundle",
  external: [],
  sourcemap: false,
  logLevel: "info",
})

// Copy registry into dist/ so Vercel's includeFiles ("dist/**")
// picks everything up. The API reads these at runtime via readFileSync
// for slug-to-name resolution, chart lookups, and offering data.
const registryDir = join(__dirname, "../../packages/registry/registry")
const destRegistry = join(__dirname, "dist/registry")
if (existsSync(registryDir)) {
  mkdirSync(destRegistry, { recursive: true })
  cpSync(registryDir, destRegistry, { recursive: true })
  console.log("✅ Copied registry to dist/registry/")
} else {
  console.warn("⚠️  Registry not found — chart/offerings/name resolution will degrade")
}

console.log("✅ API bundled to dist/server.js")
