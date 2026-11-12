# Blockers (night shift 2026-11-12)

All build tasks in PLAN.md (B1-B17, F1-F11) are done and merged to main. The only unticked task is the **Human** one:

- Run `neon deploy` (declares Postgres, Auth and the private `photos` bucket from `neon.ts`).
- Set the env vars in Vercel (DATABASE_URL, DATABASE_URL_UNPOOLED, NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET, AWS_* storage vars).
- Run the migration (`drizzle-kit migrate` with DATABASE_URL_UNPOOLED).
- Do the phone QA from section 11 of PLAN.md.

The night shift has no secrets and cannot do these. No code changes were made tonight.
