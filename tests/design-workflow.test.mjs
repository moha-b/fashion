// Deterministic checks for the design-only workflow: the write guard, the
// legacy state migration, and the shape of the shipped plugin.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initialState } from "../plugins/fashion/scripts/migrate-state.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plugin = path.join(repo, "plugins", "fashion");
const guard = path.join(plugin, "scripts", "design-guard.mjs");
const migrator = path.join(plugin, "scripts", "migrate-state.mjs");
const NOW = "2026-11-10T00:00:00.000Z";

function tempDir(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "fashion-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function put(root, rel, content) {
  const file = path.join(root, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

const read = (root, rel) => readFileSync(path.join(root, rel), "utf8");

function runGuard(root, agentType, filePath) {
  return spawnSync(process.execPath, [guard], {
    input: JSON.stringify({ agent_type: agentType, cwd: root, tool_name: "Write", tool_input: { file_path: filePath } }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  }).status;
}

function migrate(root, ...args) {
  const result = spawnSync(process.execPath, [migrator, "--root", root, "--now", NOW, ...args], { encoding: "utf8" });
  return { status: result.status, stderr: result.stderr, json: result.stdout.trim() ? JSON.parse(result.stdout) : null };
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const LEGACY_BUILD_STATE = {
  phase: 4, loop: 2, platform: "web", mobileStack: null, siteType: "multi", siteUrl: "https://shop.example",
  decisions: ["Editorial grid"], openQuestions: [], references: ["ref-a"],
  researcherDone: true, analystDone: true, postedCompetitors: 5,
  models: { research: "sonnet", implement: "sonnet", watchdog: "haiku" },
  git: true, maxWorkers: 3,
  screens: [{ id: "home", title: "Home", status: "building", commit: null, criticTask: null, review: null, round: 1 }],
  currentScreen: "home",
};

test("guard keeps Fashion agents to non-code files in Fashion folders", (t) => {
  const root = tempDir(t);
  const cases = [
    ["fashion:router", "ux/decisions.md", 0],
    ["fashion:router", ".fashion/state.json", 0],
    ["router", "handoff/exports/home-default-desktop.png", 0],
    ["fashion:router", ".claude/settings.json", 0],
    ["fashion:researcher", "research/competitors.md", 0],
    ["fashion:visual-critic", "ux/visual-review-design-1.md", 0],
    ["fashion:router", "src/app/page.tsx", 2],
    ["fashion:router", "package.json", 2],
    ["fashion:router", "handoff/index.html", 2],
    ["fashion:router", "ux/prototype.css", 2],
    ["fashion:router", "tickets/board.md", 2],
    ["fashion:router", "prototypes/review.md", 2],
    ["fashion:researcher", "lib/main.dart", 2],
    ["fashion:visual-critic", "app/page.tsx", 2],
    ["fashion:router", "../outside.md", 2],
    ["general-purpose", "src/app/page.tsx", 0],
    [undefined, "src/app/page.tsx", 0],
  ];
  for (const [agent, file, expected] of cases) {
    assert.equal(runGuard(root, agent, path.join(root, file)), expected, `${agent} writing ${file}`);
  }
  assert.equal(runGuard(root, "fashion:router", "ux/notes.md"), 0, "relative path inside ux/");
  assert.equal(runGuard(root, "fashion:router", "src/notes.md"), 2, "relative path outside the Fashion folders");
});

test("guard fails open on unreadable input", () => {
  assert.equal(spawnSync(process.execPath, [guard], { input: "not json", encoding: "utf8" }).status, 0);
});

test("a legacy build-phase project migrates without touching build artifacts", (t) => {
  const root = tempDir(t);
  put(root, ".fashion/state.json", LEGACY_BUILD_STATE);
  put(root, "tickets/T00-scaffold/state.json", { stage: "done", taskId: null });
  put(root, "tickets/T03-hero/state.json", { stage: "building", taskId: "builder-7" });
  put(root, "tickets/board.md", "# Board\n");
  put(root, "prototypes/evidence/a-desktop.png", "png");
  put(root, ".fashion/processes/T03-hero-builder-a1-4242.json", {
    owner: "T03-hero", role: "builder", pid: 4242, port: 3000, command: ["npm", "run", "dev"], status: "running",
  });
  put(root, "research/competitors.md", "## A\n");
  const original = read(root, ".fashion/state.json");
  const before = Object.fromEntries(["tickets/T03-hero/state.json", "tickets/board.md", "prototypes/evidence/a-desktop.png",
    ".fashion/processes/T03-hero-builder-a1-4242.json"].map((rel) => [rel, read(root, rel)]));

  const first = migrate(root);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.json.migrated, true);
  const state = JSON.parse(read(root, ".fashion/state.json"));
  assert.deepEqual(Object.keys(state).sort(), Object.keys(initialState()).sort(), "closed state contract");
  assert.equal(state.schema, 2);
  assert.equal(state.phase, "direction");
  assert.equal(state.approvals.brief, true);
  assert.equal(state.approvals.direction, false);
  assert.equal(state.research.status, "done");
  assert.equal(state.models.research, "sonnet");
  assert.deepEqual(state.models, { research: "sonnet", critic: "sonnet" });
  assert.deepEqual(state.decisions, ["Editorial grid"]);
  assert.deepEqual(state.screens, [{ id: "home", title: "Home", states: ["default"], frames: [], status: "planned", round: 0 }]);
  assert.equal(state.legacy.fromPhase, 4);
  assert.equal(state.legacy.recreateBaseline, true);
  assert.deepEqual(state.legacy.activeTickets, [{ id: "T03-hero", stage: "building", taskId: "builder-7" }]);
  assert.equal(state.legacy.processRecords.length, 1);
  assert.deepEqual(state.legacy.prototypeScreenshots, ["prototypes/evidence/a-desktop.png"]);
  assert.equal(read(root, state.legacy.archive), original, "archive keeps the original bytes");
  for (const [rel, content] of Object.entries(before)) assert.equal(read(root, rel), content, `${rel} untouched`);
  assert.match(read(root, ".fashion/migration.md"), /nothing was built, merged, checked, stopped or deleted/);

  const migrated = read(root, ".fashion/state.json");
  const second = migrate(root);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(second.json.migrated, false);
  assert.equal(read(root, ".fashion/state.json"), migrated, "a second resume does not migrate again");
});

test("legacy research and interview phases map to their design phases", (t) => {
  const partial = tempDir(t);
  put(partial, ".fashion/state.json", { phase: 2, researcherDone: true, analystDone: false });
  put(partial, "research/competitors.md", "## A\n");
  assert.equal(migrate(partial).status, 0);
  let state = JSON.parse(read(partial, ".fashion/state.json"));
  assert.equal(state.phase, "research");
  assert.equal(state.research.status, "partial");
  assert.equal(state.approvals.brief, true);

  const empty = tempDir(t);
  put(empty, ".fashion/state.json", { phase: 2, researcherDone: false, analystDone: false });
  assert.equal(migrate(empty).status, 0);
  assert.equal(JSON.parse(read(empty, ".fashion/state.json")).research.status, "pending");

  const interview = tempDir(t);
  put(interview, ".fashion/state.json", { phase: 1 });
  assert.equal(migrate(interview).status, 0);
  state = JSON.parse(read(interview, ".fashion/state.json"));
  assert.equal(state.phase, "brief");
  assert.equal(state.approvals.brief, false);
});

test("a finished legacy project stays done and is flagged, not rebuilt", (t) => {
  const root = tempDir(t);
  put(root, ".fashion/state.json", { ...LEGACY_BUILD_STATE, phase: "done" });
  assert.equal(migrate(root).status, 0);
  const state = JSON.parse(read(root, ".fashion/state.json"));
  assert.equal(state.phase, "done");
  assert.equal(state.legacy.completedUnderBuildWorkflow, true);
  assert.equal(state.approvals.handoff, false);
});

test("mobile code stacks become a mobile OS or an open question", (t) => {
  const swift = tempDir(t);
  put(swift, ".fashion/state.json", { phase: 3, platform: "mobile", mobileStack: "swiftui" });
  assert.equal(migrate(swift).status, 0);
  assert.equal(JSON.parse(read(swift, ".fashion/state.json")).mobileOS, "ios");

  const flutter = tempDir(t);
  put(flutter, ".fashion/state.json", { phase: 3, platform: "mobile", mobileStack: "flutter" });
  assert.equal(migrate(flutter).status, 0);
  const state = JSON.parse(read(flutter, ".fashion/state.json"));
  assert.equal(state.mobileOS, null);
  assert.ok(state.openQuestions.some((q) => q.startsWith("Mobile OS")));
});

test("dry run writes nothing; bad input fails without changes", (t) => {
  const root = tempDir(t);
  put(root, ".fashion/state.json", LEGACY_BUILD_STATE);
  const original = read(root, ".fashion/state.json");
  const dry = migrate(root, "--dry-run");
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(dry.json.dryRun, true);
  assert.equal(dry.json.phase, "direction");
  assert.equal(read(root, ".fashion/state.json"), original);
  assert.equal(existsSync(path.join(root, ".fashion/legacy")), false);
  assert.equal(existsSync(path.join(root, ".fashion/migration.md")), false);

  const missing = tempDir(t);
  assert.equal(migrate(missing).status, 2);

  const unknown = tempDir(t);
  put(unknown, ".fashion/state.json", { phase: 7 });
  const before = read(unknown, ".fashion/state.json");
  assert.equal(migrate(unknown).status, 3);
  assert.equal(read(unknown, ".fashion/state.json"), before);

  const broken = tempDir(t);
  put(broken, ".fashion/state.json", "{ not json");
  assert.equal(migrate(broken).status, 3);

  const future = tempDir(t);
  put(future, ".fashion/state.json", { schema: 3, phase: "brief" });
  assert.equal(migrate(future).status, 3);
});

test("only the design-only agents, skills, commands and scripts ship", () => {
  const list = (dir) => readdirSync(path.join(plugin, dir)).sort();
  assert.deepEqual(list("agents"), ["researcher.md", "router.md", "visual-critic.md"]);
  assert.deepEqual(list("skills"), ["fashion", "grilling"]);
  assert.deepEqual(list("commands"), ["resume.md", "setup.md", "start.md", "status.md"]);
  assert.deepEqual(list("scripts"), ["design-guard.mjs", "migrate-state.mjs"]);
  assert.equal(existsSync(path.join(plugin, "vendor")), false);
});

test("config files parse and match the design-only setup", () => {
  const json = (rel) => JSON.parse(readFileSync(path.join(repo, rel), "utf8"));
  assert.deepEqual(Object.keys(json("plugins/fashion/.mcp.json").mcpServers).sort(), ["awwwards", "dembrandt", "inspo"]);
  const command = json("plugins/fashion/hooks/hooks.json").hooks.PreToolUse[0].hooks[0].command;
  assert.match(command, /scripts\/design-guard\.mjs/);
  assert.ok(statSync(guard).isFile());
  assert.equal(json("plugins/fashion/settings.json").agent, "fashion:router");
  const allow = json("plugins/fashion/templates/settings.json").permissions.allow;
  assert.ok(!allow.some((entry) => /responsively|delete_project|generate_|edit_screens/.test(entry)), "only read-only design tools are pre-allowed");
  const manifest = json("plugins/fashion/.claude-plugin/plugin.json");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(json(".claude-plugin/marketplace.json").plugins[0].name, manifest.name);
});

test("the skill's state.json block is the migrator's initial state", () => {
  const skill = read(plugin, "skills/fashion/SKILL.md");
  const block = skill.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(block, "no json block in SKILL.md");
  assert.deepEqual(JSON.parse(block[1]), initialState());
});

test("shipped prompts have frontmatter and never dispatch the retired build workflow", () => {
  const retired = ["fashion:builder", "fashion:merger", "fashion:checker", "fashion:reproducer", "fashion:watchdog",
    "fashion:prototyper", "fashion:competitor-researcher", "fashion:ux-analyst", "fashion:ticket", "owned-process.mjs",
    "create-next-app", "flutter create", "isolation: \"worktree\""];
  const markdown = walk(plugin).filter((file) => file.endsWith(".md"));
  assert.ok(markdown.length >= 9);
  for (const file of markdown) {
    const text = readFileSync(file, "utf8");
    const name = path.relative(repo, file);
    if (/\/(agents|commands|skills)\//.test(file)) assert.match(text, /^---\n[\s\S]*?description: .+[\s\S]*?\n---\n/, `${name} frontmatter`);
    for (const term of retired) assert.ok(!text.includes(term), `${name} mentions ${term}`);
  }
});
