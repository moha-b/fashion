# Fashion

A design-only UI agent for Claude Code. It writes a brief with you, runs one bounded research pass, generates direction alternatives in a design tool, designs the screens and their states, and hands off approved designs: links, exported previews, the design system, interaction specifications and a short record of decisions. It never writes application code.

The design backend is Google Stitch by default, through Google's Stitch MCP server, or Figma through Figma's MCP server when you need editable Figma components. Fashion installs neither; `/fashion:setup` tells you what is missing.

## Install

```
/plugin marketplace add moha-b/fashion
/plugin install fashion@fashion
/fashion:setup          # readiness check; installs nothing
```

Connect a design backend yourself. Stitch (create the key in Stitch: profile menu > Stitch settings > API keys):

```bash
claude mcp add --transport http stitch https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: <your Stitch API key>"
```

Figma (only if you need editable Figma components): install Figma's plugin and sign in from `/plugin` > Installed > figma,

```bash
claude plugin install figma@claude-plugins-official
```

or add the server and authenticate from `/mcp` > figma:

```bash
claude mcp add --transport http figma https://mcp.figma.com/mcp
```

Then, in the folder of your product, run `/fashion:start`.

The plugin sets `fashion:router` as the default main agent, so every session with the plugin enabled starts as the router. Start a normal session with `claude --agent <other>` or by disabling the plugin.

Other commands: `/fashion:resume` (continue after a restart, and migrate 0.4 projects), `/fashion:status` (phase, backend, screens, open questions).

## Phases

1. **Brief.** Reads what you give it (URL, screenshots, decks) and asks only questions that change the design: audience and primary task, web or mobile, landing page or multi-screen, brand constraints, and whether you need editable Figma components. If you give your own site and confirm you own its images and copy, it collects them into `references/own-site/`. Writes `.fashion/brief.md`. Gate: your yes.
2. **Research.** Reuses saved references and research first. Otherwise one background researcher, with hard caps (at most 5 comparable products, design systems of the top 2, at most 3 directions), writes `research/competitors.md`, `ux/design-systems.md` and `ux/directions.md` while you add up to three references of your own. No gate.
3. **Direction.** Generates two or three alternatives of one representative screen in the design tool, exports previews, has an independent critic review the images, and shows them with a recommendation. Gate: you pick. The chosen direction becomes the design system.
4. **Design.** Generates each screen of the primary journey with the states that matter, at each form factor, from the design system; fixes drift; checks colour contrast of the tokens; writes interactions as a specification. The critic reviews the set. Gate: you approve the set or name changes.
5. **Handoff.** Writes `handoff/`: links and tool references for every screen and state, exported previews, the design system, interaction specifications and a one-page decision record. Gate: your final yes.

Interactions are specifications or the design tool's own prototype links; nothing is run, so nothing is claimed as validated. Code that a design tool can produce (Stitch's HTML, Figma's code output) is never downloaded, reviewed or handed off.

## Agents and models

| Role | Agent | Default model |
|---|---|---|
| router | `router` (main agent; talks to you and makes the design-tool calls) | Opus, high effort |
| research | `researcher` (once per brief, background) | Opus, high effort |
| critic | `visual-critic` (once per review round, background; reviews exported images only) | Sonnet |

Models for research and critic live in `.fashion/state.json` under `models`; `/fashion:status` shows them.

## What it touches

- `/fashion:setup` checks the design backend and research tools and prints setup commands. It installs nothing and changes no configuration; the one optional change (repointing an existing `grill-me` skill to `fashion:grilling`) needs your yes.
- `/fashion:start` writes only in the current folder: `.fashion/`, `research/`, `ux/`, `references/`, `handoff/` and `.claude/settings.json` (pre-allows WebSearch, WebFetch, this plugin's research MCP tools, and read-only Stitch tools for a server named `stitch`).
- A plugin hook (`scripts/design-guard.mjs`) blocks Fashion's own agents from writing outside those folders and from writing code files anywhere. Other agents and sessions are not affected.
- The plugin bundles three research MCP servers: inspo (HTTP), awwwards and dembrandt (version-pinned, run through `npx`). It does not bundle Stitch or Figma.

## Upgrading from 0.4

0.4 and earlier built the app (tickets, worker agents, worktrees, merges, browser checks). That workflow is retired. `/fashion:resume` runs `scripts/migrate-state.mjs` once:
- archives the old state to `.fashion/legacy/state-v1.json` and writes schema 2;
- maps the phase: interview to `brief`, research to `research`, direction and build to `direction` (the accepted visual baseline is recreated in the design tool as the single candidate), `done` stays `done` and resume asks once whether to recreate the design;
- keeps the brief, decisions, references and research;
- lists tickets that were in flight and dev-server records still marked running, and logs the migration in `.fashion/migration.md`.

It never builds, merges, checks, stops or deletes anything. `tickets/`, `prototypes/`, app code and git worktrees stay as they are; stop leftover workers and dev servers and remove worktrees (`git worktree list`) yourself. Skills that 0.4's setup installed into `~/.agents/skills/` are no longer used; Fashion does not remove them.

## Limitations

- Stitch's and Figma's tool sets, quotas, plans and seats are set by Google and Figma and can change. Fashion finds tools at runtime by name and reports what it cannot find; it does not work around a missing integration.
- The Stitch MCP tools Fashion uses take text prompts and DESIGN.md files, not image uploads, so your own images are mapped in the handoff rather than placed in Stitch screens. Figma can place them (`upload_assets`).
- There is no automated transfer from Stitch to Figma.
- Accessibility checks are design-level (token contrast, target sizes); no runtime accessibility testing.
- Review quality depends on the previews the design tool exports; an image the tool returns only inline is recorded as a link.
- No measured comparison of time or token use against 0.4 exists yet.

## Tests

See [tests/README.md](tests/README.md). The deterministic suite runs with `node --test tests/design-workflow.test.mjs`.

## Licensing

Fashion: MIT (`LICENSE`). Up to 0.4 the plugin bundled `scrollcraft` and `bang-motion` and installed five upstream build skills; 0.5.0 removed them because they only served app building.
