---
description: Readiness check per machine. Reports whether a design backend (Google Stitch, or Figma) and the research tools work, with exact setup commands. Installs nothing.
disable-model-invocation: true
---

Check and report. Safe to rerun. Never install software, never add MCP servers or plugins, and never edit user or global configuration: give the commands, and the user runs them. The only optional change is step 3, and only after a yes.

## 1. Design backend
Follow "Design backend" in the `fashion:fashion` skill:
- Stitch: ToolSearch for `generate_screen_from_text`. If found, call that server's `list_projects` once. Report `ready`, `unauthorized` (with the error's decisive line) or `missing`.
- Figma: ToolSearch for `use_figma`. If found, call `whoami` once. Report the same way. A Figma server listed as needing authentication is `unauthorized`; the user signs in from `/mcp`.
- For each one that is not ready, print the skill's exact setup commands. Recommend Stitch unless the user needs editable Figma components.
Inside a Fashion project, save the result in `backend.status` and `backend.checkedAt` of `.fashion/state.json`. Outside one, write nothing.

## 2. Research tools
The plugin bundles inspo (remote HTTP), awwwards and dembrandt (both run with `npx`). Check `node --version` and `npx --version` and report if either is missing. awwwards page captures need a browser; if a capture fails, report its exact error and the fix it names. Do not install anything.

## 3. Grill-me (optional, writes to the home directory)
If `~/.agents/skills/grill-me/SKILL.md` only says to call the Skill tool with `grilling`, offer once to repoint that line to `fashion:grilling`. Change only that line, and only after a yes.

## 4. Retired build skills
Fashion 0.4 and earlier installed `scrollcraft`, `bang-motion`, `design-taste-frontend`, `hallmark`, `app-store-screenshots`, `brag-slim` and `clean-code-guard` into `~/.agents/skills/` for building apps. Fashion no longer uses them. Do not remove them; if they are present, say the user may remove them if nothing else uses them.

## 5. Report
One short table: item, status, what the user should do. Then: run `/fashion:start` in the product's folder, or `/fashion:resume` in an existing project. A new session is needed after adding an MCP server.
