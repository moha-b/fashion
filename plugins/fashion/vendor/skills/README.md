# Skills used by Fashion

These live under `vendor/skills/`, not `skills/`, so Claude Code does not load them a second time as `fashion:*`. `/fashion:setup` installs them into `~/.agents/skills/`.

## Bundled in this repo (MIT, licence file kept in each folder)

| Skill | Source | Pinned | Local change |
|---|---|---|---|
| `scrollcraft` | github.com/singhharsh1708/scrollcraft, `plugins/scrollcraft/skills/scrollcraft` | commit `7302ab2` (2026-10-26) | In `SKILL.md`, `$(git rev-parse --show-toplevel)/.agents/skills/scrollcraft` is replaced with `$HOME/.agents/skills/scrollcraft`, because setup installs it there. `$HOME` is used so it expands inside double quotes. |
| `bang-motion` | github.com/bangtutorial/bang-motion | 1.19.0, commit `c1aa65e` (2026-09-15) | `docs/` (gallery images) and the plugin manifest left out. |

## Installed from upstream by `/fashion:setup` (not stored here)

Pinned commits are in `upstream.json`. All five upstream repos are public and MIT-licensed (checked on GitHub).

| Skill | Upstream | Pinned commit |
|---|---|---|
| `design-taste-frontend` (tasteskill) | github.com/Leonxlnx/taste-skill, `skills/taste-skill` | `f6b7657` (upstream is 2.5.1) |
| `hallmark` | github.com/Nutlope/hallmark, `skills/hallmark` | `407fa68` |
| `app-store-screenshots` | github.com/ParthJadhav/app-store-screenshots | `e889033` |
| `brag-slim` | github.com/latent-spaces/brag, `skills/brag-slim` | `669ab92` |
| `clean-code-guard` | github.com/amElnagdy/guard-skills, `skills/clean-code-guard` | `ffa2603` |

Why not bundled: the upstream repos change often, and `app-store-screenshots` includes Apple device bezels that Apple licenses for Apple-platform mock-ups only. Each upstream repo carries its own LICENSE.

The orchestrator works without any of them. If one is missing, it says so and continues.
