---
description: Turns a Fashion project's design decisions into build tickets. Writes tickets/<id>/rd.md (what it must do), tickets/<id>/eval.md (how to check it is done right) and tickets/board.md. Use in phase 4 of the fashion skill, or when the user asks to add or split a ticket.
---

# Ticket

Split the build into tickets a worker can finish alone, in its own context.

## Read first
`.fashion/brief.md`, `.fashion/state.json`, `ux/decisions.md`, `ux/components.md` (if present), `references/*/notes.md`, and `tickets/board.md` if tickets already exist. Never overwrite an existing ticket; add new ones and append to the board.

## Split
1. One ticket per screen, page section or feature named in `ux/decisions.md`. A ticket should take one worker well under an hour. Split anything bigger.
2. Add foundation tickets first, and make the others depend on them:
   - `T00-scaffold`: create the app for the platform in the brief (see the platform notes in the `fashion:fashion` skill). Mode `solo`.
   - `T01-tokens`: colour, type, spacing, radius, shadow and motion tokens in one place, from `ux/design-systems.md` and the decisions. Blocked by `T00-scaffold`.
3. Ids are `T<two digits>-<short-slug>`, in build order. Bug tickets from the checker are `bug-<n>`.
4. `blocked-by` lists only real dependencies (files or components the ticket needs). Keep the graph shallow so tickets can run in parallel. No cycles.
5. Mode: `solo` (one worker subagent) by default. Use `team` (a builder and a checker working together through agent teams, falling back to `solo` when teams are not available) only for tickets with heavy interaction or motion that need a tight build-check loop.

## tickets/<id>/rd.md
```
# <id>: <title>
## Goal
<one or two lines: what the user gets>
## Must do
- <behaviour, layout, content, states (empty, loading, error), breakpoints or devices>
## Design
- Decisions: <the lines from ux/decisions.md this ticket implements>
- References: <slugs from references/, and what to take from each>
- Components: <components it creates or reuses>
## Out of scope
- <what a neighbouring ticket covers>
## Blocked by
- <ids, or "none">
```

## tickets/<id>/eval.md
A numbered list. Each item is one check with a clear pass condition that the checker can run without asking. Include, as they apply:
1. Build passes: `npm run build` (web), `flutter analyze` (Flutter) or an Xcode build (SwiftUI). Lint passes where configured.
2. Browser or simulator steps: for web, `responsively` at phone, tablet and desktop: the URL, what to click or type, and what must be visible. For mobile, the simulator screen and gesture.
3. Each "Must do" line from `rd.md` as its own check.
4. Contrast: dembrandt `check_contrast` on the text and background pairs this ticket introduces. Pass at WCAG AA.
5. Skill checkers: the checker of each design skill the ticket uses (for example scrollcraft `verify.mjs`).
6. No raw colour or spacing values in components when `T01-tokens` exists.

## tickets/board.md
```
# Board
Status: draft → ready (set by the user) → in-progress → done

| id | title | status | mode | blocked-by | started | updated |
|---|---|---|---|---|---|---|
| T00-scaffold | Scaffold the app | draft | solo | — | | |
```
New tickets start as `draft`. Only the user moves a ticket to `ready` (they may tell the router, which updates the board). The router sets `in-progress` and `done`.

## Return
Show the board and ask the user which tickets to mark `ready`.
