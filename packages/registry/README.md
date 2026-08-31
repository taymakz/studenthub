# Registry — StudentHub Community Data

> Single source of truth for universities, majors, degrees, curriculum charts, semester offerings, professors, archives and groups. All JSON, contributed via PRs, validated by CI. No DB, no FK — DB rows store slugs only.

**Location:** `packages/registry/registry/`

**Schemas:** `packages/registry/schemas/*.json` (local, referenced via `$schema` relative paths) + Zod source `packages/registry/src/schema/*.ts`  
**Loader:** `packages/registry/src/loader.ts` — throws `RegistryNotFoundError` / `RegistryParseError`  
**Validator:** `packages/registry/src/validate.ts` — what CI runs  
**Indexer:** `packages/registry/src/build-index.ts` — builds `registry/index/*.json`

---

## Quick Start

```bash
pnpm reg:build          # = validate + build-index (single command, root)
# or step by step:
pnpm --filter @workspace/registry validate
pnpm --filter @workspace/registry build-index
```

After any edit under `registry/` you **must** run `pnpm reg:build` before committing — `index/*.json` is generated and never hand-edited. CI will fail if index is stale.

```bash
pnpm --filter @workspace/registry validate   # same as CI on PRs
```

---

## Layout (current, after meta.json migration)

```
packages/registry/
  schemas/                      # JSON Schema stubs (local $schema targets)
    university.json
    major.json
    chart.json
    chart-degree.json
    professors.json
    archives.json
    groups.json
  registry/
    universities/<uni>/
      meta.json                 # ← was university.json (now with $schema local)
      majors/<major>/
        meta.json               # ← was major.json (degrees may live here OR in charts degree meta)
        charts/<degree>/
          meta.json             # NEW — degree-level meta (termCount / maxTermCount)
          [1403-1404]/mehr.json # entry cohort + entry semester
          1405/bahman.json      # single-year dirs are equally valid
          [1403-1404]/both.json # ONE shared MEHR+BAHMAN doc (semester:"BOTH"); mehr/bahman must not coexist
          # each chart file sits beside optional <semester>.pdf for «دریافت چارت»
        courses/<year>/<semester>/
          new.json              # latest scraped snapshot (extension writes ONLY this)
          old.json              # previous snapshot, rotated by CI (absent at first)
          diff.json             # generated diff, do not hand-edit
        professors.json         # optional
        archives.json           # approved Telegram file_id's only
        groups.json             # Telegram groups
    index/                      # GENERATED — universities/majors/charts/offering-terms/courses
```

**Historical names:** `university.json` → `meta.json`, `major.json` → `meta.json`. Loader still accepts legacy names for migration, but validator warns and new PRs must use `meta.json`.

---

## File Types

### `universities/<uni>/meta.json`

```json
{
  "$schema": "../../../schemas/university.json",
  "slug": "azad-malard",
  "type": "azad",
  "name": { "fa": "دانشگاه آزاد ملارد", "en": "Malard Azad University" },
  "location": { "fa": "تهران", "en": "Tehran" }
}
```

- `slug` must equal folder name, kebab-case, with institution prefix (`azad-*`, `gov-*`, `pnu-*`). Never rename after rows exist.
- `type` is **institution type** (`azad`/`gov`/`pnu`), not doc type. Must match slug prefix.
- `$schema` is **local relative** (e.g. `../../../schemas/university.json`) — not `https://`. Resolves to `packages/registry/schemas/`.

### `majors/<major>/meta.json`

```json
{
  "$schema": "../../../../../schemas/major.json",
  "type": "major",
  "slug": "computer-engineering",
  "name": { "fa": "مهندسی کامپیوتر" },
  "degrees": [{ "slug": "bachelors-degree", "name": { "fa": "کارشناسی پیوسته" }, "termCount": 8 }]
}
```

- `degrees` is **optional / deprecated** — canonical location is now `charts/<degree>/meta.json`. Keep for backwards compat only if the degree has no chart meta yet. New degrees should be defined only via chart degree meta.

### `charts/<degree>/meta.json` (NEW)

