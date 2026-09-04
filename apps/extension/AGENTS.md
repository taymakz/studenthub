# apps/extension — StudentHub Scraper (WXT MV3)

Extracts course offerings from Iranian university portals (آموزشیار, گلستان, …) and exports registry-ready `courses/<year>/<semester>/new.json`. Browser-extension only (no backend): everything runs in the popup, background worker, and injected scripts.

## Commands

```bash
pnpm --filter @workspace/extension build       # wxt zip + rename -> .output/extention/ + .output/extention-<ver>.zip
pnpm --filter @workspace/extension typecheck   # wxt prepare && tsc --noEmit (must stay clean)
pnpm --filter @workspace/extension icons       # regenerate PNG icons from assets/icon.svg
npx vitest run apps/extension/                 # tests (run from repo root)
npx react-doctor@latest --verbose              # must stay 100/100 (run in apps/extension)
```

## Architecture Decisions (do not undo)

- **Injected functions are self-contained.** `chrome.scripting.executeScript({ func })` serializes `func.toString()` — after minification, references to module-scope bindings break. Every function passed to `executeScript` (`scrape`, `readPaging`, `navigateNext/Prev`, `replaceMenu`) must inline ALL of its helpers, even if identical helpers exist elsewhere. Do not "deduplicate" them into imports.
- **Adapter registry, first match wins.** `src/universities/index.ts` — `golestan` → `azad` → `generic` fallback (generic reuses the azad scraper). Detection is URL-regex based.
- **Two pagination workflows** (`src/lib/extractor.ts`): adapters with `navigateNext` use the frame-based loop (Golestan: nested iframes, ASP.NET postbacks, no page counter — always rewind to page 1 first); everything else uses the full-page-reload loop with `nextPageSelector`/`prevPageSelector` and a `ركورد X تا Y از Z` paging bar.
- **Progress without a counter.** Portals that render no page total get an honest one-page-ahead estimate (`page / (page + 1)`) plus a final 100% tick before `EXTRACTION_DONE`.
- **Numeric parsing is hardened.** Persian/Arabic digits, unicode slash decimals (`۰/۵`, `⁄`, `∕`, `／`, `٫`) and zero-width characters (ZWSP/ZWNJ/bidi) must all normalize — see `toFloat`/`toInt` in the scrapers. Golestan unit columns are resolved dynamically from the header grid (`كل` = total, `ع` = practical; theoretical = total − practical).
- **React Doctor 100/100.** `doctor.config.json` ignores ONLY the generated `.output/**` build artifacts (React internals in bundles trigger crypto false positives). Never disable rules or add inline suppressions for real source findings.
- **Output contract.** Build produces exactly `.output/extention/` (loadable unpacked dir) + `.output/extention-<version>.zip` (release artifact) via `scripts/post-build.mjs` (rename, not copy).

## Adding a New University Portal

### Step 1 — Ask the user for HTML (do this FIRST, before writing any code)

Request **pure HTML** — screenshots and copied text are NOT acceptable (unit values, invisible characters, and column order get lost). Ask the user to send:

> Open your university's course-offering list page (دروس ارائه شده / لیست کلاس‌ها), then:
>
> 1. Right-click the **courses table** → Inspect → in DevTools right-click the `<table>` element → **Copy → Copy outerHTML**. Send the full table HTML from **each** of these pages:
>    - **first page**
>    - **second page**
>    - **last page**
>    - **last-1 page** (second to last)
> 2. Right-click the **pagination section** (the next/previous page buttons و اعداد صفحات) → Inspect → Copy → **Copy outerHTML**, and send that block too.
> 3. If the page uses iframes/framesets (e.g. Golestan), open the relevant frame directly or copy each frame's outerHTML and label which frame it came from.

You need all of them: first page establishes headers/columns, second page confirms stability across pages, and last / last-1 pages reveal the end-of-data signals (disabled buttons, page counters, short final rows) that pagination logic depends on.

### Step 2 — Save fixtures and write tests BEFORE porting to a scraper

- Store the samples verbatim as fixtures: `tests/fixtures/<university>/page-1.html`, `page-2.html`, `last.html`, `last-1.html`, `pager.html`. Never "clean up" the HTML — the quirks ARE the test.
- Write tests that parse those fixtures and assert the extracted fields (`index`, `courseCode`, `courseName`, `theoreticalUnits`, `practicalUnits`, `maxCapacity`, `currentEnrollment`, `classSchedule`, `examSchedule`, `professor`, `location`) plus pagination (`hasNext`/`hasPrev` on every page).

### Step 3 — Reuse and improve utils

- **Reuse existing utils wherever possible**: the Persian text helpers (`unifyPersian`, `cleanText`, `toEnglishDigits`, `toInt`, `toFloat`), the fuzzy header-alias matching in `azad/scrape.ts`, the header grid walk (rowspan/colspan-aware `كل`/`ع` resolution) in `golestan/scrape.ts`, and the schedule regexes covered by `tests/schedule.test.ts`.
- If a needed helper does not exist, create it as a **shared, reusable module** (e.g. `src/lib/parse.ts`) designed for ANY university: config-driven (aliases, code separators, column fallbacks), not hardcoded to one portal — then use it in tests and in any non-injected code.
- If an existing similar util almost fits, **improve it in place** so it generalizes to the new portal instead of forking a copy. Keep behavior of existing adapters intact (their tests must still pass).
- Remember the injection constraint: a scraper's injected copy of a helper must stay inline (see Architecture Decisions), but its logic should mirror the shared util so tests exercise the same behavior.

### Step 4 — Port to an adapter

- Add `src/universities/<id>/index.ts` + `scrape.ts` following `azad` or `golestan` as the template; implement `scrape`, `readPaging`, and either `navigateNext`/`navigatePrev` (frame-based) or `nextPageSelector`/`prevPageSelector` (full reload).
- Register it in `src/universities/index.ts` **before** the generic fallback, with a `detect` regex over real portal URLs.

### Step 5 — Verify

```bash
pnpm --filter @workspace/extension typecheck
npx vitest run apps/extension/
npx react-doctor@latest --verbose   # in apps/extension, expect 100/100
pnpm --filter @workspace/extension build   # .output/extention/ + zip only
```

Then load `.output/extention/` as an unpacked extension and dry-run one extraction against the live portal before opening a PR.
