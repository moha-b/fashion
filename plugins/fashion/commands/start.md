---
description: Start a new Fashion design project in the current folder. Creates .fashion/ and begins the brief.
disable-model-invocation: true
---

Scaffold a Fashion project in the current working directory only.

1. If `.fashion/` exists, stop and tell the user to run `/fashion:resume`. Change nothing.
2. Create:
   - `.fashion/state.json` with the initial state from the `fashion:fashion` skill (schema 2, phase `brief`)
   - `.fashion/brief.md` (empty heading only)
   - `research/`, `ux/`, `references/`, `handoff/` (each with a `.gitkeep`)
   - `.claude/settings.json` from `${CLAUDE_PLUGIN_ROOT}/templates/settings.json`. If `.claude/settings.json` already exists, merge the `permissions.allow` entries into it and keep everything else. Show the user what you added.
3. Do not run `git init`, install anything, or add MCP servers.
4. Models: research `opus` (high effort) and critic `sonnet` by default. Use other values only if the user named them with the command; mention the defaults in one line.
5. Load the `fashion:fashion` skill and begin phase `brief`. Pass anything the user typed after the command (`$ARGUMENTS`) as the first input.