```json
{
  "$schema": "../../../../../../../schemas/chart-degree.json",
  "type": "chart-degree",
  "slug": "bachelors-degree",
  "name": { "fa": "کارشناسی پیوسته" },
  "termCount": 8,
  "maxTermCount": 14
}
```

- `termCount` = standard curriculum (8 for کارشناسی پیوسته)
- `maxTermCount` = with سنوات مجاز (e.g. 14). **Required, no default — whatever is here is authoritative** (`int >=1`, no upper cap). The setup page `ترم فعلی` reads `maxTermCount` to show `سنوات مجاز (9 تا 14)`.

### `charts/<degree>/<yearDir>/<semester>.json`

```json
{
  "type": "chart",
  "degree": "bachelors-degree",
  "semester": "MEHR",
  "isCompleted": false,
  "terms": { "1": [{ "name": "...", "theoreticalUnits": 3, "practicalUnits": 0, "prerequisites": [], "corequisites": [] }] },
  "moaref": [],
  "unknown": [],
  "electives": {}
}
```

- `yearDir` is smart: `[1403-1404]` (range, e.g. `[1399-1500]` also valid) or single `1405` (`src/year-dir.ts`). Ranges cover cohorts — no max span.
- `semester` files: `mehr.json`/`bahman.json`/`both.json` — no `summer` for charts (charts only for MEHR/BAHMAN; summer doesn't change). `both.json` (`BOTH`) covers MEHR+BAHMAN and must not coexist with `mehr.json`/`bahman.json`.
- `terms` keys are `"1".."N"` (stringified). `moaref`/`unknown` are global pools. `degree`/`semester` must match path.

### `courses/<year>/<semester>/new.json`

```json
{
  "year": 1405,
  "semester": "MEHR",
  "offerings": [{ "index": "123", "courseCode": "...", "courseName": "...", "theoreticalUnits": 3, "practicalUnits": 1, "professor": { "fa": "..." }, "classSchedule": "...", "examSchedule": "..." }]
}
```

- **No `$schema`** — courses are large snapshots, excluded from schema injection.
- Contributors and the **extension** (`apps/extension`) write **only** `new.json`. CI rotates `new.json` → `old.json` on merge (`scripts/rotate-offerings.sh`).
- `offeringTerm` directories are lowercase `mehr`/`bahman`/`summer` (no `both`).

### `professors.json` / `archives.json` / `groups.json`

Each has `"$schema": "../../../../../schemas/<type>.json"` and `"type": "<type>"`. Optional — loader returns `[]` if missing, validator skips if absent. `archives.json` stores `fileId` only (file lives in Telegram).

### All JSON files — sorted, one per line

```
index/charts.json
index/courses.json
index/majors.json
index/offering-diffs.json
index/offering-terms.json
index/universities.json
universities/<uni>/majors/<major>/archives.json
universities/<uni>/majors/<major>/charts/<degree>/<yearDir>/bahman.json
universities/<uni>/majors/<major>/charts/<degree>/<yearDir>/both.json
universities/<uni>/majors/<major>/charts/<degree>/<yearDir>/mehr.json
universities/<uni>/majors/<major>/charts/<degree>/meta.json
universities/<uni>/majors/<major>/courses/<year>/bahman/diff.json
universities/<uni>/majors/<major>/courses/<year>/bahman/new.json
universities/<uni>/majors/<major>/courses/<year>/bahman/old.json
universities/<uni>/majors/<major>/courses/<year>/mehr/diff.json
universities/<uni>/majors/<major>/courses/<year>/mehr/new.json
universities/<uni>/majors/<major>/courses/<year>/mehr/old.json
universities/<uni>/majors/<major>/courses/<year>/summer/diff.json
universities/<uni>/majors/<major>/courses/<year>/summer/new.json
universities/<uni>/majors/<major>/courses/<year>/summer/old.json
universities/<uni>/majors/<major>/groups.json
universities/<uni>/majors/<major>/meta.json
universities/<uni>/majors/<major>/professors.json
universities/<uni>/meta.json
```

Example `charts/<degree>/<yearDir>/<semester>.json`:
```json
{
  "$schema": "../../../../../../../../schemas/chart.json",
  "type": "chart",
  "degree": "bachelors-degree",
  "semester": "MEHR",
  "terms": { "1": [{ "name": "...", "code": "123", "theoreticalUnits": 3, "practicalUnits": 0, "prerequisites": [], "corequisites": [] }] },
  "moaref": [],
  "unknown": [],
  "electives": {}
}
```

---

## Conventions

- **Year directories:** `src/year-dir.ts` smart detector — `[a-b]` range (e.g. `[1399-1500]` valid, reversed rejected) or single `1405` — no max span.
- **Slugs:** `^[a-z0-9]+(-[a-z0-9]+)*$`, permanent, prefixed by institution type. No `-university` suffix. Shortest recognizable form (`gov-iust`, `azad-malard`).
- **Semester files vs directories:** Charts use files (`mehr.json`), offerings use directories (`mehr/new.json`).
- **`both.json`:** Single doc for MEHR+BAHMAN-identical curricula. `getChart` falls back to `BOTH` automatically.

---

## Validation & Index

```bash
pnpm --filter @workspace/registry validate   # checks slugs, year dirs, chart degree mismatch, both.json conflict, offering year/semester match, orphan files
pnpm --filter @workspace/registry build-index # writes registry/index/*.json
pnpm reg:build                               # root shortcut: validate && build-index
```

- Validator warns on legacy `university.json`/`major.json` names — rename to `meta.json`.
- Missing `charts/<degree>/meta.json` is an error (required).
- `index/*.json` (universities/majors/charts/offering-terms/courses) is **never hand-edited** — search reads index, never walks dirs (serverless-friendly). CI rebuilds after merge to `main`.

---

## Offering Diff & Notifications

- Offering `new.json` vs `old.json` diff uses `index` (شماره) as identity, compares `capacity`, `classSchedule`, `examSchedule`, `professor`, `location`.
- Diff → `diff.json` via `build-index` / `sync-offerings`.
- Notifications (`apps/api`) diff `new` vs `old` into a batch + per-user `PENDING` messages; admin sends manually from Notification Center (`POST /admin/notifications/batches/:id/send-next`) — never auto-send.

---

## Extension & Chart Builder

- **Extension** (`apps/extension`, WXT + React MV3): `pnpm --filter @workspace/extension icons` regenerates icons. Exports `courses/<year>/<semester>/new.json` for the registry. Multi-university adapters under `src/universities/<id>/`.
- **Chart Builder** (`apps/chart-builder`, port 3001): imports extension output as course pool, validates export against `chartDocSchema` from `@workspace/registry/schema` (import only `/schema` subpath in client).

> **Note:** Extension download link is not yet configured — this README will be updated once the store / direct download URL is available. For now, build locally: `pnpm --filter @workspace/extension build` → load unpacked `dist`.

---

## Contributing

1. Fork, branch, edit JSON under `registry/universities/...`.
2. Run `pnpm reg:build` locally — fix any validator errors.
3. Open PR — CI runs `validate` and checks `index` freshness (it will rebuild `index` on merge, but PR must be valid).
4. Slugs: pick institution prefix first, shortest recognizable suffix, never rename after merge.

---

## Open Questions for Maintainer

- **Extension download link:** Where will the extension be hosted? (Chrome Web Store, GitHub Releases, direct `.zip` on `student-hub.local`?) — placeholder above will be replaced.
- **Degrees source of truth:** Should `majors/.../meta.json:degrees` be fully removed (now duplicated in `charts/<degree>/meta.json`) or kept as deprecated fallback? Currently validator allows both, but `build-index` prefers `charts` meta when `degrees` is empty.
- **`maxTermCount` policy:** Any upper bound desired? Currently `>=1` unbounded per your request, but `electives.allowedTerms` still capped at 20 — should that also be unbounded?
- **PDF storage:** `charts/<degree>/<yearDir>/<semester>.pdf` — should these be committed to repo or fetched from `CHART_PDF_BASE_URL` (GitHub raw)? Currently both paths are checked (`both.pdf` fallback for MEHR/BAHMAN).
- **Schema hosting:** Keep `$schema` as local relative (`../../../schemas/...`) or publish to `https://registry.student-hub.local/schemas/...` for external editors?

> If you can clarify the above, this README will be updated in the next pass.
