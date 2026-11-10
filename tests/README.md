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

Repeat runs when changing prompts or fixtures: model output is nondeterministic. Keep every report and report all failures, rather than retrying until one run passes. For three independent runs:

```sh
failed=0
for run in 1 2 3; do
  node tests/recovery-prompts.mjs --run "/tmp/fashion-recovery-${run}.json" || failed=1
done
test "$failed" -eq 0
```

The runner sends only the listed plugin prompts and synthetic fixture inputs to Claude. Expected answers stay local. It uses Sonnet, disables tools and customizations, runs in an empty temporary directory, caps spend at $1 and runtime at 180 seconds, and saves the raw JSON response (including model usage, cost and duration) to the requested report path. A missing response, CLI error, omitted/duplicate case or wrong decision fails the run. Requires CLI support for `--safe-mode` and structured output.

Each fixture declares `role: watchdog`, `role: router` or `role: checker`. The model classifies watchdog flags only for watchdog cases; router and checker cases always use `none`. This removes role guessing without relaxing any decision assertions. Coverage includes completed work waiting in queues, completed but uncollected results/checks, stale heartbeats and attempts, hung mergers/checkers, a landed merge with its branch deleted, terminated-worker replacement, repeated resume with an active replacement, invalid legacy stages/extra fields, inherited versus explicit browser restrictions, final-review revision ownership, missing project-local Playwright, a required readiness probe before a resumed browser check, the screen gate (critic first, restart before, during and after the critique, a stale review after a revision), migrating a phase-4 project from 0.3.0 that has no screen state (clear and ambiguous mappings, no second migration), binding the checker to the recorded browser runtime (global runtime reuse, a different import, a runtime that disappeared), and cleanup ownership for long-lived processes (owned orphan, active owner, unrelated server on the port, PID reuse).

Fixtures describe filesystem, task and Git snapshots. This suite tests prompt decisions, not actual file writes, Git operations, task termination or browser execution. It does not establish deterministic schema enforcement, crash safety or improved design quality. Those still need live integration runs and repeated comparisons on the same briefs/assets, with preference/task outcomes, revisions, time, cost and model versions recorded.

## Process ownership (real subprocesses)

`plugins/fashion/scripts/owned-process.mjs` starts and stops dev servers with a recorded identity (pid, process group, start time, working directory). Its tests start real servers, including a child process in the same group, and check that they actually exit:

```sh
node --test tests/owned-process.test.mjs
```

Each case asserts the real process state, not just the helper's exit code. They cover an owned server with a child; a command that died while its child changed directory; a launcher that exits at once but leaves a child (start keeps a record); a command that exits with nothing left (start fails, record `exited`); a supervisor killed while processes remain (`unverified`, exit 4, record kept, nothing touched); PID reuse (refused, process left running); an unrelated server on the recorded port (refused at start, never stopped); a record write failure (start stops what it launched); and a supervisor killed inside the startup window (start exits 4 `unverified`, the record stays `running`, `stop` refuses, the command is left alive). macOS and Linux only; they need `ps`, `pgrep`, and `lsof` on macOS.

## Usage collector

`bench/collect-usage.mjs` is tested on synthetic transcripts:

```sh
node --test tests/collect-usage.test.mjs
```

The tests check that one API request written as several transcript lines is counted once, that subagent usage is attributed through `.meta.json`, and that session and time filters work. They check that human wait time ignores skill text, task notifications and tool results. And they check that cost stays `unknown` (never 0) unless every model has a full price.

They also cover four cases from the review of PR #9:
- recollecting a run keeps the operator's fields;
- time bounds compare instants (fractional seconds, offsets, invalid or reversed bounds);
- a malformed interior line fails with file:line;
- an unfinished final line marks the run incomplete, with only a lower bound for cost;
- the documented `--out` path works in a fresh folder.
