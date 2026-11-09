---
description: Continue a Fashion project from its saved state.
disable-model-invocation: true
---

1. If `.fashion/state.json` is missing, tell the user to run `/fashion:start`. Stop.
2. Read `.fashion/state.json`, `.fashion/brief.md`, `ux/decisions.md` (if present), and the tail of `research/competitors.md`.
3. Say in three lines: current phase, what is done, what is open.
4. Background agents do not survive a restart. If phase is 2 and `researcherDone` is false, ask before relaunching the researcher (it appends to the existing file; tell it what is already there). Same for `analystDone`.
5. If phase is 4, read `tickets/board.md`. For each `in-progress` ticket: if `tickets/<id>/result.md` exists, continue from the merge and check steps; otherwise ask once before relaunching its worker (with `git: true`, run `git worktree list` first and name any leftover worktree for it). Restart the watchdog schedule if a ticket is still `in-progress`.
6. Load the `fashion:fashion` skill and continue the current phase from where it stopped. Do not repeat confirmed steps.
