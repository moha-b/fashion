---
name: fashion
description: Run the Fashion UI design workflow in Codex. Use for Fashion setup, start, resume or status, or a researched website/app design project with prototypes and screen-by-screen review. Not for unrelated repository maintenance.
---

# Fashion for Codex

Read [the runtime adapter](../../runtime.md) first. It defines how to execute the shared Fashion workflow in Codex; Claude-specific host instructions do not apply here. Resolve the plugin root as the directory three levels above this skill directory (the directory containing `agents/`, `commands/`, `scripts/` and `.codex-plugin/`). Use its absolute path, including when installed in a cache. Never assume the user's working directory is the plugin directory.

Choose the requested operation:

- **Setup** (`$fashion:fashion setup`): follow [setup](../../setup.md). This checks capabilities and optionally installs design skills; it does not start a project.
- **Start** (`$fashion:fashion start`, or a new Fashion design request): run `node "<plugin-root>/scripts/codex-project.mjs" init --root "<project-root>"`. If a project already exists, leave it intact and use resume. Read [the shared workflow](../../../skills/fashion/SKILL.md), begin phase 1, and retain the user's request as interview input. Use inherited Codex models unless the user requests supported alternatives.
- **Resume** (`$fashion:fashion resume`): read [the shared workflow](../../../skills/fashion/SKILL.md) and [resume](../../../commands/resume.md), applying the runtime adapter. Reconcile tasks, Git, attempts and evidence before dispatching work. Never restart Claude to continue a Codex project.
- **Status** (`$fashion:fashion status`): follow [status](../../../commands/status.md). Read-only: do not initialize, migrate, probe, install, or rewrite state.

The phase gates, per-ticket state schema, owned-process helper, browser evidence checks and screen/final reviews in the shared workflow remain required. A user approval already given remains valid; do not repeat it merely because the host changed.

For role work, explicitly delegate to available Codex subagents as described in the runtime adapter; pass them that adapter and the relevant `agents/<role>.md`. If delegation is unavailable, use the documented sequential mode and disclose that review is not independent.
