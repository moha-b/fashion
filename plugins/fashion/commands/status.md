---
description: Show the phase, open questions and saved references of the current Fashion project.
disable-model-invocation: true
---

Read-only. Change nothing.

1. If `.fashion/state.json` is missing, say there is no Fashion project here and point to `/fashion:start`.
2. Read `.fashion/state.json`, `tickets/board.md` (if present), and list the files in `research/`, `ux/` and `references/`.
3. Print:
   - Phase (1 interview, 2 research, 3 direction, 4 build) and loop count
   - Platform, mobile stack, site type (`landing` or `multi`) and the user's site URL
   - Decisions made (one line each)
   - Open questions
   - Saved references (slug, and whether `notes.md` exists)
   - Research: number of competitors found, researcher and analyst done or not
   - Models per role: router (from the `fashion:router` agent: opus, high effort), research, implement and watchdog (from `state.models`; say "default" when a key is missing, with the default value: research opus, implement sonnet, watchdog sonnet)
   - Git: yes, no or not asked yet (`state.git`)
   - Screens (phase 4): each screen in order with its status, and which one is current
   - Tickets (phase 4): count per status (`draft`, `ready`, `in-progress`, `done`), and each `in-progress` ticket with its start time
4. Suggest the next step in one line.
