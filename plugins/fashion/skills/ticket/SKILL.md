---
description: Turns a Fashion project's design decisions into build tickets. Writes tickets/<id>/rd.md (what it must do), tickets/<id>/eval.md (how to check it is done right) and tickets/board.md. Use in phase 4 of the fashion skill, or when the user asks to add or split a ticket.
---

# Ticket

Split the build into tickets a worker can finish alone, in its own context.

## Read first
`.fashion/brief.md`, `.fashion/state.json`, `ux/decisions.md`, `ux/components.md` (written and confirmed in phase 4.2; stop and ask the router for it if missing), `references/*/notes.md`, and `tickets/board.md` if tickets already exist. Never overwrite an existing ticket; add new ones and append to the board.

## Split
1. Ticket only the screen the router names (`currentScreen` in `.fashion/state.json`); other screens get their tickets when their turn comes. One ticket per section or feature of that screen named in `ux/decisions.md`. A ticket should take one worker well under an hour. Split anything bigger.
2. For the first screen only, add foundation tickets first, and make the others depend on them:
   - `T00-scaffold`: create the app for the platform in the brief (see the platform notes in the `fashion:fashion` skill). Mode `solo`.
   - `T01-tokens`: colour, type, spacing, radius, shadow and motion tokens in one place, from the Tokens part of `ux/components.md`. Blocked by `T00-scaffold`.
   - `T02-primitives`: the primitives in `ux/components.md`, each with its variants as props. Blocked by `T01-tokens`. Split it if the list is long.
   - Extraction tickets: for each shared primitive that `ux/components.md` plans to extract from existing code, a ticket that creates it and moves the existing component onto it, with no visible change. The new component's ticket is blocked by it.
   Section and page tickets are blocked by the primitives they use. Skip a foundation ticket when the existing codebase already covers it.
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
- <what a neighbouring ticket covers. Never put an extraction the component rules require out of scope; it goes in this ticket or a ticket that blocks it.>
## Blocked by
- <ids, or "none">
```

## tickets/<id>/eval.md
A numbered list. Each item is one check with a clear pass condition that the checker can run without asking. Include, as they apply:
1. Build passes: `npm run build` (web), `flutter analyze` (Flutter) or an Xcode build (SwiftUI). Lint passes where configured.
2. Browser or simulator steps: for web, use a real browser at phone, tablet and desktop, one device at a time: the URL, what to click or type (including keyboard interactions), and what must be visible. Prefer `responsively`; use a named real-browser fallback when it is unavailable or lacks a required capability. Record tool, viewport, URL, interactions, assertions and screenshot path where supported. Use URLs that exist in the app. A code check alone cannot pass an interaction item. For mobile, specify simulator screen and gesture.
3. Each "Must do" line from `rd.md` as its own check.
4. Contrast: dembrandt `check_contrast` on the text and background pairs this ticket introduces. Pass at WCAG AA.
5. Skill checkers: the checker of each design skill the ticket uses (for example scrollcraft `verify.mjs`).
6. No raw colour or spacing values outside the token file. Grep the files the ticket adds or changes for hex colours, `rgb(`/`hsl(`, raw `px`/`pt`/`rem` values, and Tailwind arbitrary values such as `w-[420px]` or `text-[13px]` (pattern `-\[[0-9.]+(px|rem|pt)\]`). Each hit is a fail unless it is in the token file.
7. No duplicated components: each component the ticket adds is in `ux/components.md`, and no two files implement the same markup or styling (for example two drawers with their own backdrop and panel shell).
8. clean-code-guard pass recorded in `result.md`, with findings fixed or justified (or "skipped: not installed" plus the component rules applied by hand).

## tickets/board.md
```
# Board
Status: draft → ready (set by the user) → in-progress → done

| id | screen | title | status | mode | blocked-by | started | updated |
|---|---|---|---|---|---|---|---|
| T00-scaffold | home | Scaffold the app | draft | solo | — | | |
```
New tickets start as `draft`. Only the user moves a ticket to `ready` (they may tell the router, which updates the board). The one standing authorization: when the user answers a screen review with no changes, that answer marks the next screen's tickets `ready` (the router's question says so). The router sets `in-progress` and `done`.
The router also creates `tickets/<id>/state.json` at stage `draft` using the schema in the Fashion skill. It is the source of truth for stage, attempt, task and commit; the board summarizes it. When the user marks a ticket ready, update both state and board.

## Return
Show the board and ask the user which tickets to mark `ready`.
