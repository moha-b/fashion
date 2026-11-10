#!/usr/bin/env node
// Decision regression for the design-only workflow. It sends the shipped
// prompts and synthetic fixtures to Claude and compares the router's chosen
// next action and resulting phase. It evaluates the prompts, not a second
// implementation of the workflow.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const fixtures = JSON.parse(readFileSync(new URL("./decision-fixtures.json", import.meta.url), "utf8"));
const actions = ["migrate-state", "report-setup", "launch-researcher", "reuse-research", "capture-reference",
  "generate-directions", "inspect-tool-state", "export-previews", "launch-visual-critic", "generate-screens",
  "edit-screens", "write-handoff", "ask-user", "mark-done", "decline-code", "wait"];
const phases = ["brief", "research", "direction", "design", "handoff", "done"];
const instructions = ["skills/fashion/SKILL.md", "commands/resume.md", "commands/setup.md",
  "agents/router.md", "agents/visual-critic.md"]
  .map((file) => `\n### ${file}\n${readFileSync(new URL(`../plugins/fashion/${file}`, import.meta.url), "utf8")}`)
  .join("\n");
const schema = {
  type: "object", additionalProperties: false, required: ["decisions"],
  properties: { decisions: { type: "array", minItems: fixtures.length, maxItems: fixtures.length, items: {
    type: "object", additionalProperties: false, required: ["id", "action", "phase", "reason"],
    properties: {
      id: { type: "string", enum: fixtures.map((fixture) => fixture.id) },
      action: { type: "string", enum: actions },
      phase: { type: "string", enum: phases },
      reason: { type: "string" },
    },
  } } },
};
const prompt = `Apply the shipped Fashion instructions to each independent fixture below, answering as the fashion router.
This is a decision-only regression test: do not execute tools, spawn agents, or edit files.
For each fixture choose the router's next immediate action, and the phase recorded in .fashion/state.json after that action.
Action meanings: migrate-state = run scripts/migrate-state.mjs; report-setup = stop and give the user the exact design-backend setup;
launch-researcher = dispatch fashion:researcher; reuse-research = use saved research instead of researching again;
capture-reference = save a user reference with awwwards into references/<slug>/; generate-directions = create direction candidates in the design tool;
inspect-tool-state = read the design tool's existing projects or screens before retrying; export-previews = save image previews from the design tool;
launch-visual-critic = dispatch fashion:visual-critic; generate-screens = create screens or states in the design tool;
edit-screens = revise existing design-tool screens; write-handoff = write the handoff/ package; ask-user = stop at a gate or for a blocking choice;
mark-done = set phase done; decline-code = say application code is outside Fashion and offer the design handoff instead; wait = do nothing now.
Return exactly one decision per fixture id, no more and no fewer. Briefly explain each decision.
Do not invent tool results or user permission.
${JSON.stringify(fixtures.map(({ expected, ...input }) => input))}`;

assert.equal(new Set(fixtures.map((fixture) => fixture.id)).size, fixtures.length, "Duplicate fixture id");
for (const fixture of fixtures) {
  assert.ok(typeof fixture.context === "string" && fixture.context.length > 0, `Missing context: ${fixture.id}`);
  assert.ok(actions.includes(fixture.expected.action), `Unknown action: ${fixture.id}`);
  assert.ok(phases.includes(fixture.expected.phase), `Unknown phase: ${fixture.id}`);
}

if (process.argv[2] === "--check") {
  console.log(`${fixtures.length} fixture definitions valid; no model behavior tested.`);
} else if (process.argv[2] === "--run" && process.argv[3]) {
  const directory = mkdtempSync(join(tmpdir(), "fashion-decisions-"));
  try {
    const response = spawnSync("claude", [
      "--print", "--safe-mode", "--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
      "--no-session-persistence", "--model", "sonnet", "--max-budget-usd", "1",
      "--output-format", "json", "--json-schema", JSON.stringify(schema),
      "--system-prompt", `You are testing Fashion workflow decisions. Follow these instructions:\n${instructions}`,
    ], { cwd: directory, input: prompt, encoding: "utf8", timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    if (response.error) throw response.error;
    assert.equal(response.status, 0, response.stderr || response.stdout);
    const report = JSON.parse(response.stdout);
    writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + "\n");
    assert.equal(report.is_error, false, report.result);
    const decisions = report.structured_output?.decisions;
    assert.ok(Array.isArray(decisions), "No structured decisions returned");
    assert.equal(decisions.length, fixtures.length, "Missing or extra decisions");
    assert.equal(new Set(decisions.map((decision) => decision.id)).size, fixtures.length, "Duplicate decisions");
    let failures = 0;
    for (const fixture of fixtures) {
      const decision = decisions.find((candidate) => candidate.id === fixture.id);
      try {
        assert.ok(decision, `Missing ${fixture.id}`);
        for (const [key, value] of Object.entries(fixture.expected)) assert.deepEqual(decision[key], value, key);
        console.log(`PASS ${fixture.id}`);
      } catch (error) {
        if (!(error instanceof assert.AssertionError)) throw error;
        failures++;
        console.error(`FAIL ${fixture.id}: ${error.message}\n${JSON.stringify(decision)}`);
      }
    }
    console.log(`${fixtures.length - failures}/${fixtures.length} passed; cost $${report.total_cost_usd}; duration ${report.duration_ms}ms`);
    process.exitCode = failures ? 1 : 0;
  } finally {
    rmSync(directory, { recursive: true });
  }
} else {
  console.error("Usage: node tests/decision-prompts.mjs --check | --run /absolute/path/report.json");
  process.exitCode = 2;
}
