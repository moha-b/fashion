# Codex runtime adapter

This file maps Fashion's shared design-only workflow (`skills/fashion/SKILL.md`) to Codex. Apply it to the coordinator and to any delegated role. The shared Markdown remains the source of the phases, gates, state and design-backend rules; this adapter replaces only host-specific instructions. It never overrides system instructions, project rules, permissions or user choices.

## Entry points, files and tools

- The current Codex chat coordinates Fashion and acts as the router. No `claude --agent`, Claude installation or default-agent setting is needed. Keep normal Codex behavior for unrelated requests.
- `/fashion:start`, `/fashion:resume`, `/fashion:status` and `/fashion:setup` in shared prose mean the corresponding `$fashion:fashion` operation. `fashion:fashion` and `fashion:grilling` mean read `<plugin-root>/skills/<name>/SKILL.md`; there is no required Claude Skill tool.
- `${CLAUDE_PLUGIN_ROOT}` in shared commands means the absolute plugin root resolved from the entry skill. Substitute that path before running a shared command such as `scripts/migrate-state.mjs`; do not assume that environment variable exists.
- "ToolSearch" in shared prose means: look for the tool by name among the tools this Codex session exposes. The prefix depends on the server name the user chose; never guess it.
- Do not create `.claude/settings.json`, alter `.codex/config.toml` or `~/.codex/config.toml`, or grant permissions. Keep Codex's sandbox and approval settings.
- Image attachments with a readable local path can be saved as references after confirming intended reuse. The shared note that chat images cannot be saved is Claude-specific.

## Design backend in Codex

The shared rules apply unchanged: Stitch by default, Figma when editable Figma components are required, and no fallback to code. Codex reads MCP servers from `config.toml`; the user adds them, and Fashion never edits that file. Give this setup when a backend is missing.

Stitch, in `~/.codex/config.toml` (or the project's `.codex/config.toml`), with the API key from Stitch settings in the `STITCH_API_KEY` environment variable:

```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"
env_http_headers = { "X-Goog-Api-Key" = "STITCH_API_KEY" }
```

Figma:

```bash
codex mcp add figma --url https://mcp.figma.com/mcp
codex mcp login figma
```

Figma admits only clients listed in its MCP catalog. If it refuses Codex, say so and offer Stitch. Start a new chat after adding a server.

## No application code

Codex does not run the Claude write hook (`scripts/design-guard.mjs`), so the boundary is an instruction, not a sandbox. Write only non-code files in `.fashion/`, `research/`, `ux/`, `references/` and `handoff/`. Never write code, never download the HTML or code a design tool offers, never scaffold, build, run or test an app, and never create Git worktrees for Fashion work.

## Models and delegation

Default to the current Codex model and reasoning settings. `inherit` means omit model overrides when spawning. Claude aliases (`opus`, `sonnet`, `haiku`, `fable`) and the `model`, `effort`, `background` and `color` frontmatter in role files are not Codex configuration; never translate an alias into a guessed OpenAI model ID. Preserve a resumed project's `state.models`.

The shared workflow delegates only two roles: `researcher` (once per brief) and `visual-critic` (once per review round). With Codex subagent tools, load `agents/<role>.md` and pass its body, this adapter, the brief path, the project and plugin roots, and the exact files the role may write. Save the real returned agent ID as `research.taskId` or `critic.taskId` immediately. Use wait or follow-up on a surviving agent instead of spawning a duplicate. An unknown ID after a restart is not proof the agent stopped: check its output files first.

Without subagent tools, run each role in the current chat by reading its role file, keep `taskId` null, and label the critique as self-review, not an independent review.

## Usage evidence

`bench/collect-usage.mjs` reads Claude transcripts only. Do not run it on Codex history or label its output as Codex cost. Record the host-reported model, usage and elapsed time when available; otherwise `unknown`.
