<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# StudentHub — Telegram Mini App + Web (Turborepo)

Open-source StudentHub platform — Telegram Mini App + browser web (via Telegram Login Widget) — for university students (curriculum charts, course offerings, diff notifications). **Vercel serverless** (Hono on Bun) + **Postgres is the only infra** (no Redis/MinIO/BullMQ). University data lives in a **git registry** (`packages/registry`), not DB.

**Versions:** mini-app `1.0.0-beta.1` (actively versioned); all **other** workspaces pinned to `1.0.0` (static, never bumped). • **Branch:** `main` • **Migrated from** legacy `4.1.9` Supabase — only `azad-malard / computer-engineering` (uni 1/major 1) kept, 291 profiles, 330 noted, 5676 passed, 98 professor votes. Other universities dropped (users go to `/setup`). See Migration notes below.

## Commands

```bash
docker compose up -d        # Postgres 17 only (5433)
pnpm install
cp .env.example .env        # DATABASE_URL must match POSTGRES_PORT
pnpm --filter @workspace/db generate
pnpm --filter @workspace/db migrate
pnpm --filter @workspace/db studio

pnpm --filter @workspace/db seed:clear              # drop + migrate
pnpm --filter @workspace/db seed:mock-data          # 700000000+ fake ids
pnpm --filter @workspace/db exec tsx ./scripts/migrate-malard.ts  # legacy → local (read-only Supabase pooler)
pnpm --filter @workspace/registry validate
pnpm --filter @workspace/registry build-index
```

## Architecture Decisions (do not undo)

- **Registry over DB:** Universities, majors, degrees, entry-year dirs (`[1400-1401]`/`1402`/`[1403-1405]`), charts, offerings, professors, archives, groups — all JSON in `packages/registry`, validated by CI (`registry.yml` now just `validate` on every push). Year dir detector accepts both range and single names.
- **DB rows reference registry slugs:** `university_profiles`, noted/passed, votes, uploads store `universitySlug/majorSlug` strings; API validates at read time, dangling slugs surface as “chart moved”.
- **Users = Telegram chat ids** (`bigint` PK). Auth: **Mini App** `tma <initData>` (stateless, auto-upsert, `withUser`); **Web** Telegram Login Widget / OIDC (`POST /auth/telegram/widget` → `id_token` or `hash` verified via `SHA256(bot_token)` + `JWKS https://oauth.telegram.org/.well-known/jwks.json` → `aud=app` JWT 30d, `Bearer` + `x-bypass-maintenance` header). `resolveInitData()` falls back to `window.Telegram.WebApp.initData`, `request.ts` sends `tma` or `Bearer`.
- **Notifications resumable + manual:** `completed_offering_diffs` + `notification_batches/messages` (`PENDING`), admin clicks `send-next` per message; never auto-send from CI.
- **Uploads no object storage:** `POST /me/uploads` streams to `TELEGRAM_UPLOADS_CHAT_ID` via `sendDocument`, only `file_id` stored (`uploads` PENDING). Admin PRs `archives.json`.
- **Maintenance gate:** `app_settings.maintenanceMode` cached 30s. `withUser` runs before `maintenanceGate`; if `SUPERADMIN` + `x-bypass-maintenance:1` → pass, else `503 { maintenance:true, canBypass:true }` for superadmins (client shows “ورود به عنوان سوپرادمین” → `sessionStorage.sh_bypass_maintenance=1` + reload). `request.ts` adds header, `server.ts` CORS allows it.
- **Intro/profile gating:** `AppBootstrap` holds splash 600ms, hydrates `/me`, then `localStorage`+`cloudStorage` intro check (`completed-introduce-v2-1` saved to both), `isProfileComplete` (5 fields) → `/welcome` / `/setup` / `/profile` (+ `rd` deep link). Web unauthenticated → `TelegramLoginWidget` (legacy `telegram-widget.js?22` + new `telegram-login.js?6`).

## Packages

