---
description: Show the phase, open questions and saved references of the current Fashion project.
disable-model-invocation: true
---

Read-only. Change nothing.

1. If `.fashion/state.json` is missing, say there is no Fashion project here and point to `/fashion:start`.
2. Read `.fashion/state.json` and list the files in `research/`, `ux/` and `references/`.
3. Print:
   - Phase (1 interview, 2 research, 3 direction, 4 build) and loop count
   - Platform and mobile stack
   - Decisions made (one line each)
   - Open questions
   - Saved references (slug, and whether `notes.md` exists)
   - Research: number of competitors found, researcher and analyst done or not
4. Suggest the next step in one line.
