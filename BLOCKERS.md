# Blockers (night shift 2026-11-16)

Every build task in PLAN.md (B1-B17, F1-F11) is ticked. The only unticked task is the **Human** one, which the night shift can't do (no secrets, no Neon access):

1. Run `neon deploy` (creates the Postgres, Auth and private `photos` bucket; set bucket CORS for PUT if `neon.ts` can't).
2. Add `NEON_AUTH_COOKIE_SECRET` and the other env vars in Vercel.
3. Run `npm run db:migrate` with `DATABASE_URL_UNPOOLED` (try a Neon branch first).
4. Add trusted domains in Neon Auth, then do the phone QA from PLAN.md section 11.

No new code was written tonight, so there is nothing to review. Open questions in PLAN.md section 13 keep their defaults.
