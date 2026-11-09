---
description: Start a new design project in the current folder. Creates .fashion/ and begins the interview.
disable-model-invocation: true
---

Scaffold a Fashion project in the current working directory only.

1. If `.fashion/` exists, stop. Tell the user to run `/fashion:resume`. Change nothing.
2. Create:
   - `.fashion/state.json` with the initial state from the `fashion:fashion` skill (phase 1, loop 0, empty lists)
   - `.fashion/brief.md` (empty heading only)
   - `research/`, `ux/`, `references/` (each with a `.gitkeep`)
   - `.claude/settings.json` from `${CLAUDE_PLUGIN_ROOT}/templates/settings.json`. If `.claude/settings.json` already exists, merge the `permissions.allow` entries into it and keep everything else. Show the user what you added.
3. Do not run `git init` here. Do not create a repo or remote. The router offers `git init` once, before phase 4.
4. Ask once which models to use, and offer the defaults: research `opus` (high effort), implement `sonnet`, watchdog `sonnet`. Recommend the defaults. Save the answer in `state.models`. The router itself always runs on the model in its own frontmatter.
5. Load the `fashion:fashion` skill and begin phase 1. Pass along anything the user typed after the command (`$ARGUMENTS`) as the first input to the interview.
