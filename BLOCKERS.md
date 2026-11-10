# Blockers (night shift 2026-11-10)

Every build task in PLAN.md (B1-B17, F1-F11) is ticked and merged. The only unticked item is the **Human** task:

- Run `neon deploy`.
- Set env vars in Vercel (including `NEON_AUTH_COOKIE_SECRET`).
- Run `npm run db:migrate` (try it on a Neon branch first).
- Do the phone QA from PLAN.md section 11.

The night shift has no secrets and cannot do these, so no code was changed. See the README for the steps.

Open questions in PLAN.md section 13 keep their defaults.
