# StudyRats

A social study tracker for BYU-Idaho students. Log study sessions with a built-in timer, earn 1 point per minute, and compete on group leaderboards.

Stack: Next.js (App Router, TypeScript, Tailwind) on Vercel, with Neon Lakebase Postgres (Drizzle ORM), Neon Auth and Neon Object Storage. See `CLAUDE.md` for scope and `PLAN.md` for the architecture and build plan.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Checks (all of them pass with no environment variables set):

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

## Environment variables

`.env.example` lists the names only. Never commit real values.

| Variable | Used by | Where it comes from |
|---|---|---|
| `DATABASE_URL` | the app (pooled connection) | Neon, written to `.env.local` |
| `DATABASE_URL_UNPOOLED` | `drizzle-kit migrate` (direct connection) | Neon |
| `NEON_AUTH_BASE_URL` | Neon Auth wrapper | Neon |
| `NEON_AUTH_COOKIE_SECRET` | Neon Auth wrapper | **Added by hand**, at least 32 characters |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` | Object Storage (`lib/storage.ts`) | Neon |

Generate the cookie secret yourself:

```bash
openssl rand -base64 32
```

Neon does not create `NEON_AUTH_COOKIE_SECRET`. Add it to `.env.local` and to Vercel (Production and Preview).

## Human steps (first deploy and after changes)

The automated night shift has no secrets and does not touch the Neon project, so a person does these steps.

1. **Deploy the Neon services.** Review `neon.ts`, then run `neon deploy`. This creates Neon Auth and the private `photos` bucket. Run it again after any change to `neon.ts`. Then run `neon env pull` to write the values into `.env.local`.
   - Known gap: `@neon/config` cannot declare bucket CORS yet. The browser uploads photos with a PUT to a presigned URL, so set CORS on the `photos` bucket by hand in Neon for `http://localhost:3000` and your Vercel domains. Without it, photo upload fails with "Upload failed". See PLAN.md section 13 for the fallback.
2. **Add the cookie secret.** Put `NEON_AUTH_COOKIE_SECRET` in `.env.local` and in Vercel (see above).
3. **Set up Vercel.** Import the repo as a Next.js project. In Project Settings, Environment Variables, add every variable from the table for Production and Preview: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, and the four `AWS_*` variables. Redeploy after changing them.
4. **Run migrations** (see the next section). Do this before the first real use, because the tables do not exist until it runs.
5. **Trust the Vercel domains in Neon Auth.** In Neon Auth settings, add your production and preview Vercel origins (with `https://`, no trailing slash) as trusted domains and set the redirect URLs. The CLI equivalent is `neon neon-auth domain add https://your-app.vercel.app`. Without this, sign-in fails with `invalid domain`. Localhost is trusted by default.
6. **Phone QA.** On a real phone, on both iOS Safari and Android Chrome, check the full path: sign up, create a group, join it with the invite code (from a second account), start and stop the timer, add a photo, react to a check-in, check the leaderboard, and install the app to the home screen. Also check the SQL-heavy screens (feed, leaderboard, stats) against real data on a Neon branch, because the unit tests mock the database.

## Database migrations

The schema lives in `lib/db/schema.ts` (Drizzle). Migrations are generated SQL files in `migrations/`. Never change the database by hand.

Workflow:

1. **Generate (at night, by the agent or a developer).** Edit `lib/db/schema.ts`, then run:

   ```bash
   npm run db:generate
   ```

   This writes a new file to `migrations/` and needs no database connection. Review the SQL and commit it with the schema change. The agent never applies migrations.
2. **Apply (by a human, after review).** Migrations run over the direct connection, `DATABASE_URL_UNPOOLED`, never the pooled `DATABASE_URL`. The pooled connection goes through PgBouncer and can break migrations in confusing ways. `drizzle.config.ts` already reads `DATABASE_URL_UNPOOLED`.

   ```bash
   # with DATABASE_URL_UNPOOLED set in .env.local or your shell
   npm run db:migrate
   ```

3. **Try it on a branch first.** Before merging a PR that adds files to `migrations/`, create a Neon branch of production, point `DATABASE_URL_UNPOOLED` at it, run `npm run db:migrate`, and click through the app. Then run the same command against production.

Apply the migration before (or together with) deploying the code that needs it. Run `npm run db:migrate` once after every PR that adds a file to `migrations/`.

## Project layout

- `app/` routes, pages and thin server actions
- `server/` the real logic as plain functions (reusable by a future mobile app or API)
- `lib/` helpers, DB schema and queries, auth and storage clients (created lazily, so the build works with no env vars)
- `tests/` Vitest tests (database, auth and storage are mocked)
- `migrations/` generated Drizzle SQL
- `neon.ts` Neon services (Auth and the `photos` bucket)
