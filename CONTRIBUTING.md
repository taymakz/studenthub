# Contributing

Thanks for helping StudentHub grow! There are two kinds of contributions:

- **Registry contributions (data)** — add or update a university, major, curriculum chart, or semester offerings. JSON only, no coding. This is the most valuable contribution: it unlocks StudentHub for a whole university. See [Adding a new university](#adding-a-new-university).
- **Code contributions** — the apps and packages themselves (`apps/*`, `packages/*`). See [Code contributions](#code-contributions).

---

## Local setup

Prereqs: **Node 20+**, **pnpm**, **Bun** (for the API), **Docker**.

```bash
docker compose up -d        # Postgres 17 on port 5433 — the only infra
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

| App                | URL                                          | Notes                                  |
| ------------------ | -------------------------------------------- | -------------------------------------- |
| Mini App           | `http://mini-app.student-hub.localhost:3000` | Next.js 16, Telegram Mini App + web    |
| API                | `http://api.student-hub.localhost:8000`      | Hono on Bun, mounted under `/api`      |
| Chart Builder      | `http://localhost:3001`                      | `pnpm --filter @workspace/chart-builder dev` |
| Admin              | `http://localhost:3002`                      | OTP login via the Telegram bot         |

Dev auth: the mini app reads `NEXT_PUBLIC_DEV_INIT_DATA` (see `apps/mini-app/.env`). Generate a signed initData for any chat id — it's HMAC-signed with the same bot token, so the API validates it unchanged:

```bash
pnpm --filter @workspace/db dev:initdata <chatId>
```

Useful root commands:

```bash
pnpm reg:build      # sync + validate + rebuild registry index (REQUIRED after registry edits)
pnpm typecheck      # turbo typecheck
pnpm lint           # turbo lint
pnpm test           # vitest
pnpm db:studio      # drizzle studio on the local DB
```

---

## Registry concepts

The registry (`packages/registry/registry/`) is StudentHub's database. Everything is JSON, validated by Zod schemas (`packages/registry/src/schema/`) and JSON Schema stubs (`packages/registry/schemas/`) referenced via relative `$schema` paths. The API reads the **generated index** (`registry/index/*.json`), never walks directories — that's why `pnpm reg:build` must run after every registry edit.

### Layout

```
packages/registry/registry/
  universities/<uni-slug>/               # permanent — never rename
    meta.json                            # university identity (name, type, location)
    majors/<major-slug>/
      meta.json                          # major identity
      charts/<degree-slug>/
        meta.json                        # termCount / maxTermCount (required)
        [1403-1405]/both.json            # entry-year dir + entry-semester chart
        [1403-1405]/both.pdf             # optional sibling PDF for «دریافت چارت»
        1402/mehr.json                   # single-year dirs are equally valid
      courses/<year>/<semester>/
        new.json                         # latest scraped offerings snapshot
        old.json                         # previous snapshot (rotated by CI)
        diff.json                        # generated — never hand-edit
      professors.json                    # AUTO-GENERATED from new.json (append-only)
      archives.json                      # approved Telegram file_ids (admin adds)
      groups.json                        # Telegram groups
  index/                                 # GENERATED — never hand-edit
```

### Slugs and naming rules

- University slug = institution prefix + shortest recognizable name: `azad-malard`, `gov-iust`, `pnu-*`. Institution types are `azad` | `gov` | `pnu` and **must match the slug prefix** — each type maps to a logo in the mini app.
- **Slugs are permanent.** DB rows reference them; renaming after merge breaks every user profile. Choose carefully.
- Major slugs are plain kebab-case: `computer-engineering`.
- Chart year dirs: a range like `[1403-1405]` or a single year like `1402` — reversed ranges are rejected.
- Chart files are the **entry semester**: `mehr.json`, `bahman.json`, or `both.json` when Mehr and Bahman entrants share the identical curriculum (`both.json` and `mehr.json` must not coexist for the same year dir).

### Degrees

Each degree lives at `charts/<degree-slug>/meta.json`:

```json
{
  "$schema": "../../../../../../../schemas/chart-degree.json",
  "type": "chart-degree",
  "slug": "bachelors-degree",
  "name": { "fa": "کارشناسی پیوسته", "en": "Bachelor's degree" },
  "termCount": 8,
  "maxTermCount": 12
}
```

`termCount` is the standard curriculum length; `maxTermCount` is the سنوات مجاز cap. Whatever is here is the source of truth.


---

## Adding a new university

End-to-end walkthrough for a registry-only PR. Example: an **Azad** university -> your slug will be `azad-<name>`.

### 1. Fork and skeleton

Fork the repo, create a branch, and copy the reference structure from [Azad Malard / Computer Engineering](./packages/registry/registry/universities/azad-malard/majors/computer-engineering):

```
registry/universities/azad-<your-uni>/
  meta.json
  majors/<your-major>/
    meta.json
    charts/bachelors-degree/meta.json
    charts/bachelors-degree/<yearDir>/both.json
    courses/<year>/<semester>/new.json
```

`universities/azad-<your-uni>/meta.json`:

```json
{
  "$schema": "../../../schemas/university.json",
  "type": "azad",
  "slug": "azad-<your-uni>",
  "name": { "fa": "...", "en": "..." },
  "location": { "fa": "...", "en": "..." }
}
```

The `majors/<major>/meta.json` follows the same pattern with `"type": "major"`. The list of majors is derived from the folder - never duplicate it in the university file.

### 2. Extract the offerings with the extension

1. Download the **StudentHub Course Extractor** Chrome extension from the [Releases](https://github.com/taymakz/studenthub/releases) page and install it.
2. Open your university's **آموزشیار** panel and go to the course-offering search page. If you don't see the courses list page, click the **«صفحه دروس نیست؟»** button — a popup opens; click through it and the courses page will appear.
3. If your university has many courses (the default search limit is 10), raise the search limit to **100** and hit search. Then open the extension and hit **«استخراج از همه صفحات»** — it automatically switches pages and extracts everything.
4. If the result set is too large the extension shows nothing. In that case split the extraction by filter:
   - Add another search filter so only **main courses (دروس اصلی)** are shown, then start the extraction.
   - When it finishes, change the filter to **only Moaref (معارف)**, then hit the **«ادامه»** button (not «استخراج از همه صفحات») — it merges both runs into one exportable result.
5. The merged result is exportable as `new.json` — copy it or download the file.

### 3. Build the chart in the Chart Builder

1. Open [chart.student-hub.ir](https://chart.student-hub.ir/) and **paste** the extracted JSON (file upload or `Ctrl + V`). The offerings become your course pool.
2. Build the curriculum chart: assign each course to its term, set theoretical/practical units, and wire **prerequisites** (course names, or a number = minimum passed units, e.g. `100`) and **corequisites**.
3. Before you start, study the existing chart JSONs - e.g. Azad Malard Computer Engineering's `charts/bachelors-degree/[1403-1405]/both.json` - they show every field in real use, including `moaref` (معارف courses), `unknown` (term undecided) and elective groups.

### 4. Export

Click **Export** in the Chart Builder and choose:

- **Is the chart complete?** -> sets `isCompleted` in the chart document.
- **Semester coverage** -> `both.json` (Mehr + Bahman entrants share the curriculum) or a single `mehr.json` / `bahman.json`.

### 5. Place the files in the registry

- Chart document -> `majors/<major>/charts/<degree>/<yearDir>/<mehr|bahman|both>.json`
- Extracted offerings -> `majors/<major>/courses/<year>/<semester>/new.json` (only `new.json` - CI rotates it to `old.json`)
- Optional: the official curriculum PDF beside the chart file with the same name (`both.pdf`), used by «دریافت چارت».

### 6. Validate, commit, PR

```bash
pnpm reg:build     # validates every document and rebuilds registry/index/*.json
```

Fix any validator errors, then open a PR. Rules:

- Registry PRs must **only touch `packages/registry/registry/`** (plus the regenerated `registry/index/`).
- One university (or one logical change) per PR.
- CI runs the validator on every PR; the index is rebuilt on merge.

---

## Registry schemas reference

### Chart document (charts/<degree>/<yearDir>/<semester>.json)

```json
{
  "$schema": "../../../../../schemas/chart.json",
  "type": "chart",
  "degree": "bachelors-degree",
  "semester": "BOTH",
  "isCompleted": true,
  "terms": {
    "1": [
      {
        "name": "مبانی برنامه‌نویسی",
        "theoreticalUnits": 3,
        "practicalUnits": 1,
        "prerequisites": [],
        "corequisites": ["آزمایشگاه مبانی برنامه‌نویسی"]
      }
    ]
  },
  "moaref": [],
  "unknown": [],
  "electives": {}
}
```

- Term keys are strings "1".."N" (JSON always stringifies keys).
- prerequisites is either an array of **course names** (must match a course in the chart) or a single **number** = minimum passed units required (e.g. 100).
- moaref holds the معارف courses common to all terms; unknown holds courses whose term is not decided yet - they float until a contributor assigns them.
- semester is MEHR | BAHMAN | BOTH and must match the file name.
- Elective groups (electives) require requiredUnits to pick from the group pool, with optional allowedTerms and minPracticalUnits (lab/workshop minimum).

### Offerings snapshot (courses/<year>/<semester>/new.json)

```json
{
  "year": 1405,
  "semester": "MEHR",
  "scrapedAt": "2026-08-31T14:21:04.821Z",
  "offerings": [
    {
      "index": "90313-75002",
      "courseCode": "90313",
      "courseName": "تفسیر موضوعی نهج‌البلاغه",
      "theoreticalUnits": 2,
      "practicalUnits": 0,
      "classCode": "75002",
      "degree": "کارشناسی پیوسته",
      "maxCapacity": 40,
      "classSchedule": "شنبه از 09:15 تا 11:00",
      "examSchedule": "1405/10/22 از 08:30 تا 10:30",
      "professor": "لعیا مرادی پر",
      "location": null
    }
  ]
}
```

- The index (شماره) is the **stable identity** the diff pipeline uses - never edit it by hand.
- scrapedAt must be an ISO timestamp. The extension fills all of this; you only place the file.
- Diffs against old.json (capacity, schedule, exam, professor, location) become diff.json and drive user notifications.

### Optional files

- `professors.json` — **auto-generated** by `pnpm reg:build`: every professor name found in the major's `new.json` snapshots is appended with a unique sequential id (`prof-<n>`). Existing entries are never removed or renamed (DB votes reference the slug), so a second run is a no-op. Never hand-edit; a hand-written entry will simply be preserved by the generator.
- `groups.json` — Telegram groups.
- `archives.json` — approved Telegram `file_id`s (added by admins after upload review).

---

## Updating an existing university

- **New semester offerings (new.json only):** if your chart is already in place and you only want to refresh the offerings, just re-extract with the extension (see step 2 above) and **copy the JSON and replace `new.json` only** — then run `pnpm reg:build` and everything else is auto-generated: `old.json` (previous snapshot), `diff.json` (the change set that drives notifications) and `professors.json` (append-only professor list). You never touch those three by hand.
- **Chart fixes** (moved course, new prerequisite, new year-dir for the incoming cohort): edit the chart JSON directly and PR. Keep isCompleted accurate.
- **Professors:** nothing to do — `pnpm reg:build` derives `professors.json` from your `new.json` (append-only, unique `prof-<n>` ids).
- Never touch old.json / diff.json - CI manages them.

---

## Code contributions

1. Comment on / open an issue first so work is not duplicated.
2. Follow the architecture decisions in [AGENTS.md](./AGENTS.md) - they are deliberate: registry over DB, Postgres as the only infra, stateless tma auth, manual notification sending.
3. Keep changes scoped: one logical change per PR, pnpm typecheck && pnpm lint && pnpm test green.
4. Next.js in this repo is a newer version than you may know - read node_modules/next/dist/docs/ before writing app code and heed deprecation notices.

## PR checklist

- [ ] pnpm reg:build run after any registry edit (index is fresh, validator passes)
- [ ] Registry PRs touch only packages/registry/registry/
- [ ] Slugs follow the naming rules and are final (they are permanent)
- [ ] semester in each chart matches its filename (both.json <-> "BOTH")
- [ ] Commit messages in English, imperative mood
