# StudyRats v1: Architecture and Build Plan

A social study tracker for BYU-Idaho students. Log study time with a timer, earn 1 point per minute, and compete on group leaderboards.

---

## 1. Scope

**In v1 (ship in 3 to 4 days)**
- Sign up and log in with email and password (Neon Auth).
- Create a group (type `friends` or `class`), or join one with an invite code or link.
- Built-in study timer (start and stop) with an optional subject and an optional photo of your notes (private bucket `photos`).
- 1 point per full study minute.
- Group leaderboard for this week and for all time.
- Group feed of recent check-ins (finished sessions). Members can react.
- Installable PWA, mobile first.

**Not in v1:** other metrics (questions, tasks), streaks, badges, notifications (including push), native app, manual or edited time entries, group admin tools (kick, rename, regenerate code), comments, offline logging.

---

## 2. Current repo state

- Next.js 16.4.4, React 19.3, Tailwind 4, ESLint 9. Only the Create Next App files exist (`app/layout.tsx`, `app/page.tsx`).
- `next.config.ts` turns on `cacheComponents: true`. This affects how we write pages (see 3.6).
- There is no `neon.ts`, no Drizzle, no auth, no Vitest, and no `test` script yet.
- `.github/workflows/nightly-ship.yml` runs the agent team every night with **no database or storage secrets**. So `npm test` and `npm run build` must pass without any env vars, and migrations can be generated at night but never applied.

---

## 3. Architecture

### 3.1 Overview

```
Phone (PWA) ──> Next.js on Vercel
                 ├─ Server Components (reads, after an auth and membership check)
                 ├─ Server Actions (all writes)
                 ├─ Route handlers (only 2: auth handler, photo redirect)
                 └─ proxy.ts (fast redirect to sign-in only, not a security check)
                       │
         ┌─────────────┼──────────────────┐
     Neon Auth      Neon Postgres       Neon Object Storage
  (Better Auth)    (Drizzle, pooled)    (S3 API, private bucket "photos")
```

### 3.2 Key decisions

| Decision | Choice | Why | Alternative |
|---|---|---|---|
| Writes | **Server Actions** | Fewer files, typed end to end, works with forms. | REST API routes. More code, and we have no other client. |
| Reads | **Server Components** that call query functions in `lib/queries/*` | No client data-fetching library and no loading waterfalls. | SWR or React Query plus API routes. Not needed for v1. |
| Route handlers | Only `/api/auth/[...path]` (Neon Auth) and `/api/photos/[sessionId]` (photo redirect) | Each needs a real URL. | n/a |
| DB driver | `drizzle-orm/neon-http` + `@neondatabase/serverless` on `DATABASE_URL` (pooled) | Stateless HTTP fits Vercel functions. `db.batch()` covers our few multi-statement writes. | `neon-serverless` WebSocket Pool for interactive transactions. Not needed. |
| Migrations | `drizzle-kit generate` (SQL files checked in). A human runs `drizzle-kit migrate` with `DATABASE_URL_UNPOOLED`. | Generating needs no DB, so the night shift can do it. Applying stays a human step. | `drizzle-kit push`. Leaves no history and is risky in prod. |
| User data | Our own `profiles` table keyed by the Neon Auth user id (text). Created on first sign-in (`ensureProfile`). | We don't depend on the managed `neon_auth` schema, and we control the display name. | Join `neon_auth.user` directly. Less code, but couples us to a managed schema. |
| Sessions vs groups | A study session belongs to the **user**, not a group. It shows up in every group the user belongs to, but only if it ended **after the user joined that group**. | One timer and no "post to which group?" step. The join-date rule keeps old history private from new groups and keeps all-time scores fair. | A `session_groups` table so users pick groups per post (GymRats style). More UI and more queries. |
| Timer authority | The **server clock** (`now()` in Postgres) sets `started_at` and `ended_at`. The client only displays elapsed time. | Can't be cheated by changing the phone clock, and survives reloads and phone sleep. | Client sends a duration. Easy to fake. |
| Points | Not stored. `minutes` is stored, and points = `sum(minutes)`, defined in one function `pointsForMinutes`. | One source of truth. If the rule changes, nothing needs backfilling. | A separate `points` column. Redundant. |
| Photo serving | `/api/photos/[sessionId]` checks membership, then sends a 302 to a presigned GET URL valid for 5 minutes. `Cache-Control: private, max-age=240`. | `<img src>` stays stable and short. Every view is authorized. The bucket stays private. | Put presigned URLs straight into the HTML. Works, but URLs expire inside cached pages. |
| Photo upload | Browser PUTs directly to storage with a presigned PUT URL. The server then confirms the upload. | Large files don't pass through Vercel's ~4.5 MB body limit. | Upload through a server action. Hits the limit on phone photos. |
| PWA | `app/manifest.ts` (built in) plus a small hand-written `public/sw.js` | No plugin. `next-pwa`-style plugins are a poor fit with Turbopack. | Serwist or next-pwa. More setup than we need. |
| Validation | `zod` on every server action input | Boring and well known. | Hand-written checks. |
| Time zone | `@date-fns/tz` + `date-fns` for week boundaries | Handles DST correctly and is easy to unit test. | Raw SQL `AT TIME ZONE` math. Correct, but hard to test without a DB. |

