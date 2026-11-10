# results/

One folder per project. Each project folder holds everything for that project:

```
results/<project>/
  .claude/settings.json   tool permissions used for this project
  .fashion/               brief.md, state.json, migration.md (projects moved from the build workflow)
  research/               competitors.md
  ux/                     design-systems.md, directions.md, decisions.md, design-system.md, interactions.md, visual reviews
  ux/evidence/            exported previews per direction and design round
  references/<slug>/      captures and notes.md for each reference
  handoff/                README.md (links), exports/, decisions.md, design-system.md, interactions.md
```

Projects run with plugin 0.5 or earlier also hold `designs/` (code prototypes), `tests/` and `tickets/`. Keep them as they were.

## Test files
Every test or check gets its own file. Nothing is overwritten.

Name: `YYYY-MM-DD-<tool>-<what>.md`. Screenshots and other raw output sit next to it with the same prefix.

Each file records what was tested, the tool, the design-tool link or export, the date, the results, and what to change.
