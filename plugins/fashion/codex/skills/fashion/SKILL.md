---
name: fashion
description: Run Fashion's design-only UI workflow in Codex: brief, research, direction, screen design and handoff in Google Stitch or Figma. Use for Fashion setup, start, resume or status, or a researched website or app design project. Never writes application code. Not for unrelated repository maintenance.
---

# Fashion for Codex

Read [the runtime adapter](../../runtime.md) first. It defines how to run the shared Fashion workflow in Codex; Claude-specific host instructions do not apply here. Resolve the plugin root as the directory three levels above this skill directory (the directory containing `agents/`, `commands/`, `scripts/` and `.codex-plugin/`). Use its absolute path, including when installed in a cache. Never assume the user's working directory is the plugin directory.

Choose the requested operation:

- **Setup** (`$fashion:fashion setup`): follow [setup](../../setup.md). It checks the design backend and research tools and installs nothing. It does not start a project.
- **Start** (`$fashion:fashion start`, or a new Fashion design request): run `node "<plugin-root>/scripts/codex-project.mjs" init --root "<project-root>"`. If a project already exists, leave it intact and use resume. Read [the shared workflow](../../../skills/fashion/SKILL.md), begin phase `brief`, and keep the user's request as brief input. Use inherited Codex models unless the user asks for supported alternatives.
- **Resume** (`$fashion:fashion resume`): read [the shared workflow](../../../skills/fashion/SKILL.md) and [resume](../../../commands/resume.md), applying the runtime adapter. Run the migration step first: a project from the retired build workflow is migrated, never rebuilt. Never restart Claude to continue a Codex project.
- **Status** (`$fashion:fashion status`): follow [status](../../../commands/status.md). Read-only: do not initialize, migrate, call design tools, install or rewrite state.

The four approval gates, the state schema, the design-backend rules and the no-code rules of the shared workflow remain required. An approval already given stays valid when the host changes.
