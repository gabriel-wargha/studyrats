# Blockers (night shift 2026-11-18)

All agent tasks (B1-B17, F1-F11) in PLAN.md are ticked. The only unticked item is **Human**:

- Run `neon deploy`.
- Set env vars in Vercel (including `NEON_AUTH_COOKIE_SECRET`).
- Run the migration with `npm run db:migrate` (`DATABASE_URL_UNPOOLED`).
- Add bucket CORS manually if `neon.ts` can't set it.
- Do the phone QA from PLAN.md section 11.

Nothing is left for the backend or frontend agents, so there is nothing to build or review. The PR stays a draft.
