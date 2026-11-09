# results/

One folder per project. Each project folder holds everything for that project:

```
results/<project>/
  .claude/settings.json   tool permissions used for this project
  .fashion/               brief.md and state.json
  research/               competitors.md
  ux/                     design-systems.md, directions.md, decisions.md
  references/<slug>/      captures and notes.md for each reference
  tests/                  research-phase tests and checks
  designs/
    design-1-<name>/      a full prototype (its own app)
      tests/              tests and checks for this design only
    design-2-<name>/
    ...
```

## Test files
Every test or check gets its own file. Nothing is overwritten.

Name: `YYYY-MM-DD-<tool>-<what>.md`. Screenshots and other raw output sit next to it with the same prefix.

Each file records what was tested, the tool, the URL or build, the date, the results, and what to fix.
