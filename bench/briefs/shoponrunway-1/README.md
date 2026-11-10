# Pilot brief: shoponrunway-1

Frozen inputs for the first #8 pilot run.

- **Site:** https://shoponrunway.com (HTTP 200 on 2026-11-10)
- **Owner's goals:** given live during phase 1. After the run they are copied from the pilot's `.fashion/brief.md` into `brief.md` here.
- **Images and copy:** collected by phase 1 into the pilot's `references/own-site/`, only if the owner confirms the rights. After the run that folder is copied into `own-site/` here, so repeat runs use the same files.
- **robots.txt on 2026-11-10:** `User-agent: *` with `Allow: /` and `Content-Signal: search=yes,ai-train=no,use=reference`. `ClaudeBot` and several other AI crawlers are disallowed. The pilot's capture tools are not those crawlers and train on nothing, but reusing the images still needs the owner's confirmation.
- **Plugin under test:** commit `3996015ae52c83122d3ec2a0ee5a0122f3c6fe77` (PR #10, version 0.4.0), loaded with `--plugin-dir` from a detached worktree.
- **Pilot folder:** `/Users/hab/Development/projects/pilots/shoponrunway-1`. Fresh, with no files from the earlier Shop on Runway work.
- **Viewports:** phone 390×844, desktop 1440×900.
- **Known history:** the same site was used in earlier sessions (old flow, and test copies). Those files are not in the pilot folder, so the pilot does not start from them, but the operator has seen earlier directions. Treat the pilot as a workflow check, not a fresh-eyes quality judgement.
