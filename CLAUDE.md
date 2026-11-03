# StudyRats

A social study tracker for BYU-Idaho students, inspired by GymRats.
Students log study sessions, earn points, and compete on group leaderboards.

## Users
BYU-Idaho students who want accountability and a bit of friendly competition.

## Version 1 scope (ship in 3 to 4 days)
- Sign up and log in with email (Neon Auth).
- Create or join a group with an invite code. A group is labelled "friends" or "class".
- Start and stop a built-in study timer, with an optional subject and a photo of your notes (stored in Neon Object Storage, in a private bucket called `photos`).
- 1 point per study minute.
- A group leaderboard for this week and for all time.
- A feed of recent check-ins where group members can react.
- Installable as a PWA.

## Not in version 1
Other metrics (questions, tasks), streaks, badges, notifications, a native app.

## Stack
- Next.js App Router, TypeScript, Tailwind, deployed on Vercel.
- Neon: Lakebase Postgres with Drizzle ORM, Neon Auth (Managed Better Auth) and Neon Object Storage.
- `neon.ts` declares the Neon services. A human runs `neon deploy` after changing it.

## Environment variables
Neon writes these into `.env.local`: DATABASE_URL (pooled, for the app), DATABASE_URL_UNPOOLED (for migrations), NEON_AUTH_BASE_URL, and AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3 and AWS_REGION for storage. NEON_AUTH_COOKIE_SECRET is added by hand.

## Checks
- Lint: `npm run lint`
- Types: `npx next typegen && npx tsc --noEmit` (Next.js 16 generates some types first)
- Tests: `npm test` (Vitest)
- Build: `npm run build`

The tests and the build must pass with no environment variables set, because the night shift runs without secrets.

## Rules
- Mobile first, since students will use it on their phones.
- Users only see the groups they belong to. Check this on the server for every query.
