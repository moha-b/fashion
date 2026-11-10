# Run checklist: shoponrunway-1-pilot

- **Run:** shoponrunway-1-pilot
- **Variant / commit:** new, `3996015ae52c83122d3ec2a0ee5a0122f3c6fe77` (PR #10, plugin 0.4.0, loaded with `--plugin-dir`, installed 0.1.0 disabled)
- **Brief:** `bench/briefs/shoponrunway-1/` (https://shoponrunway.com)
- **Operator:** owner gave every approval live. The evidence below was assembled from the run's files and transcript afterwards.
- **Date:** 2026-11-10, 05:37 to 11:12 UTC
- **Manifest entry:** `bench/results/manifest.json`, run `shoponrunway-1-pilot`
- **Pilot folder:** `/Users/hab/Development/projects/pilots/shoponrunway-1` (local; not committed)
- **Session:** `2eb2d10d-bd06-4aee-968e-80b52e147ab5`

## Outcome
**Stopped by the owner, design rejected.** At 11:10 the router started the accepted baseline prototype on `http://localhost:3417` because the owner asked for a link to open in Safari. At 11:11 the owner wrote: "stop any agent working in background the design sucks".

The run was in phase 4 at that point:
- **Home screen:** `building`.
- **T00-scaffold and T01-tokens:** done and merged.
- **T02-primitives:** killed mid-build and set to `blocked` (attempt not incremented, worktree kept).
- **T03–T10:** `ready`, never started.

The router's last question ("What's wrong with it?") was not answered. No screen review and no final review ran.

**Root cause:** the owner approved the direction, the variant and the visual baseline without ever seeing a render. Rendered screenshots existed in `prototypes/evidence/`, but every approval question showed text instead:
- **06:32, direction:** ASCII sketches in the question options.
- **07:12, variant:** the critic's pixel measurements.
- **07:36, baseline:** contrast and overflow numbers.

The first time the owner could open the design was 11:10, about 3.5 hours after accepting it. The router said so afterwards: "The measured stuff passed. Looking good is a different question, and measurements never answered it."

## Time and usage
- **Wall time:** 5.58 h.
  - **Waiting for the owner:** 0.91 h (10 questions answered).
  - **Paused by a usage limit:** 2.35 h.
  - **Agents working:** about 2.3 h.
- **Opus:** 222 requests, 222k output tokens (router 157k, ux-analyst 41k, competitor-researcher 24k).
- **Sonnet:** 519 requests, 395k output tokens (prototyper 154k, builder 136k, checker 42k, visual-critic 34k, merger 21k, watchdog 6k).
- **Cost:** `unknown`. No price sheet was supplied, and it is never recorded as 0.
- **Prototype rounds:** 2 (variants A and B, then a converged revision). The critic reviewed round 1 only. The converged baseline was checked by the router's own reading of the measurements, not by a critic.

## Prototype gate (#8 section 1)
| # | Criterion | Evidence | Verdict |
|---|---|---|---|
| 1.1 | Direction approval includes rendered alternatives and an explanation of their tradeoffs. | Renders existed (`prototypes/evidence/variant-{a,b}-{desktop,mobile}.png`), and the tradeoffs were explained in text. But the direction was picked at 06:32 from ASCII previews in the question options, before any render existed. The variant was picked at 07:12 from measurements, with no link or screenshot given. | **fail**: rendered, but never shown to the person approving |
| 1.2 | The selected direction has a reviewed representative screen on desktop and mobile. | Converged baseline renders: `converged-desktop.png` (1440 wide) and `converged-mobile.png` (390 wide). `ux/visual-review-prototype-1.md` reviews round 1 only. The converged page had no critic review, and the owner did not see it before accepting. | **fail** |
| 1.3 | Component planning and broad implementation begin only after that visual baseline is accepted, unless the user explicitly waives this step. | Baseline "accepted" at 07:36:41 (transcript). `ux/components.md` and the screen list followed in commit `0647b07`, then tickets in `067934a`. The order was right, but the acceptance was uninformed (see 1.1). | **pass** (formally) |
| 1.4 | A simple prototype path does not require the full delivery workflow before visual validation. | Prototypes live in `prototypes/app` with no tickets, worktrees or merges. Git was initialized only at 07:36, after the baseline. | **pass** |
| 1.5 | One owner maintains visual coherence during initial exploration. | One prototyper per round (`.fashion/processes/prototype-prototyper-a{1,2}-*`), and the home screen was the only screen ticketed. | **pass** |
| 1.6 | Each defining effect has a stated purpose and feasible asset plan. | `.fashion/state.json` decisions record the signature moment (scroll-linked sand-to-black ground), its purpose (brand perception), and the asset plan (background removal, full-res re-exports, men's FW26 re-crop). Direction 5 was ruled out for lack of photography. | **pass** |
| 1.7 | Critical assets are available, or an explicit fallback is accepted before broad implementation. | "No new photography" was recorded, but no hero asset was named. Afterwards the router said the fold photo is a cropped product shot "doing hero work because no hero asset exists". That fallback was never put to the owner as a decision. | **fail** |
| 1.8 | High-risk effects are checked on the target mobile experience, including an appropriate reduced-motion fallback. | Reduced-motion was captured at 1440×900 only (`*-transition-reduced-motion.png`). The prototype report argues that a scroll-driven colour change needs no fallback. No mobile capture of the transition. | **not run** (mobile) |

## Research contract (#8 section 2)
| # | Criterion | Evidence | Verdict |
|---|---|---|---|
| 2.1 | Important research claims identify evidence and confidence/limitations. | `research/competitors.md`: 12 entries, 12 `Evidence:` lines (15 observed, 11 inferred, 7 unknown). `ux/design-systems.md`: 40 observed, 15 inferred, 11 unknown labels, each with its limitation. | **pass** |
| 2.2 | Blocked pages and static screenshots cannot establish the absence of interactions. | `ux/design-systems.md` L15–17 state both rules. L163: "This is not an absence claim about the site, only about the home page." L171 limits the motion claim to what the capture could see. | **pass** |
| 2.3 | Direction recommendations preserve material uncertainty instead of silently upgrading it to fact. | Every direction in `ux/directions.md` has "Risk / uncertainty". Tan & Black's names the risk that later happened: a warm sand palette "can slide from 'curated' into 'bohemian' or 'dated'". | **pass** |
| 2.4 | Research includes relevant user journeys and explains what each observation means for this product. | 12 `Journey note:` lines. Each direction has "Primary task supported". | **pass** |

## Build and visual review (#8 section 3)
| # | Criterion | Evidence | Verdict |
|---|---|---|---|
| 3.1 | Visual review explicitly covers hierarchy, composition, typography, imagery, brand fit, and responsive behavior. | `ux/visual-review-prototype-1.md` tests the direction's named risks by measurement (seam gradient, contrast, overflow). The words hierarchy, composition, typography and responsive do not appear, and brand fit and imagery are mentioned once each. It never judged whether the page looks premium; the sand was tested as a seam, not as a colour. | **fail** |
| 3.2 | Findings identify observable problems and actionable changes, not generic praise or unsupported scores. | Findings are concrete and measured, for example: the contrast of "TWENTY DESIGNERS. ONE ADDRESS." is 1.59–2.65:1; variant B overflows (scrollWidth 1504 vs 1440). Top 3 fixes are listed. | **pass** |
| 3.3 | Before/after evidence is retained and unresolved findings are recorded. | Variant and converged screenshots are kept side by side, and the unresolved Off Duty orphan was recorded as T08. | **pass** (prototype rounds) |
| 3.4 | Final review tests the complete primary user journey, not only isolated tickets. | Not reached. | **not run** |
| 3.5 | Parallel work begins with a rendered baseline, stable shared components, and clear ownership. | T00 to T01 to T02 ran as a chain, with section tickets blocked by T02. Parallel work had not started when the run was stopped. | **not run** |
| 3.6 | Screens are built one at a time, home first, and the next starts only after the user's review of the previous one. | `state.screens`: home `building`, the 4 others `planned`, and only home tickets exist. No review was reached. | **pass** (partial: no screen transition observed) |

## Measurement (#8 section 4)
Comparison runs only. Not started. All six (4.1–4.6) are **not run**.

## Other findings from the run
- **Approvals without a render (root cause above).** Fix in the plugin: before any visual approval, the router starts the preview through the owned-process helper and gives the owner the localhost URL(s) and screenshot paths. It asks only after the owner says they opened it, and offers "not right yet" as a full option.
- **The critic measured; it did not judge looks.** The critic needs an explicit aesthetic verdict against the brief and references ("does this read premium / curated?"), and must review the converged baseline too, not only round 1.
- **The builder still writes `log.md` and `result.md` into its worktree copy of `tickets/`.** They reach the root only at merge, so the root heartbeat stays empty during a build. This time the watchdog found the worktree log itself (T01, 10:49). It was also seen in the #1 tests.
- **The prototype report was named `prototypes/report.md`,** not `prototypes/review.md` as `agents/prototyper.md` specifies.
- **A usage limit paused the run for 2.35 h** (an auto-continuation at 10:31). The run recovered and continued.
- **Disk was at 99%** before parallel builders started. The router asked; the owner said there was space.
- **Stopping went cleanly.** On "stop": the builder task was killed, the owned processes were stopped (exit 0), the preview server was killed, T02 was set to `blocked` without incrementing the attempt, and the worktree and branch were kept. No commits were lost.

## Notes
- **Owner's answers:** 10 questions, all answered with the recommended option except the direction choice (Tan & Black, pure, over the recommended hybrid).
- **Image rights:** the owner confirmed the right to reuse shoponrunway.com's own images and copy. The 42 images are kept in the local pilot folder only. This public repo gets `own-site-sources.md` and `own-site.sha256`, not the images.
