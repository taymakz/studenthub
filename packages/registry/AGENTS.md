# Registry Agent Guide

> For AI agents and automation working inside `packages/registry`. Human guide is `README.md`.

## Do Not Deviate

- **Layout is contract.** `registry/universities/<uni>/meta.json` (not `university.json`), `majors/<major>/meta.json` (not `major.json`), `charts/<degree>/meta.json` (required), `charts/<degree>/<yearDir>/<semester>.json`, `courses/<year>/<semester>/new.json`. See `src/paths.ts` — never hand-build paths.
- **Index is generated.** `registry/index/*.json` is output of `build-index` — never edit by hand, never walk dirs at runtime — API reads index via `readIndexes()` (`apps/api/src/lib/registry.ts`).
- **Year dirs are smart.** `[1403-1404]` or `1405` or `[1399-1500]` — no max span, reversed rejected — `src/year-dir.ts`. Use `parseYearDirectory`/`formatYearDirectory`.
- **Slugs are permanent.** `^[a-z0-9]+(-[a-z0-9]+)*$`, prefixed `azad-*`/`gov-*`/`pnu-*`, no `-university` suffix. Never rename after DB rows exist.

## Schemas & Validation

- **Zod source:** `src/schema/*.ts` — `universityDocSchema`, `majorDocSchema`, `chartDocSchema`, `chartDegreeMetaSchema`, `professorsDocSchema`, `archivesDocSchema`, `groupsDocSchema`, `offeringDocSchema`.
- **JSON Schema stubs:** `schemas/*.json` — local `$schema` targets for editors. Data files reference them via **local relative** `$schema` (e.g. `../../../schemas/university.json`), not `https://`. Computed via `path.relative` per file depth.
- **Per-file `$schema`/`type`:** Every JSON **except `courses/**` and `charts/**` has `"$schema"` (local) and `"type"` (`university` is institution type, others are doc type: `major`/`chart-degree`/`professors`/`archives`/`groups`; `charts/**` has `"type":"chart"` but no `"$schema"`). Courses (`new.json`/`old.json`/`diff.json`) are exempt.
- **Chart degree meta:** `charts/<degree>/meta.json` with `termCount` (standard, e.g. 8) and `maxTermCount` (with سنوات, e.g. 14). **Both required, no default** — `z.int().min(1)`; whatever is there is authoritative. Validator does NOT cap; `build-index` and `setup` page (`apps/mini-app/app/setup/page.tsx`) read `maxTermCount` to render `سنوات مجاز (X تا Y)`.
- **Degrees duplication:** `majors/.../meta.json:degrees` is deprecated — canonical is `charts/<degree>/meta.json`. `majorDocSchema:degrees` is optional. `validate.ts` and `build-index.ts` fall back to filesystem `charts/*/meta.json` when `degrees` is empty, and enrich with `maxTermCount`.

## Loader Behavior

- `src/loader.ts` — `getUniversity`/`getMajor` try `meta.json` first, fallback to legacy `university.json`/`major.json` (warns). `getDegree` falls back to `getChartDegreeMeta`. `getChart` falls back `mehr`/`bahman` → `both.json`. `listChartYearDirs` sorts newest first. Missing optional docs (`professors`/`archives`/`groups`, `old.json`) return `null`/`[]`, not throw.
- `readJson` throws `RegistryNotFoundError`/`RegistryParseError` — callers must handle.

## Validator Rules (`src/validate.ts`)

- Slugs, year dirs, chart degree mismatch (`degree`/`semester` vs path), `both.json` conflict, offering `year`/`semester` vs folder, orphan files.
- Legacy `university.json`/`major.json` → warning to rename to `meta.json`.
- Missing `charts/<degree>/meta.json` → error (required).
- `courses/<year>/<semester>/` only allows `new.json`/`old.json`/`diff.json`; `new.json` required.
- `knownDocs` for major dir: `meta.json`, `major.json` (legacy), `professors.json`, `archives.json`, `groups.json`.

## Index Builder (`src/build-index.ts`)

- Reads all `universities` → `majors` → `charts`/`courses` via loader, writes `registry/index/{universities,majors,charts,offering-terms,courses}.json`.
- `majors.degrees` includes `maxTermCount` when present in chart degree meta.
- `charts` entries fan out `BOTH` → `["MEHR","BAHMAN"]`.
- Must run after any registry edit: `pnpm reg:build` (root) = `validate && build-index`. Also available as `pnpm --filter @workspace/registry build` (for `turbo build`).

## Commands

```bash
pnpm reg:build                # validate + build-index (single root command)
pnpm --filter @workspace/registry validate
pnpm --filter @workspace/registry build-index
pnpm --filter @workspace/registry build   # same as reg:build, for turbo
```

## Adding Data

- **New university:** `universities/<slug>/meta.json` + `majors/` folder. Run `reg:build`.
- **New major:** `majors/<slug>/meta.json` + `charts/<degree>/meta.json` (with `termCount`/`maxTermCount`) + charts. No need to keep `degrees` in major meta if chart meta exists.
- **New chart:** `charts/<degree>/<yearDir>/mehr.json` (or `both.json`). Validate `degree`/`semester` match path.
- **New offering:** `courses/<year>/<semester>/new.json` only — CI rotates to `old.json` on merge. Never create `old.json` manually.
- **Professors/archives/groups:** Optional JSON under `majors/<major>/`. `archives.json` stores `fileId` only.

## Extension & PDFs

- Extension (`apps/extension`) exports `courses/.../new.json` for offerings — drop-in for rotation.
- Chart PDFs sit beside chart JSON as `<semester>.pdf` (or `both.pdf`). API `GET /me/chart-file` checks `mehr.pdf` then fallback `both.pdf` for MEHR/BAHMAN.

> **Note:** Extension download link not yet set — `README.md` will be updated once available. For now `pnpm --filter @workspace/extension build`.

## Open Questions — Ask Maintainer Before Guessing

1. Extension hosting: Chrome Web Store vs GitHub Releases vs direct URL?
2. Should `majors/meta.json:degrees` be fully deleted (now duplicated) or kept as deprecated?
3. Any cap for `maxTermCount`? Currently unbounded per request — should `electives.allowedTerms` also be unbounded (currently max 20)?
4. PDFs: commit to repo or serve via `CHART_PDF_BASE_URL`?
5. `$schema` publishing: keep local relative or publish to `https://registry.student-hub.local/schemas/...`?

If unsure, ask — do not invent paths or caps.
