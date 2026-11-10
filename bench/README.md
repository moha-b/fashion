# Fashion bench

Tools and protocol for #8: run the design-validation workflow live, then measure it against the old flow. Nothing in this folder ships with the plugin.

> **0.5.0 note.** Fashion is now design-only: it ends in approved design-tool artifacts, not an app. The pilot protocol below was written for the 0.4 build workflow. For 0.5 runs the phases are brief, research, direction, design and handoff, and the checklist's direction and design rows apply. A 0.4 versus 0.5 comparison compares different deliverables, so it cannot by itself support a claim that 0.5 saves time or tokens; compare equal-scope runs (same brief, through approved designs) before claiming savings.

| File | Purpose |
|---|---|
| `collect-usage.mjs` | Reads Claude Code transcripts for a run and appends a manifest entry: models, tokens per agent, wall time, human wait time, input hashes, tool versions. |
| `checklist.md` | Acceptance-to-evidence checklist. Copy it per run and give every criterion an evidence path and a verdict. |
| `briefs/` | Frozen inputs per brief: `brief.md`, `assets/`, `references/`. One folder per brief. |

## 1. Pilot (do this first)

One fresh **web** brief through all phases to an approved handoff. The goal is to show the workflow runs and to audit real research behaviour. A pilot proves nothing about quality against the old flow, and nothing about native mobile.

- **Inputs:** the plugin is not tied to one product. A pilot brief is a website URL plus what the owner wants. Images and copy come from that site (phase 1 collects them into `references/own-site/` once the owner confirms the rights). Freeze the URL, the owner's goals and the collected `references/own-site/` in `bench/briefs/<id>/` so repeated runs use the same inputs. Note the site type: a landing page is one screen; a multi-screen site starts with home and the owner picks each next screen. Define the one defining interaction.
- **Viewports:** phone 390×844 and desktop 1440×900, for every screenshot and judgement.
- **Approvals:** real ones only. The person running the pilot answers every phase question themselves. Agent-generated approval does not count.
- **Design order:** direction on one representative screen first, then the screen set; the person running the pilot approves the set before handoff.
- **Evidence:** fill a copy of `checklist.md`. A missing screenshot is an evidence gap, not a pass.

### Running it
```sh
# fresh folder, frozen inputs
cp -R bench/briefs/<id> /path/to/pilot-<id> && cd /path/to/pilot-<id>
# the plugin from the pinned commit, not the installed one
git -C /path/to/fashion worktree add /tmp/fashion-<sha> <sha>
claude --plugin-dir /tmp/fashion-<sha>/plugins/fashion
# then: /fashion:setup (readiness check), connect Stitch or Figma, /fashion:start
```
After the run, collect usage for that project. List the run's session ids in `~/.claude/projects/<encoded path>/`, or note them as you go.
```sh
node bench/collect-usage.mjs --project /path/to/pilot-<id> --run pilot-<id>-1 \
  --variant new --commit <sha> --inputs bench/briefs/<id> --session <id,id> \
  --out bench/results/manifest.json
```
- **Output folder:** `--out` creates its folder if missing.
- **Recollecting:** running it again for the same `--run` refreshes the computed usage and keeps everything you added by hand (`outcome`, `revisions`, `failures`, `evidence` and any other key).
- **Time bounds:** `--since` and `--until` are compared as instants, so fractional seconds and offsets work. Invalid bounds are an error.
- **Bad lines:** a malformed transcript line stops the collection with its file and line number. A final line still being written by a live session is only a warning, but it sets `complete: false`, makes `totalCostUSD` `unknown`, and gives `lowerBoundCostUSD` instead. Collect again after the session ends.
- **Cost** is `unknown` unless you pass `--prices prices.json` (USD per million tokens per model id: `input`, `output`, `cacheWrite5m`, `cacheWrite1h`, `cacheRead`). Use your current price sheet. Headless runs (`claude -p --output-format json`) also report `total_cost_usd`; record it next to the manifest entry.
- **Accuracy:** checked against a headless run's own totals, the Opus counts match exactly and the Sonnet counts are within 0.4%. Requests still in flight when a session exits can differ.

## 2. Old versus new (after the pilot is reliable)

- **Old:** `7d7bae6825cbbfabbac42e84431cd74376cd67ec`. **New:** the merge commit that ships the pilot fixes; record its full SHA. This compares the whole bundle, reliability fixes included, so it cannot credit a gain to the prototype step or the critic alone.
- **Isolating one step:** to judge one step (for example the visual critic), run the same commit with and without that step, functional QA kept in both. Label it as a separate comparison.
- **Same conditions:** freeze briefs, assets, references, dependencies, tool versions, model settings and the delivered scope. Use a fresh folder and session per trial. Count failed and blocked runs; never retry until one looks good.
- **Patches:** do not patch the old baseline and still call it the original. Record every experimental patch.
- **Research inputs:** for design comparisons, give both variants the same captured research (`research/`, `ux/design-systems.md`), or report the variation live browsing caused.
- **Starting scale:** 3 distinct briefs × 2 variants × 3 runs, under a total budget agreed in advance. Go smaller if the pilot shows that is too expensive.

## 3. Judging (agree on this before any results)
- **Blind and randomized:** show judges A/B in random order, without workflow or model labels, at the same viewports, content and interaction states.
- **Usability separate from looks:** score task completion, errors and time apart from visual preference.
- **Not the critic:** the in-workflow visual critic is never the only quality judge.
- **Report everything:** results per brief, ties, failures and judge disagreement. Small samples are exploratory, not proof.
- **Write these down before running:**
  - acceptable increase in time: ___
  - acceptable increase in cost: ___
  - quality gain that justifies them: ___
