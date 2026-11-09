---
description: One-time setup per machine. Installs the design skills globally and checks prerequisites.
disable-model-invocation: true
---

Set up the design skills and check prerequisites. Safe to rerun.

## 1. Plan (read only)
Skills to install into `~/.agents/skills/<name>`, each symlinked from `~/.claude/skills/<name>` (relative link `../../.agents/skills/<name>`):

Bundled with this plugin (copied from `${CLAUDE_PLUGIN_ROOT}/vendor/skills/`):
- `scrollcraft` (MIT)
- `bang-motion` (MIT)

Fetched from their public upstream at a pinned commit (list in `${CLAUDE_PLUGIN_ROOT}/vendor/skills/upstream.json`, fetched with `${CLAUDE_PLUGIN_ROOT}/scripts/fetch-skill.sh`):
- `design-taste-frontend`, `hallmark`, `app-store-screenshots`, `brag-slim`, `clean-code-guard` (all MIT)

For each skill, check the state:
- Missing in `~/.agents/skills/<name>`: will install.
- Present and identical (`diff -r`; for upstream skills fetch to a temp dir first): skip.
- Present and different: show the version line from both `SKILL.md` files (or the file diff summary) and mark "ask".
- Symlink missing or pointing elsewhere: will fix, but ask if it points elsewhere.

Also check `~/.agents/skills/grill-me/SKILL.md`. If its body only says to call the Skill tool with `grilling`, mark "offer to repoint at `fashion:grilling`".

## 2. Confirm once
Show the full table (skill, source, action, target path). State that this writes to your home directory. Ask once: proceed? Do nothing until the user says yes. Then ask separately for each "ask" row.

## 3. Install
- Bundled: copy the folder from the plugin. For `scrollcraft`, the copy already points at `$HOME/.agents/skills/scrollcraft`; do not edit it.
- Upstream: run `fetch-skill.sh <repo> <sha> <path> ~/.agents/skills/<name>` for each. Fetch to a temp dir and replace only after the user approved a "ask" row.
- Create the symlink with `ln -s ../../.agents/skills/<name> ~/.claude/skills/<name>` if missing.
- Grill-me: if the user agreed, change only the line that calls `grilling` to call the Skill tool with `fashion:grilling`. Otherwise leave it.
- Never delete anything. Never overwrite without a yes.

## 4. Prerequisites
Check and report. Install nothing yourself; give the command and let the user run it.
- `node` and `npx` (`node --version`). Needed by the MCP servers and web builds.
- Browser fallback for prototype captures, checker keyboard interactions, saved review evidence, and awwwards capture: identify a named real-browser tool and prove it works. A CLI version alone does not prove a module resolves or a browser launches. An awwwards-managed install does not make `import('playwright')` available to project scripts.
- For project-local Playwright, run this probe from the project root with a 30-second command timeout. It installs nothing. Report module, launch, keyboard or screenshot errors separately:
  ```sh
  node --input-type=module <<'JS'
  import { mkdtempSync, statSync, rmSync } from 'node:fs';
  import { tmpdir } from 'node:os';
  import { join } from 'node:path';
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ timeout: 10000 });
  let evidence;
  try {
    evidence = mkdtempSync(join(tmpdir(), 'fashion-browser-'));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(5000);
    await page.setContent('<button>Test</button><output></output><script>document.onkeydown = e => document.querySelector("output").textContent = e.key;</script>');
    await page.keyboard.press('Tab');
    if (await page.locator('button').evaluate(button => button !== document.activeElement)) throw new Error('Tab focus failed');
    await page.keyboard.press('Escape');
    if (await page.locator('output').textContent() !== 'Escape') throw new Error('Escape failed');
    const screenshot = join(evidence, 'probe.png');
    await page.screenshot({ path: screenshot });
    if (!statSync(screenshot).size) throw new Error('Screenshot file empty');
    console.log('Playwright fallback ready: Chromium, viewport, Tab, Escape, saved screenshot');
  } finally {
    try { await browser.close(); }
    finally { if (evidence) rmSync(evidence, { recursive: true }); }
  }
  JS
  ```
- If the module is missing, suggest `npm install --save-dev playwright` in that project (adapt to its package manager). If the browser binary is missing, suggest `npx playwright install chromium` after the module is installed. Give commands only; do not install. For another real-browser tool, run equivalent capability checks through that tool. Record tool/runtime, working directory, capabilities and gaps. See the [Playwright library installation guide](https://playwright.dev/docs/library).
- Setup outside a project reports machine capabilities only. Repeat the probe in the actual project before phase 3 prototypes and phase 4 checks. Report missing fallback early even when Responsively works, since keyboard or saved-file coverage may still need it.
- Web builds: `git`.
- Mobile, only if the user says which stack they use: Xcode (`xcodebuild -version`) for SwiftUI; Flutter (`flutter --version`) for Flutter.

## 5. Report
List what was installed, skipped, asked about, and what is missing. Say: run `/fashion:start` in the folder of the product. A new session may be needed before newly installed skills show up.
