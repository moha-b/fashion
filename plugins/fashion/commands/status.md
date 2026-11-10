---
description: Show the phase, design backend, screens and open questions of the current Fashion project.
disable-model-invocation: true
---

Read-only. Change nothing, and make no design-tool calls.

1. If `.fashion/state.json` is missing, say there is no Fashion project here and point to `/fashion:start`.
2. Read `.fashion/state.json`. If it has no `schema` field, say it is a project from the retired build workflow, show its old `phase`, and say `/fashion:resume` migrates it without building anything. Stop.
3. List the files in `research/`, `ux/`, `references/` and `handoff/`.
4. Print:
   - Phase and which of the four gates are approved
   - Platform (and mobile OS), site type (`landing` or `multi`) and the user's site URL
   - Design backend: tool, status and when it was checked, the Stitch project or Figma file, the design system
   - Research: status, number of competitors in `research/competitors.md`, saved references (slug, and whether `notes.md` exists)
   - Direction: round, candidates, the chosen one
   - Design round, and screens: each with its states, frames generated and exported (flag any frame whose export is null), revision round and status
   - Decisions (one line each) and open questions
   - Models per role: router (from the `fashion:router` agent: opus, high effort), research and critic (from `state.models`; say "default" when a key is missing: research opus, critic sonnet)
   - Legacy, when `legacy` is set: migrated from which phase and when, the archive path, the legacy folders left untouched, and the tickets that were in flight and not resumed
5. Suggest the next step in one line.
