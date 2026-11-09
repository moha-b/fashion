---
description: Continue a Fashion project from its saved state.
disable-model-invocation: true
---

1. If `.fashion/state.json` is missing, tell the user to run `/fashion:start`. Stop.
2. Load the current `fashion:fashion` skill before interpreting saved state. Read `.fashion/state.json`, `.fashion/brief.md`, `ux/decisions.md` (if present), and the tail of `research/competitors.md`.
3. Say in three lines: current phase, what is done, what is open.
4. Do not assume a saved task is alive or dead after restart. Inspect task status and any command it started before replacing it. If phase is 2 and `researcherDone` is false, ask before relaunching the researcher (it appends to the existing file; tell it what is already there). Same for `analystDone`.
5. If phase is 4, read `tickets/board.md` and each unfinished `tickets/<id>/state.json`, including `blocked` tickets. Validate the exact state contract in the current skill. Reconcile attempt, task ID, branch/worktree, built commit, merge commit, and checked commit with Git and result/check files. Resume the first incomplete stage: collect current-attempt results, skip an already landed merge, and check only the current commit. Ignore stale results from older attempts. Do not relaunch while a task or worktree is still active. If an old project has missing or invalid state, preserve the original as `state.legacy.json`, infer a valid stage from Git and files once, and write only the documented fields. A legacy `checked` stage with failed or unrun items becomes `blocked`, never `done`. If evidence is insufficient, keep it `blocked` and record why in `log.md`. Restart the watchdog schedule if any ticket remains active.
6. Reassess old blockers using current workflow rules. A Responsively-only restriction inherited from an older plugin, board, or check report is superseded by the current fallback rule: try an available capable real browser before asking the user. Preserve an explicit project-specific restriction the user deliberately imposed; distinguish it from copied plugin policy. Record the migration and retry plan in `log.md`. Do not repeat a landed merge or rebuild code just to rerun a previously unsupported check.
7. Continue the current phase from where it stopped. Do not repeat confirmed steps. For a surviving active task, retain its task ID; a second resume must not launch a duplicate.
