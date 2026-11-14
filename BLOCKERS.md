# Blockers (night shift 2026-11-14)

No unticked tasks are left in PLAN.md except the **Human** task, so there is nothing to build.

What a human needs to do (see README.md and PLAN.md section 11):
- Run `neon deploy`.
- Set the env vars in Vercel, including `NEON_AUTH_COOKIE_SECRET`.
- Run `npm run db:migrate` with `DATABASE_URL_UNPOOLED`.
- Add trusted domains in Neon Auth.
- Do the phone QA.

The open questions in PLAN.md section 13 keep their defaults.