### 3.3 Neon Auth (Managed Better Auth)

- One file, `lib/auth/server.ts`, wraps the Neon Auth Next.js SDK. No other file imports the SDK. It exports:
  - `getSessionUser(): Promise<{ id, email, name } | null>`
  - `requireUser(): Promise<User>`. Redirects to `/sign-in?next=...` when logged out.
- `lib/auth/client.ts` wraps the client SDK (sign-in, sign-up, sign-out).
- `app/api/auth/[...path]/route.ts` mounts the SDK's handler.
- `proxy.ts` (Next 16's name for middleware) sends users with no session cookie to `/sign-in`, for app routes only. It is a convenience. **The real check is always `requireUser()` on the server.**
- Uses `NEON_AUTH_BASE_URL` and `NEON_AUTH_COOKIE_SECRET`, both read lazily (see section 9).
- Email verification is off for v1 (open question in section 12).

### 3.4 Lakebase Postgres + Drizzle

- `lib/db/schema.ts` holds the tables (section 4). `lib/db/index.ts` exports `getDb()`, which builds the client on first call and throws `MissingEnvError('DATABASE_URL')` if the variable is missing. **No top-level `process.env` reads anywhere.**
- `drizzle.config.ts` reads `DATABASE_URL_UNPOOLED` (needed only for `migrate`). The `migrations/` folder is checked in.

### 3.5 Neon Object Storage

- `neon.ts` declares Postgres, Auth and a **private** bucket `photos`, plus CORS that allows `PUT` from the app origins (localhost and the Vercel domains), if `neon.ts` supports it. A human runs `neon deploy` after any change.
- `lib/storage.ts` uses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`, created lazily. The SDK reads `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3` and `AWS_REGION` from the environment. Exports `presignPut(key, contentType)`, `presignGet(key)`, `headObject(key)` and `deleteObject(key)`.

### 3.6 Next 16 `cacheComponents` rules for this app

- Every authenticated page reads cookies, so it is dynamic. Put the dynamic part (anything that calls `requireUser` or a query) inside `<Suspense>` with a skeleton fallback. Otherwise `next build` fails with an "uncached data outside Suspense" error.
- Do **not** use `"use cache"` on per-user or per-group data in v1. Only static shells (landing page, manifest) are cached.
- After each server action, call `revalidatePath` (or `refresh`) for the affected group pages.

---

## 4. Data model (Drizzle, Postgres)

All timestamps are `timestamptz`. Ids are `uuid default gen_random_uuid()`, except user ids, which are `text` from Neon Auth.

**`profiles`**
| column | type | notes |
|---|---|---|
| user_id | text PK | Neon Auth user id. No FK across the managed schema. |
| display_name | text not null | check 1 to 40 chars. Defaults to the auth name or the email local part. |
| created_at | timestamptz not null default now() | |

**`groups`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text not null | check 1 to 40 chars |
| type | pgEnum `group_type` ('friends','class') not null | |
| invite_code | text not null **unique** | 8 chars of Crockford base32, uppercase, no I/L/O/U |
| created_by | text not null → profiles.user_id | |
| created_at | timestamptz not null default now() | |

**`memberships`**
| column | type | notes |
|---|---|---|
| group_id | uuid → groups.id on delete cascade | |
| user_id | text → profiles.user_id on delete cascade | |
| role | pgEnum `member_role` ('owner','member') not null default 'member' | |
| joined_at | timestamptz not null default now() | |
| | **PK (group_id, user_id)** | Joining twice does nothing. |
| | index (user_id) | "my groups" and authorization lookups |

**`study_sessions`**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | text not null → profiles.user_id on delete cascade | |
| subject | text null | check up to 60 chars, trimmed, empty becomes null |
| started_at | timestamptz not null default now() | set by the server |
| ended_at | timestamptz null | null means the session is running |
| minutes | integer null | set on stop. check `minutes between 0 and 360` |
| photo_key | text null **unique** | object key in `photos` |
| created_at | timestamptz not null default now() | |
| | check `(ended_at is null) = (minutes is null)` | |
| | check `ended_at is null or ended_at >= started_at` | |
| | **unique partial index (user_id) where ended_at is null** | At most one running timer per user. Enforced by the DB, so double taps are safe. |
| | index (user_id, ended_at desc) | feed, leaderboard, "my sessions" |

**`reactions`**
| column | type | notes |
|---|---|---|
| session_id | uuid → study_sessions.id on delete cascade | |
| user_id | text → profiles.user_id on delete cascade | |
| kind | pgEnum `reaction_kind` ('fire','clap','brain','muscle') | Shown as emoji in the UI. A fixed set means no free-text moderation. |
| created_at | timestamptz not null default now() | |
| | **PK (session_id, user_id, kind)** | Tapping again removes the reaction (toggle). |

A reaction belongs to a session, not a group. If the reactor and the author share two groups, the reaction shows in both. That is fine for v1.

---

## 5. Points and leaderboards

- **Minutes:** on stop, `minutes = least(floor(extract(epoch from (now() - started_at)) / 60), 360)`, all computed in SQL in one `UPDATE ... RETURNING`.
  - Sessions under 1 minute are **deleted** on stop (and any photo is deleted too). The user sees "Too short to count".
  - Sessions are capped at **360 minutes (6 h)** so a forgotten timer can't win the week. The UI says "Capped at 6 hours" when that happens.
- **Points:** `points = minutes`, through `pointsForMinutes(m) = m` in `lib/points.ts` (unit tested).
- **"This week":** Monday 00:00 to next Monday 00:00 in **America/Boise** (Rexburg is on Mountain Time). `lib/week.ts` exports `currentWeekRange(now = new Date()): { start: Date; end: Date }` using `TZDate` + `startOfWeek({ weekStartsOn: 1 })`. Unit tests cover the DST changeovers (March and November).
- **Which week a session counts in:** decided by `ended_at`. A session that crosses midnight Sunday counts in full for the week it ended.
- **Leaderboard query** (`getLeaderboard(ctx, range: 'week' | 'all')`):
  ```
  from memberships m
  join profiles p on p.user_id = m.user_id
  left join study_sessions s
    on s.user_id = m.user_id
   and s.ended_at is not null
   and s.ended_at >= m.joined_at
   [and s.ended_at >= :weekStart and s.ended_at < :weekEnd]
  where m.group_id = :groupId
  group by m.user_id, p.display_name
  order by coalesce(sum(s.minutes),0) desc, p.display_name asc
  ```
  Every member appears, including those with 0 points. Ranks are assigned in TS, and ties share a rank. No caching or materialized views. Groups are small (< 200 members).
- **Feed query** (`getFeed(ctx, cursor?)`): finished sessions by group members with `ended_at >= m.joined_at`. Ordered by `(ended_at desc, id desc)`, 20 per page, keyset cursor. Includes display name, subject, minutes, a `hasPhoto` flag, reaction counts per kind, and which kinds I have used.

---

## 6. Authorization (users only see their own groups)

All of this lives in `lib/authz.ts`:

- `requireUser()`. Returns the signed-in user or redirects.
- `requireMember(groupId): Promise<GroupCtx>`. Calls `requireUser()`, checks that `groupId` is a valid UUID, then looks up `memberships (group_id, user_id)`. If there is no row it calls **`notFound()`** (a 404, so we don't reveal whether the group exists).
- `GroupCtx` is a **branded type**, `{ userId; groupId; role } & { __brand: 'GroupCtx' }`. Only `requireMember` can create one.
- **Rule:** every query in `lib/queries/*.ts` that touches group data takes a `GroupCtx` as its first argument, never a bare `groupId`. Forgetting the check then becomes a **type error**, not a security bug. Queries filter by `ctx.groupId` and join through `memberships`.
- Session-level checks:
  - Stop a session, attach a photo, delete a photo: `where id = :id and user_id = ctx.userId`.
  - React, or view a photo: `canSeeSession(userId, sessionId)` returns true only if the viewer and the session owner share a group **and** the session ended after the owner joined that group. The same SQL predicate is used by the feed.
- Every server action starts with `requireUser()` or `requireMember()`, then a zod parse. Never trust ids from the client without one of these checks.
- Tests: `requireMember` 404s for non-members. `canSeeSession` returns false across groups (with a mocked DB). A lint-style test greps `lib/queries/` and fails if an exported function lacks a `ctx: GroupCtx` or explicit `userId` parameter.

---

## 7. Photo upload and viewing

**Upload (photo is optional; can be added while the timer runs or on the "session done" screen):**
1. The client picks an image with `<input type="file" accept="image/*" capture="environment">`.
2. The client resizes it to at most 1600 px on the long edge and re-encodes as JPEG (quality about 0.8) on a canvas. That's usually under 500 KB, and it strips EXIF and location data.
3. Server action `createPhotoUpload(sessionId)`: checks the user owns the session, then builds the key `u/{userId}/s/{sessionId}/{uuid}.jpg` and returns `{ key, url: presignPut(key, 'image/jpeg') }` (expires in 5 minutes).
4. The client `PUT`s the blob to the URL with `Content-Type: image/jpeg`.
5. Server action `attachPhoto(sessionId, key)`: checks ownership, checks the key starts with `u/{userId}/s/{sessionId}/`, and calls `headObject` to confirm the object exists and is no more than **5 MB** (deletes it if larger). Then it sets `photo_key`. If the session already had a photo, the old object is deleted (one photo per session).

**Viewing:** the feed renders `<img src="/api/photos/{sessionId}">`. The route handler calls `requireUser()` and `canSeeSession()`, returns a 404 on failure, and otherwise sends a 302 to `presignGet(photo_key)` (expires in 5 minutes). Nothing in `photos` is ever public.

**Cleanup:** deleting a too-short session deletes its object. Orphaned uploads (presigned but never attached) are accepted in v1 (see Risks).

---

## 8. Pages and screens (mobile first)

The layout is one column, max width about 480 px, centred, with a bottom tab bar (Groups, **Study**, Me) and large touch targets. Tailwind only, no component library.

| Route | Screen | Notes |
|---|---|---|
| `/` | Landing | Static. "Study together" pitch, Sign up and Log in buttons. Signed-in users are redirected to `/groups` by `proxy.ts`. |
| `/sign-up`, `/sign-in` | Auth forms | Email and password. Honour `?next=`. |
| `/groups` | My groups | List with name, type badge, my weekly points. Buttons for Create and Join. Empty state for new users. |
| `/groups/new` | Create group | Name plus a friends/class toggle. Goes to the group's invite screen. |
| `/join` | Enter invite code | Code input (case-insensitive). |
| `/join/[code]` | Join confirm | Shows group name, type and member count. Join button. Logged-out users go to sign-in and come back. |
| `/groups/[groupId]` | Feed (default tab) | Check-in cards: avatar initial, name, subject, minutes or points, photo, time ago, reaction bar. "Load more" button. |
| `/groups/[groupId]/leaderboard` | Leaderboard | `?range=week` (default) or `all` segmented control. Rank, name, points. My row highlighted. |
| `/groups/[groupId]/invite` | Invite and members | Big code, "Copy link" and "Share" (Web Share API), members list. |
| `/study` | Timer | Idle: subject input (with a datalist of my recent subjects) and a big Start button. Running: large elapsed clock, subject, "Add photo", Stop. Done: minutes earned, add or replace photo, "See feed". |
| `/me` | Profile | Display name edit, my total and weekly points, my last 20 sessions, sign out. |
| `/offline` | Offline fallback | Served by the service worker. |

Group pages share `app/groups/[groupId]/layout.tsx`, which calls `requireMember` and shows the group header and the Feed / Leaderboard / Invite tabs.

**Server actions** (in `app/actions/`): `createGroup`, `joinGroup`, `startSession`, `stopSession`, `updateSubject`, `createPhotoUpload`, `attachPhoto`, `toggleReaction`, `updateDisplayName`.

---

## 9. PWA

- `app/manifest.ts` with name "StudyRats", `short_name`, `start_url: "/groups"`, `scope: "/"`, `display: "standalone"`, theme and background colours, and icons at 192, 512 and 512-maskable (PNG in `public/icons/`).
- `apple-touch-icon` and `appleWebApp` metadata in `app/layout.tsx` for iOS.
- `public/sw.js` (scope `/`):
  - Precaches `/offline`, the icons and the manifest.
  - Navigations are network-first and fall back to `/offline`.
  - Static `/_next/static/*` is cache-first.
  - It **never caches `/api/*`, auth routes, or server action POSTs**.
- A `ServiceWorkerRegister` client component registers the worker only when `process.env.NODE_ENV === 'production'`.
- Install prompt: browser default only. No custom prompt UI in v1. The `/me` page shows a short "Add to Home Screen" tip for iOS.

---

## 10. Testing and the "no env vars" rule

- Add `vitest` and `@vitest/coverage-v8`. The script is `"test": "vitest run"`, with `environment: 'node'` and the `@/` alias set to match tsconfig.
- **Lazy env access:** `lib/env.ts` exports `requireEnv(name)`, which throws `MissingEnvError` **when called**, never at import. `getDb()`, `getStorage()` and the auth wrapper call it inside the function body. Importing any module must have no side effects.
- **Build safety:** every DB, auth or storage access runs at request time (dynamic pages inside Suspense, route handlers, actions). Nothing touches them during `next build` prerendering. The landing page, manifest and offline page are static and pure.
- **What we unit test (no DB):**
  - `lib/week.ts` (week bounds, DST, Sunday 23:59 vs Monday 00:00 in Boise)
  - `lib/points.ts`, and the minutes and cap rule as a pure helper `computeMinutes(start, end)`
  - `lib/invite-code.ts` (alphabet, length, normalising user input)
  - zod schemas for every action
  - leaderboard rank assignment (ties)
  - photo key builder and prefix validator
- **What we mock** (with `vi.mock`): `@/lib/db` (a fake `getDb` returning stubbed query results), `@/lib/auth/server` (a fake user or null), `@/lib/storage` (a fake presigner), and `next/navigation` (`redirect` and `notFound` throw sentinel errors). With these, test `requireMember`, `canSeeSession`, the action happy and error paths, and the photo route handler (404 vs 302).
- **Env-free smoke test:** a test that deletes all the env vars above, imports every module under `lib/` and `app/actions/`, and expects no throw.
- Real-DB tests are out of scope for v1. Humans do a manual QA pass against a Neon branch (section 11, Day 4).

---

## 11. Environment variables and human steps

| Var | Used by | Source |
|---|---|---|
| `DATABASE_URL` | app (pooled) | Neon writes it to `.env.local` |
| `DATABASE_URL_UNPOOLED` | `drizzle-kit migrate` | Neon |
| `NEON_AUTH_BASE_URL` | auth wrapper | Neon |
| `NEON_AUTH_COOKIE_SECRET` | auth wrapper | **Added by hand** (e.g. `openssl rand -base64 32`), locally and in Vercel |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` | `lib/storage.ts` | Neon |

Also add a `.env.example` that lists the names only (the agent task creates it).

**Human steps (the night shift cannot do these):**
1. Review `neon.ts` and run `neon deploy` (creates Auth and the private `photos` bucket, with CORS). Repeat after any `neon.ts` change.
2. Add `NEON_AUTH_COOKIE_SECRET` to `.env.local` and to Vercel (Production and Preview).
3. Copy all the env vars into Vercel project settings.
4. Run `npx drizzle-kit migrate` (uses `DATABASE_URL_UNPOOLED`) after each PR that adds files to `migrations/`. Before merging, do it first on a Neon branch.
5. In Neon Auth settings, add the Vercel domains as trusted origins and set the redirect URLs.
6. Manual QA on a real phone (iOS Safari and Android Chrome): sign up, create, join, timer, photo, react, install.

---

## 12. Build plan (ordered checklist)

Each task is small and has an acceptance check. "Checks pass" means `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` all succeed **with no env vars set**. Frontend tasks list the backend tasks they depend on.

### Day 1: Foundations

- [x] **B1 [backend] Tooling.** Add vitest, zod, drizzle-orm, drizzle-kit, @neondatabase/serverless, date-fns, @date-fns/tz, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, and the Neon Auth SDK. Add the `test` script, `vitest.config.ts` and `.env.example`. *Accept:* `npm test` runs (one trivial test) and checks pass.
- [x] **B2 [backend] Lazy env + DB client.** Add `lib/env.ts` (`requireEnv`, `MissingEnvError`), `lib/db/index.ts` (`getDb()`) and `drizzle.config.ts`. *Accept:* a test shows importing does not throw without env, and calling `getDb()` throws `MissingEnvError`.
- [x] **B3 [backend] Schema + first migration.** Write `lib/db/schema.ts` exactly as in section 4 (enums, checks, partial unique index, indexes). Run `drizzle-kit generate` to create `migrations/0000_*.sql`. *Accept:* the SQL contains the partial unique index and the checks, and checks pass.
  - Note: generated `migrations/0000_aromatic_praxagora.sql`, checked by `tests/migration.test.ts`. Constraint names are explicit so DB errors are readable. Drizzle emits the "latest first" index as `DESC NULLS LAST`; running sessions (null `ended_at`) are never read through it, so that is fine.
- [x] **B4 [backend] `neon.ts`.** Declare Postgres, Auth and the private bucket `photos` with PUT CORS for localhost and the Vercel domains. *Accept:* the file type-checks. The PR description reminds the human to run `neon deploy`.
  - Note: `neon.ts` declares `auth: true` and the private bucket `photos` (Postgres is implicit). The installed `@neon/config` (1.10.1) has no bucket CORS option (`BucketDef` only has `access`), so PUT CORS for localhost and the Vercel domains is NOT declared. Until Neon adds it, either set CORS by hand in Neon or use the fallback in section 13 (upload through a server action). **The PR description must remind the human to run `neon deploy`** (and to sort out CORS). Added `@neon/config` as a dependency; no tsconfig or eslint exclusions were needed.
- [ ] **B5 [backend] Auth wiring.** Add `lib/auth/server.ts` (`getSessionUser`, `requireUser`), `lib/auth/client.ts`, `app/api/auth/[...path]/route.ts`, and a `proxy.ts` matcher for `/groups/:path*`, `/study`, `/me` and `/join/:path*`. Add `ensureProfile(user)` (an upsert into `profiles`). *Accept:* unit tests with the SDK mocked, logged-out `requireUser` redirects with `next`, and checks pass.
- [ ] **B6 [backend] Authorization helpers.** `lib/authz.ts`: `requireMember` returning a branded `GroupCtx`, and `canSeeSession`. *Accept:* tests cover member to ctx, non-member to notFound, bad UUID to notFound, and canSeeSession true/false cases.
- [ ] **B7 [backend] Pure domain helpers.** `lib/week.ts`, `lib/points.ts` (`pointsForMinutes`, `computeMinutes` with the under-1-minute and 360 cap rules), `lib/invite-code.ts`, and `lib/ranking.ts` (ties). *Accept:* unit tests, including the DST weeks of Mar 2027 and Nov 2026.
- [ ] **F1 [frontend] App shell.** Replace the CNA page and layout: metadata "StudyRats", a mobile container, a bottom tab bar (Groups, Study, Me), and a static landing page at `/`. *Accept:* the build output shows `/` as static, and the page looks right at 375 px wide. *Depends:* none.
- [ ] **F2 [frontend] Sign-up and sign-in pages.** Forms using `lib/auth/client.ts`, error states, and `?next=` redirect. *Depends:* B5. *Accept:* checks pass. The human verifies a real sign-up after deploy.

### Day 2: Groups and the timer

- [ ] **B8 [backend] Group queries + actions.** `getMyGroups(userId)` (with my weekly points), `getGroupHeader(ctx)`, `getMembers(ctx)`, `getGroupByInviteCode(code)` (returns only name, type and member count), and the actions `createGroup` (insert group plus an owner membership with `db.batch`, retrying on an invite-code collision) and `joinGroup` (idempotent). *Accept:* tests with the DB mocked cover zod validation, the owner membership being created, and joining twice doing nothing.
- [ ] **B9 [backend] Session actions.** `getActiveSession(userId)`, `startSession({subject?})` (returns the existing session if one is running, by catching the unique violation), `stopSession(id)` (SQL minutes and cap, deletes sessions under 1 minute plus their photo, returns `{ minutes, capped }`), `updateSubject`, and `getMySessions(userId)` and `getMyRecentSubjects(userId)`. *Accept:* tests cover double start, stopping someone else's session (no rows), and the too-short path.
- [ ] **B10 [backend] Storage + photo actions.** `lib/storage.ts` (lazy), `lib/photo-key.ts`, the actions `createPhotoUpload` and `attachPhoto` (ownership, prefix, headObject size check, replace old photo). *Accept:* tests with storage mocked, including a rejected foreign key prefix and an oversized object.
- [ ] **F3 [frontend] Groups list + create + join.** Screens `/groups`, `/groups/new`, `/join` and `/join/[code]`, with Suspense skeletons and empty states. *Depends:* B8. *Accept:* checks pass, and the flows are wired to the actions.
- [ ] **F4 [frontend] Group layout + invite screen.** `app/groups/[groupId]/layout.tsx` (header and tabs, calls `requireMember`) and `/invite` with copy link, Web Share and the members list. *Depends:* B6, B8.
- [ ] **F5 [frontend] Study timer screen.** `/study` with idle, running and done states. The elapsed clock comes from the server `started_at` plus a server-time offset. It shows the capped and too-short messages. *Depends:* B9.
- [ ] **F6 [frontend] Photo picker.** A client component that resizes to JPEG at most 1600 px, then runs createPhotoUpload, PUT and attachPhoto, with progress and error states, used in the running and done states of `/study`. *Depends:* B10, F5.

### Day 3: Feed, reactions, leaderboard

- [ ] **B11 [backend] Feed query.** `getFeed(ctx, cursor?)` as in section 5, with reaction aggregates and keyset pagination. *Accept:* tests cover the cursor encode/decode and that the query builder uses `ctx.groupId`.
- [ ] **B12 [backend] Reactions.** `toggleReaction({ sessionId, kind })` guarded by `canSeeSession`. *Accept:* tests cover the toggle on and off, and a forbidden session failing.
- [ ] **B13 [backend] Photo route.** `app/api/photos/[sessionId]/route.ts`: requireUser, canSeeSession, then 302 to the presigned GET URL, or a 404. *Accept:* tests cover 404 for a non-member, 404 when there is no photo, and 302 with `Cache-Control: private`.
- [ ] **B14 [backend] Leaderboard query.** `getLeaderboard(ctx, 'week' | 'all')` using `currentWeekRange` and the joined_at rule, ranked with `lib/ranking.ts`. *Accept:* tests cover the range parameters and the zero-point members being included (ranking unit-tested).
- [ ] **B15 [backend] Profile.** `updateDisplayName` and `getMyStats(userId)` (week and all-time). *Accept:* zod tests.
- [ ] **F7 [frontend] Feed screen.** `/groups/[groupId]` with check-in cards, lazy-loaded photos (`loading="lazy"` on the `/api/photos/...` URL), a reaction bar with optimistic toggle (`useOptimistic`), and "Load more". *Depends:* B11, B12, B13, F4.
- [ ] **F8 [frontend] Leaderboard screen.** Week/all segmented control via `?range=`, with my row highlighted. *Depends:* B14, F4.
- [ ] **F9 [frontend] Me screen.** Display name edit, stats, recent sessions, sign out, and the iOS install tip. *Depends:* B9, B15.

### Day 4: PWA, hardening, ship

- [ ] **B16 [backend] Env-free smoke test + authz guard test.** Import all of `lib/**` and `app/actions/**` with env cleared. Add the grep test that every `lib/queries` export takes a `GroupCtx` or `userId`. *Accept:* both tests pass.
- [ ] **F10 [frontend] PWA.** `app/manifest.ts`, icons (192, 512, maskable), Apple meta tags, `public/sw.js`, `/offline`, and the production-only register component. *Accept:* the build passes, and the Lighthouse "installable" check passes on a preview deploy (human check).
- [ ] **F11 [frontend] Mobile polish.** Safe-area insets, at least 44 px tap targets, loading and error boundaries (`error.tsx`, `not-found.tsx`) for group routes, and dark mode via Tailwind's `dark:`. *Accept:* checks pass, and no horizontal scroll at 360 px.
- [ ] **B17 [backend] README + release notes.** Document the human steps in section 11 and the migration workflow. *Accept:* README updated.
- [ ] **Human:** `neon deploy`, set env vars in Vercel, run the migration, and do the phone QA from section 11.

---

## 13. Open questions and risks

**Open questions (defaults chosen; change them if you disagree)**
1. **Posting to groups:** sessions show in **all** of a user's groups, counting from the join date. Should users pick groups per session (GymRats style)? That matters if a "class" group should not see "friends" activity.
2. **Session cap:** 360 minutes, with sessions under 1 minute discarded. Are these limits right?
3. **Week start:** Monday 00:00 America/Boise. Do students expect a Sunday start?
4. **Email verification:** off in v1. Should sign-up be restricted to `@byui.edu` addresses? It's a cheap domain check in the sign-up flow, but it may block students who use personal email.
5. **Leaving a group** and owner tools (rename, regenerate code, remove member) are left out. Is leaving needed for launch?

**Risks**
- **Neon Auth SDK and `neon.ts` API details** (package names, handler shape, bucket CORS syntax) are newer and less documented than the rest of the stack. To reduce the risk, only `lib/auth/*` and `neon.ts` know these details. B4 and B5 should check against the current Neon docs first.
- **Bucket CORS:** browser PUT uploads fail without it. If `neon.ts` can't set CORS, the fallback is to upload through a server action (the client already shrinks photos to under 1 MB, well within Vercel's body limit).
- **Presigned PUT cannot cap file size.** We check size with `headObject` after upload and delete oversize objects. Orphaned uploads may build up. A cleanup job is post-v1.
- **`cacheComponents` build errors:** a dynamic read outside `<Suspense>` breaks `next build`. Every frontend task must keep data reads inside Suspense boundaries.
- **The night shift cannot run migrations or hit a real DB.** SQL bugs only show up in human QA, so keep queries simple and review migrations in each PR.
- **iOS PWA limits:** no install prompt, and the timer pauses when the app is in the background. The server-side `started_at` makes this harmless, because elapsed time is recomputed on resume.
- **Cheating:** a user can leave the timer running (capped at 6 h). That's acceptable for friendly competition in v1.
