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

## Prototype gate (#8 section 1)
| # | Criterion | Where to look | Evidence | Verdict |
|---|---|---|---|---|
| 1.1 | Direction approval includes rendered alternatives and an explanation of their tradeoffs. | `prototypes/review.md`, `prototypes/evidence/`, the router's direction message | | |
| 1.2 | The selected direction has a reviewed representative screen on desktop and mobile. | `ux/visual-review.md`, screenshots at 1440×900 and 390×844 | | |
| 1.3 | Component planning and broad implementation begin only after that visual baseline is accepted, unless the user explicitly waives this step. | time of the baseline yes in `ux/decisions.md` vs first `ux/components.md` write and first ticket | | |
| 1.4 | A simple prototype path does not require the full delivery workflow before visual validation. | no tickets, worktrees or merges before the baseline yes | | |
| 1.5 | One owner maintains visual coherence during initial exploration. | one prototyper task for the prototype; first screen built before any parallel screen | | |
| 1.6 | Each defining effect has a stated purpose and feasible asset plan. | `ux/decisions.md`, `ux/directions.md` | | |
| 1.7 | Critical assets are available, or an explicit fallback is accepted before broad implementation. | brief assets list, fallback decision in `ux/decisions.md` | | |
| 1.8 | High-risk effects are checked on the target mobile experience, including an appropriate reduced-motion fallback. | prototype or check evidence at 390×844 with reduced motion | | |

## Research contract (#8 section 2)
| # | Criterion | Where to look | Evidence | Verdict |
|---|---|---|---|---|
| 2.1 | Important research claims identify evidence and confidence/limitations. | `research/competitors.md` Evidence lines, `ux/design-systems.md` labels | | |
| 2.2 | Blocked pages and static screenshots cannot establish the absence of interactions. | any "no motion / no X" claim and its evidence | | |
| 2.3 | Direction recommendations preserve material uncertainty instead of silently upgrading it to fact. | `ux/directions.md` uncertainty per direction | | |
| 2.4 | Research includes relevant user journeys and explains what each observation means for this product. | Journey notes | | |

## Build and visual review (#8 section 3)
| # | Criterion | Where to look | Evidence | Verdict |
|---|---|---|---|---|
| 3.1 | Visual review explicitly covers hierarchy, composition, typography, imagery, brand fit, and responsive behavior. | `ux/visual-review*.md` | | |
| 3.2 | Findings identify observable problems and actionable changes, not generic praise or unsupported scores. | same | | |
| 3.3 | Before/after evidence is retained and unresolved findings are recorded. | `ux/evidence/final-<round>/`, ticket `history/` | | |
| 3.4 | Final review tests the complete primary user journey, not only isolated tickets. | `ux/visual-review-final-<round>.md` | | |
| 3.5 | Parallel work begins with a rendered baseline, stable shared components, and clear ownership. | board and screen order: screen 1 accepted before screen 2 tickets; `ux/components.md` | | |
| 3.6 | Screens are built one at a time, home first, and the next starts only after the user's review of the previous one. | `.fashion/state.json` `screens`, ticket creation times, the review questions | | |

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