- `packages/db` — Drizzle schemas: `users`, `university_profiles` (`bachelors-degree`, `currentSemesterCode=4051`), `noted_courses/passed_courses/failed_courses`, `professor_votes`, `uploads`, `feedback`, `chart_files`, `app_settings` etc. `isContributor` badge, `banned=false` for all after migration, `5725800953=SUPERADMIN`.
- `packages/registry` — `registry/universities/<slug>/majors/<slug>/charts/<degree>/<yearDir>/<semester>.json` + `courses/<year>/<semester>/new.json` + `professors.json` etc. Loader throws `RegistryNotFoundError`; search via `registry/index/*.json`. Generated files (do not hand-edit): `old.json`/`diff.json` (rotated from `new.json` by `scripts/sync-offerings.ts`) and `professors.json` (append-only from `new.json` professor names by `scripts/sync-professors.ts`, unique sequential `prof-<n>` slugs, existing entries never removed).

## Apps

- `apps/api` — Hono, routes `/app/*` + `/me/*` gated by `maintenanceGate`, `/admin/*` (OTP via bot, 1-year `aud=admin` JWT, DB-backed RBAC), `/auth/telegram/*` (`/config`, `/widget`, `/verify`). `GET /me` returns `maintenance` or full profile+offerings+chart+diff in one call.
- `apps/mini-app` — Next 16 (port 3000, `mini-app.student-hub.localhost`), `RootLayout` (Vazirmatn, `metadataBase https://student-hub.ir`, OG `opengraph-image.tsx` dark `#141414` + `reshapePersian` + logo, `sitemap/robots/manifest`), `AppBootstrap` (web widget → welcome → setup → profile), `lib/request` + `lib/auth/web-token` + `components/auth/telegram-login-widget`.
- `apps/admin` — Next 3002, velin kit, OTP, `hooks/use-users` infinite, `UserCard` memo includes `isContributor` + `onRoleChanged→refetch` for reactive badge, `PATCH /users/:id/contributor` sends `تبریک شما نماد مشارکت کننده دریافت کردید.`
- `apps/extension` — WXT MV3 `assets/icon.svg` → `public/icons/icon-*.png`, activeTab, worker re-inject, `chrome.storage.local`, `courses/<year>/<semester>/new.json` export, Jalali preselect. Extraction flow (documented in CONTRIBUTING.md): آموزشیار courses page via «صفحه دروس نیست؟» popup → raise search limit 10→100 → «استخراج از همه صفحات» walks pages; oversized results must be split main-courses then Moaref-only, merged with «ادامه».
- `apps/chart-builder` — Next 3001, `charts/<degree>/<yearDir>/…` editor (normal/advanced), `chartDocSchema` validation, localStorage profiles.

## Registry Layout (do not deviate)

```
packages/registry/registry/
  universities/<uni>/               # slug: azad-* / gov-* / pnu-* , permanent
    university.json
    majors/<major>/                 # slug: computer-engineering
      major.json                    # degrees: [bachelors-degree]
      charts/<degree>/[1400-1401]/mehr.json | 1402/meh.. | [1403-1405]/both.json
      charts/<degree>/1405/bahman.json
      courses/1404/mehr/new.json    # only new.json, CI rotates to old.json on main (now disabled)
      professors.json
      archives.json
      groups.json
  index/*.json                      # GENERATED — never edit
```

- Year dirs: `[1403-1404]` or `1405` — detector `src/year-dir.ts`, reversed rejected.
- Chart files: `mehr|bahman|summer|both.json` (lowercase), `both.json` covers MEHR+BAHMAN.
- Offerings: `courses/<year>/<semester>/new.json` only.
- Validate: `pnpm --filter @workspace/registry validate`; CI is now `push` validate only (no rotate).

## Migration Notes (4.1.9 → 1.0.0-beta.0)

Source `DB_URL` = Supabase pooler `qprhvhahqruacesgpjfm` (read-only). Filtered to `universities_user_profile` `university_id=1 AND major_id=1` (Malard Computer, 291/1167). Others deleted → setup. Mapping: `degree 1..4 → bachelors-degree`, `entry_year 400/401→[1400-1401], 402→1402, 403+→[1403-1405]` via junction `universities_entry_year` (9->[1400-1401] etc), `gender/term_number` kept, `currentSemesterCode=4051`, `isLastTerm=false`, `users.date_joined→createdAt`, `banned=false`, `role: 5725800953=SUPERADMIN`. Passed `year` normalized (`400 و ما قبل→1400`), noted `year/semester` null (old had no term pin). Script `packages/db/scripts/migrate-malard.ts` + `seed:clear` → local `5433/studenthub`.
