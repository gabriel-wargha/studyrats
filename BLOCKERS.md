# Blockers (night shift 2026-11-26)

- All build tasks in PLAN.md (B1-B17, F1-F11) are already ticked. Only the "Human" step remains, so there was nothing to build and the branch has no diff from main. No pull request was opened.
- Lint, `tsc --noEmit` and `npm test` (188 tests) pass. `next build` compiles and generates all routes, but then exits 1: the Next.js 16.4.4 CLI reports a known security advisory ("SecurityFatalError") and stops. Running `next upgrade` was not done, because nobody approved a dependency upgrade. A human should decide whether to bump Next.js.
- Open questions in PLAN.md section 13 keep their defaults.
