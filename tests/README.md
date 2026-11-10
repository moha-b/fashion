# Fashion tests

## Design workflow (deterministic)

```sh
node --test tests/design-workflow.test.mjs
```

No model calls and no network. It covers:
- **Write guard** (`plugins/fashion/scripts/design-guard.mjs`): Fashion's agents (router, researcher, visual-critic) may write only non-code files in `.fashion/`, `research/`, `ux/`, `references/` and `handoff/`, plus `.claude/settings.json` and `.gitignore`. Code files (HTML, CSS, JS/TS, Dart, Swift and similar) are blocked everywhere, including an HTML export dropped into `handoff/`. Legacy `tickets/` and `prototypes/` are read-only. Other agents and sessions pass untouched, and unreadable hook input fails open.
- **Legacy migration** (`plugins/fashion/scripts/migrate-state.mjs`): each 0.4 phase maps to its design phase (1 to `brief`, 2 to `research`, 3 and 4 to `direction`, `done` stays `done` and is flagged); the archive keeps the original bytes; the new state has exactly the documented keys; a second run changes nothing; `tickets/`, `prototypes/` and process records are listed but never modified; in-flight tickets and running process records are reported; mobile code stacks become a mobile OS or an open question; dry run writes nothing; missing, invalid, unknown-phase and future-schema states fail without changes.
- **Plugin shape**: only the router, researcher and visual-critic agents ship; no vendor build skills; the bundled MCP servers are inspo, awwwards and dembrandt; the hook points at the guard; the template pre-allows only read-only design-tool calls; the `state.json` block in the skill equals the migrator's initial state; no shipped prompt dispatches a retired build agent or scaffolds an app.

It does not test live Stitch or Figma calls, their authentication, export downloads, or the quality of any design.

## Decision regression (model run, optional)

Validate the fixtures locally, without a model call:

```sh
node tests/decision-prompts.mjs --check
```

Run the decisions with an authenticated Claude CLI:

```sh
node tests/decision-prompts.mjs --run /tmp/fashion-decisions.json
```

The runner sends only the shipped prompts (skill, resume, setup, router, visual critic) and synthetic fixtures. Expected answers stay local. It uses Sonnet, disables tools and customizations, runs in an empty temporary directory, caps spend at $1 and runtime at 180 seconds, and saves the raw JSON response (with usage, cost and duration) to the report path. Requires CLI support for `--safe-mode` and structured output. Model output is nondeterministic: repeat runs when prompts or fixtures change and report every failure rather than retrying until one passes.

```sh
failed=0
for run in 1 2 3; do
  node tests/decision-prompts.mjs --run "/tmp/fashion-decisions-${run}.json" || failed=1
done
test "$failed" -eq 0
```

Fixtures cover: migrating a 0.4 build-phase project with tickets in flight and a finished 0.4 project; continuing a migrated project by recreating its baseline in the design tool; a missing, unauthorized or wrong backend (setup is reported, never a code fallback or an automatic switch); reusing saved research; one researcher per brief and no duplicate on resume; capturing a user reference; a timed-out Stitch generation (inspect before retrying); Stitch returning HTML (export images only); critique before the direction gate; design edits; the handoff gates; and a request for an implementation after handoff (declined).
