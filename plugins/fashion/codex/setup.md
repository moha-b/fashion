# Setup in Codex

Check prerequisites without writing to the user's home or changing approvals. Report Node, Git, available design/research MCP tools and a capable browser. In an app directory, use the exact Playwright probe in `commands/setup.md` section 4 (or equivalent real-browser capability checks). Outside a project, report machine capabilities and repeat the probe from the eventual app directory. Missing optional research tools use the runtime adapter's fallback; missing required browser/build capability stays an explicit gap.

Use installed design skills from the session catalog or `~/.agents/skills/`. For missing skills, use `commands/setup.md` sections 1–3 only for the bundled/upstream source inventory, comparison and approved copying:

- Resolve all plugin paths from this installed plugin's root. Upstream commits remain pinned in `vendor/skills/upstream.json` and fetched with `scripts/fetch-skill.sh`.
- Before home-directory installation, show sources, target paths and replacements; ask once unless the user already approved this concrete installation. Skip identical copies; preserve differing skills until replacement is approved.
- Install into `~/.agents/skills/<name>` only. Do not create `~/.claude/skills` symlinks, repoint `grill-me`, install Claude, or modify Codex/global settings. Codex discovers Agent Skills directly.
- Never install Node, browser binaries or platform SDKs implicitly. Give the missing dependency and installation command; proceed with installation only if the user authorized it.

Report installed/skipped/missing capabilities and how each gap affects the requested project. Start with `$fashion:fashion start` in the product folder. Setup alone does not create a Fashion project or run an interview.
