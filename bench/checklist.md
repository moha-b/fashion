# Run checklist

Copy to `bench/results/<run>/checklist.md` for each run. Every row gets an evidence path (a file in the run folder, a transcript line, or a manifest field) and one verdict:
- `pass`
- `fail`
- `not run`, with the reason
- `n/a`, with the reason

A criterion without evidence is `not run`, never `pass`.

- Run:
- Variant / commit:
- Brief:
- Operator:
- Date:
- Manifest entry:

## Direction (#8 section 1, design-only)
| # | Criterion | Where to look | Evidence | Verdict |
|---|---|---|---|---|
| 1.1 | Direction approval shows two or three design-tool alternatives with their tradeoffs. | `ux/evidence/direction-<round>/`, `state.direction`, the router's direction message | | |
| 1.2 | The chosen direction exists in the design tool and has an exported preview. | `state.direction.chosen`, its `toolRef` and export | | |
| 1.3 | No application or provider-generated code was written, downloaded or reviewed. | project tree (no code files), transcript (no HTML downloads) | | |
| 1.4 | When a backend was unavailable, the run stopped with exact setup instead of falling back. | transcript, `state.backend.status` | | |
| 1.5 | Each defining effect has a stated purpose and is specified in `ux/interactions.md`, not claimed as tested. | `ux/decisions.md`, `ux/interactions.md` | | |
| 1.6 | Critical assets are available, or placeholders are marked and listed as open questions. | brief assets list, `handoff/decisions.md` | | |

## Research contract (#8 section 2)
| # | Criterion | Where to look | Evidence | Verdict |
|---|---|---|---|---|
| 2.1 | Important research claims identify evidence and confidence/limitations. | `research/competitors.md` Evidence lines, `ux/design-systems.md` labels | | |
| 2.2 | Blocked pages and static screenshots cannot establish the absence of interactions. | any "no motion / no X" claim and its evidence | | |
| 2.3 | Direction recommendations preserve material uncertainty instead of silently upgrading it to fact. | `ux/directions.md` uncertainty per direction | | |
| 2.4 | Research includes relevant user journeys and explains what each observation means for this product. | Journey notes | | |

## Design review and handoff (#8 section 3, design-only)
| # | Criterion | Where to look | Evidence | Verdict |
|---|---|---|---|---|
| 3.1 | Visual review covers hierarchy, composition, typography, imagery, brand fit and form factors, from exported images. | `ux/visual-review-*.md` | | |
| 3.2 | Findings name observable problems and concrete edits, not generic praise or unsupported scores. | same | | |
| 3.3 | Screens share the design system; drift was fixed or recorded. | exports, `ux/design-system.md` | | |
| 3.4 | Every approved screen and relevant state has a tool reference and an export at each form factor. | `state.screens`, `handoff/README.md`, `handoff/exports/` | | |
| 3.5 | The handoff decision record is concise and includes rejected options and open questions. | `handoff/decisions.md` | | |
| 3.6 | Approvals came from the person running the run, at the four gates only. | transcript, `state.approvals` | | |

## Measurement (#8 section 4, comparison runs only)
| # | Criterion | Where to look | Evidence | Verdict |
|---|---|---|---|---|
| 4.1 | Compare the current and revised workflows on the same representative briefs and input assets. | manifest `inputs` hashes match across variants | | |
| 4.2 | Use blind preference judgments for visual quality and task-based checks for usability. | judging sheets | | |
| 4.3 | Track revision count, elapsed time, and model/tool cost alongside quality. | manifest `revisions`, `wallMs`, `humanWaitMs`, `totalCostUSD` | | |
| 4.4 | Record model versions and repeat runs to avoid drawing conclusions from one lucky result. | manifest `models`, run count per cell | | |
| 4.5 | Keep added orchestration only when it improves the measured outcome. | decision recorded against the thresholds written before the runs | | |
| 4.6 | Additional agents are justified by measured quality or delivery improvements. | step-isolation comparison, if run | | |

## Notes
Failures, blocks, retries (with reasons), and anything that needed a manual fix during the run:
