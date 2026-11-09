# Fashion

A phased UI-design agent for Claude Code. It interviews you, researches competitors in the background, helps you choose a direction, then builds the UI for web (Next.js), Flutter or SwiftUI.

## Install

```
/plugin marketplace add moha-b/fashion
/plugin install fashion@fashion
/fashion:setup          # once per machine
```

Then, in the folder of your product:

```
/fashion:start
```

The plugin sets `fashion:router` as the default main agent, so every session with the plugin enabled starts as the router. Start a normal session with `claude --agent <other>` or by disabling the plugin.

Other commands: `/fashion:resume` (continue after a restart), `/fashion:status` (phase, open questions, saved references).

## Phases

1. **Interview.** Reads what you give it (URL, screenshots, code, decks). If that is not enough, it grills you one question at a time. Settles web or mobile (one per product) and, for mobile, Flutter or SwiftUI. Writes `.fashion/brief.md`.
2. **Research.** A background agent finds about 5 global and 3 local competitors and appends them to `research/competitors.md`. A second agent extracts design systems from the top 3 (dembrandt, after a robots check) and proposes directions. Meanwhile you save references: URLs (captured by the awwwards MCP) or files dropped into `references/<slug>/` with a `notes.md` of what you love. Images pasted into chat cannot be saved.
3. **Direction.** Compares competitors with your options, renders two versions of one representative screen, checks critical assets and the defining interaction, and reviews desktop and mobile results before settling the visual baseline.
4. **Build.** The router offers `git init` once (worktrees and merges need a repo; without one, workers run one at a time). It writes `ux/components.md` from the accepted prototype, then splits the decisions into tickets (`tickets/<id>/rd.md` and `eval.md`, listed in `tickets/board.md`). You mark tickets `ready`; the router assigns them to build workers, merges each branch, and has a checker test it in a real browser or simulator against `eval.md`. Responsively is preferred; a capable browser may cover checks it cannot run. A per-ticket state record supports watchdog and restart recovery. Workers follow shared component rules and run a `clean-code-guard` pass before handing back. A final visual review checks the complete journey. Web: Next.js (major pinned in `create-next-app@<major>`), React Three Fiber if you chose 3D, plus the design skills. Mobile: Flutter or SwiftUI.

Every phase ends with your explicit yes.

## Agents and models

| Role | Agents | Default model |
|---|---|---|
| router | `router` (main agent; talks to you, never writes app code — a hook blocks its writes outside `.fashion/`, `tickets/`, `research/`, `ux/`, `references/`) | Opus, high effort |
| research | `competitor-researcher`, `ux-analyst` | Opus, high effort |
| implement | `prototyper`, `visual-critic`, `builder`, `merger`, `checker`, `reproducer` | Sonnet |
| watchdog | `watchdog` | Sonnet |

`/fashion:start` asks once which models to use and saves them in `.fashion/state.json` under `models` (`research`, `implement`, `watchdog`). `/fashion:status` shows them.

## What it touches

- `/fashion:setup` writes to your home directory, after one confirmation: skills into `~/.agents/skills/` and symlinks in `~/.claude/skills/`. It skips identical skills, asks before replacing different ones, and installs no software. It reports missing prerequisites (node, Playwright, Xcode, Flutter).
- `/fashion:start` writes only in the current folder: `.fashion/`, `research/`, `ux/`, `references/` and `.claude/settings.json` (pre-allows WebSearch, WebFetch and this plugin's MCP tools). It never runs `git init`; the router offers that once, before phase 4, and commits planning files and merges only after you say yes.
- The plugin bundles four MCP servers (inspo, awwwards, dembrandt, responsively); the npm ones are version-pinned and run through `npx`.

## Licensing

- Fashion: MIT (`LICENSE`).
- Bundled in `plugins/fashion/vendor/skills/` with their licences: `scrollcraft` (MIT), `bang-motion` (MIT).
- Not bundled, installed from upstream by `/fashion:setup` at pinned commits: `design-taste-frontend`, `hallmark`, `app-store-screenshots`, `brag-slim`, `clean-code-guard`. All are MIT upstream; their licences stay with their own repos. Details in `plugins/fashion/vendor/skills/README.md`.
