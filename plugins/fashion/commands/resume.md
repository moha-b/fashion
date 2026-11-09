---
description: Continue a Fashion project from its saved state.
disable-model-invocation: true
---

1. If `.fashion/state.json` is missing, tell the user to run `/fashion:start`. Stop.
2. Read `.fashion/state.json`, `.fashion/brief.md`, `ux/decisions.md` (if present), and the tail of `research/competitors.md`.
3. Say in three lines: current phase, what is done, what is open.
4. Background agents do not survive a restart. If phase is 2 and `researcherDone` is false, ask before relaunching the researcher (it appends to the existing file; tell it what is already there). Same for `analystDone`.
5. If phase is 4, read `tickets/board.md` and each active `tickets/<id>/state.json`. Reconcile attempt, task ID, branch/worktree, built commit, merge commit, and checked commit with Git and result/check files. Resume the first incomplete stage: collect current-attempt results, skip an already landed merge, and check only the current commit. Ignore stale results from older attempts. Do not relaunch while a task or worktree is still active. If an old project has no per-ticket state, infer the stage from Git and files once, write state, then continue. Restart the watchdog schedule if any ticket remains active.
6. Load the `fashion:fashion` skill and continue the current phase from where it stopped. Do not repeat confirmed steps.
