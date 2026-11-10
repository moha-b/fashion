---
description: Continue a Fashion project from its saved state. Migrates projects from the retired build workflow without building anything.
disable-model-invocation: true
---

1. If `.fashion/state.json` is missing, tell the user to run `/fashion:start`. Stop.
2. Load the current `fashion:fashion` skill. Then run, with the absolute project root:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/migrate-state.mjs" --root "<project root>"
   ```
   It is idempotent and prints one JSON line.
   - `"migrated": false`: the state is already schema 2. Continue.
   - `"migrated": true`: a project from the retired build workflow (plugin 0.4 or earlier). Tell the user in at most four lines: the old and new phase, the archive path, and that Fashion now ends in approved designs, so nothing will be built, merged or checked. If `activeTickets` or `processRecords` are not empty, list them and say Fashion leaves them alone: the user may stop those tasks and dev servers and remove leftover worktrees (`git worktree list`) themselves. Never launch, collect, merge, check or clean up legacy work, and never edit `tickets/` or `prototypes/`.
   - Exit code 2 or 3: report its message. Do not edit the state by hand.
3. Read `.fashion/state.json`, `.fashion/brief.md`, and `ux/decisions.md`, `ux/design-system.md` and `handoff/README.md` where present.
4. Say in three lines: the current phase, what is done, what is open.
5. Background agents. Do not assume a saved task is alive or dead: check `research.taskId` and `critic.taskId` before relaunching. A live task keeps running. A finished one is collected from its files. A dead one is relaunched only if its output files are missing. Never launch a duplicate.
6. Before the first design-tool call, check the backend again ("Design backend" in the skill). If it is not ready, give the exact setup and stop there. Never fall back to code.
7. Continue the current phase from where it stopped. Do not repeat an approved gate or regenerate a frame that has a `toolRef`.
   - `legacy.recreateBaseline` true, phase `direction`, no candidates yet: recreate the accepted visual baseline as the single candidate ("Phase: direction" in the skill), then gate 2.
   - `legacy.completedUnderBuildWorkflow` true and phase `done`: say the project was finished under the retired build workflow and has no design-tool artifacts. Ask once whether to recreate its approved design in the design tool (then set phase `direction` and continue as above) or leave it closed. Do nothing else until the user answers.
