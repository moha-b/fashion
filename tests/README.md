# Fashion prompt regression tests

These fixtures evaluate decisions made from the actual shipped agent/workflow instructions. They do not implement a second state machine or use keyword matching as a substitute for behavior.

Validate fixture definitions locally, without a model call:

```sh
node tests/recovery-prompts.mjs --check
```

Run the decision regression suite with an authenticated Claude CLI:

```sh
node tests/recovery-prompts.mjs --run /tmp/fashion-recovery-report.json
```

The runner sends only the listed plugin prompts and synthetic fixture inputs to Claude. Expected answers stay local. It uses Sonnet, disables tools and customizations, runs in an empty temporary directory, caps spend at $1 and runtime at 180 seconds, and saves the raw JSON response (including model usage, cost and duration) to the requested report path. A missing response, CLI error, omitted/duplicate case or wrong decision fails the run. Requires CLI support for `--safe-mode` and structured output.

Coverage includes completed work waiting in queues, completed but uncollected results/checks, stale heartbeats and attempts, hung mergers/checkers, a landed merge with its branch deleted, terminated-worker replacement, repeated resume with an active replacement, invalid legacy stages/extra fields, inherited versus explicit browser restrictions, final-review revision ownership, and missing project-local Playwright.

Fixtures describe filesystem, task and Git snapshots. This suite tests prompt decisions, not actual file writes, Git operations, task termination or browser execution. It does not establish deterministic schema enforcement, crash safety or improved design quality. Those still need live integration runs and repeated comparisons on the same briefs/assets, with preference/task outcomes, revisions, time, cost and model versions recorded.
