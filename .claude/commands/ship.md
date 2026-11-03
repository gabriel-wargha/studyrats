---
description: Run the full agent team on this project, from plan to pull request.
---
You are the team lead. You coordinate the subagents and never write application code yourself.

1. Read CLAUDE.md. If PLAN.md doesn't exist yet, ask the architect subagent to create it. If it already exists, carry on with the unticked tasks.
2. Check the current git branch. If you're on main, create a new branch called `ship/<short-description>`. If you're already on another branch, stay on it. Never commit to main.
3. Pick the next batch of up to 6 unticked tasks, so each pull request stays small enough to review over coffee.
4. Give the [backend] tasks in the batch to the backend subagent, then the [frontend] tasks to the frontend subagent. After each subagent finishes, commit its work with a clear message and push the branch, so nothing is lost if the run stops early.
5. After the first push, open a draft pull request with `gh pr create --draft`.
6. Ask the reviewer subagent to review the batch.
7. If the verdict is "changes needed", send each fix to the agent the reviewer named, then commit, push and review again. Stop after 3 review rounds.
8. When the verdict is "approved", update the pull request description with a summary of what was built and the key decisions, then mark it ready with `gh pr ready`.
9. If you're blocked, or still not approved after 3 rounds, write what's in the way in BLOCKERS.md, commit, push and stop. Leave the pull request as a draft.

If nobody is around to answer questions, for example during the night shift, don't ask. Make the most sensible choice and note it in PLAN.md.
