# Codex runtime adapter

This file maps Fashion's shared workflow to Codex. Apply it to the coordinator and every worker. The shared Markdown remains the source of design, ticket, evidence and recovery rules; this adapter replaces only host-specific execution instructions. It never overrides system instructions, project rules, permissions or user choices.

## Entry points, files and tools

- The current Codex chat coordinates Fashion. No `claude --agent`, Claude installation or default-agent setting is needed. Keep normal Codex behavior for unrelated requests.
- `/fashion:start`, `/fashion:resume`, `/fashion:status` and `/fashion:setup` in shared prose mean the corresponding `$fashion:fashion` operation. `fashion:fashion`, `fashion:ticket` and `fashion:grilling` mean read `<plugin-root>/skills/<name>/SKILL.md`; there is no required Claude Skill tool.
- `${CLAUDE_PLUGIN_ROOT}` in shared commands means the absolute plugin root resolved from the entry skill. Substitute that path before executing or delegating; do not assume that environment variable exists. Pass both plugin root and project root to workers. Use the actual worktree path as the worker's working directory.
- Do not create `.claude/settings.json`, alter `.codex/config.toml`, install a default agent or grant permissions as part of starting a project. The shared Git initialization step skips `.claude/settings.json` when it does not exist. Keep Codex's sandbox and approval settings.
- Locate optional skills in the session catalog, then `~/.agents/skills/`; use their real paths. Do not require `~/.claude/skills/`. Missing design skills are reported and handled by the shared fallback rules.
- Discover available MCP/browser tools by capability, not Claude's tool namespace. The plugin packages inspo, awwwards, dembrandt and responsively connection definitions. A declared connection is not proof the server is usable. If unavailable, use an available real browser/search tool, label inferred research and record capability gaps. Never invent capture results, source files or passing checks. Use the shared setup browser probe from the app directory before prototype/checker dispatch.
- Image attachments with a readable local path can be used directly after confirming intended reuse. If the attachment has no readable path, ask for a file only when saving it is necessary. Do not apply the shared Claude-only claim that all chat images are unsaveable.

## Models and delegation

Default to the current Codex model and reasoning settings. `inherit` means omit model overrides when spawning. Claude aliases (`opus`, `sonnet`, `haiku`, `fable`) and `model`, `effort`, `background`, `color` frontmatter in shared role files are not Codex configuration. Preserve a resumed project's `state.models`; store any explicitly chosen Codex role models separately in `.fashion/runtime.json` under `models`, with `host: "codex"`. Never silently translate a Claude alias into a guessed OpenAI model ID.

Use Codex's available spawn, message, wait and status tools to delegate:

1. Load `agents/<role>.md` and pass its body, this adapter, the relevant shared workflow sections, exact role scope, project/plugin roots, ticket/attempt/commit and browser runtime record. Shared role names are instructions, not registered Codex `agent_type` values; use an available built-in type.
2. Assign file ownership. Tell workers they share the repository, must preserve others' edits, and must only modify their assigned worktree/files. Save the real returned agent ID as `taskId` immediately. There is no Claude `Agent`, `TeamCreate` or `isolation: "worktree"` argument here.
3. When `git: true`, create a worktree and a `codex/<ticket>-<attempt>` branch using Git before spawning a writer. Pass its absolute path explicitly; Codex subagents otherwise share the parent's working directory. Serial merges and official browser checks remain mandatory. Do not remove a worktree until its task has ended and its work is preserved.
4. Collect results and inspect actual task status. Use follow-up or wait on surviving agents instead of spawning duplicates. Unknown/stale IDs across sessions or hosts are not proof of termination: inspect Git, heartbeat, results, active commands and owned-process records; block replacement if execution cannot be ruled out. Do not kill processes by port.
5. Respect the lower of `maxWorkers` and available agent slots. Treat team tickets as solo unless the host genuinely exposes team coordination. Check the watchdog when control returns and ten minutes have elapsed; do not install persistent Codex automations for a build.

Codex does not run the Claude router-write hook. Coordinator/worker separation is an instruction boundary, not a sandbox guarantee. Prefer delegated implementation and independent critique/checking whenever available.

If subagent tools are unavailable, announce sequential mode, use one worker at a time, and perform each role separately in the current chat by reading its role file. This is the only exception to the shared router's no-app-edits rule. Preserve ticket transitions, attempts, heartbeat, results, merge/check sequence and approvals. Keep `taskId: null` for inline work; never invent an agent ID. Record active shell session IDs in the ticket log. On restart reconcile commands and evidence before repeating work. Label critique/checking as self-review, not independent review.

## Runtime evidence and limits

Use `scripts/owned-process.mjs` unchanged, with explicit plugin path and the shared owner/role/attempt contract. Do not claim a background worker or watchdog survived the chat without observed host status. Browser restrictions and native build requirements still apply; missing tools leave the affected checks blocked or not run.

`bench/collect-usage.mjs` reads Claude transcripts only. Do not run it on Codex history or label its output as Codex cost. For Codex trials record actual host-reported model/usage and elapsed time when available; otherwise use `unknown`. Keep runtime labels in comparisons and do not compare unlike evidence as if measured identically.
