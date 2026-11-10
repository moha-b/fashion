#!/usr/bin/env node
// Evaluates the shipped prompts, not a second implementation of their state machine.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixtures = JSON.parse(readFileSync(new URL('./recovery-fixtures.json', import.meta.url), 'utf8'));
const actions = ['wait', 'collect-result', 'collect-check', 'inspect-task', 'launch-builder',
  'launch-checker', 'launch-reproducer', 'migrate-state', 'ask-user', 'report-missing-dependency', 'probe-browser',
  'use-recorded-runtime', 'stop-owned-process'];
const stateKeys = ['stage', 'attempt', 'taskId', 'branch', 'worktree', 'builtCommit',
  'mergeCommit', 'checkedCommit', 'stageStartedAt', 'updatedAt'];
const instructions = ['skills/fashion/SKILL.md', 'commands/resume.md', 'commands/setup.md',
  'agents/watchdog.md', 'agents/checker.md', 'agents/merger.md', 'agents/reproducer.md']
  .map(file => `\n### ${file}\n${readFileSync(new URL(`../plugins/fashion/${file}`, import.meta.url), 'utf8')}`)
  .join('\n');
const schema = {
  type: 'object', additionalProperties: false, required: ['decisions'],
  properties: { decisions: { type: 'array', minItems: fixtures.length, maxItems: fixtures.length, items: {
    type: 'object', additionalProperties: false,
    required: ['id', 'flag', 'action', 'stage', 'attempt', 'stateFields', 'reason'],
    properties: {
      id: { type: 'string', enum: fixtures.map(fixture => fixture.id) }, flag: { type: 'string' },
      action: { type: 'string', enum: actions }, stage: { type: ['string', 'null'] },
      attempt: { type: ['integer', 'null'] },
      stateFields: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' },
    },
  } } },
};
const prompt = `Apply the shipped Fashion instructions to each independent fixture below.
This is a decision-only regression test: do not execute tools, spawn agents, or edit files.
Each fixture has an explicit role. If role is "watchdog", classify the watchdog flag
("ok" if no flag is warranted) and recommend the router's next action.
If role is "router" or "checker", use flag "none", even when its context mentions a prior watchdog flag.
For role "checker", answer as the checker agent; otherwise answer as the router.
Never infer or change the fixture role from its context.
Choose the next immediate action and resulting stage/implementation attempt.
Action meanings: launch-* = the router dispatches that agent; probe-browser = the router runs the /fashion:setup probe;
stop-owned-process = the router runs the owned-process stop helper; use-recorded-runtime = the checker loads the recorded browser runtime
(checker role only); ask-user = stop and ask the user; wait = do nothing now.
Return exactly one decision per fixture id, no more and no fewer.
For collect-check, keep stage checking until the router compares evidence.
For migrate-state, return all and only allowed state keys in stateFields; otherwise use [].
Briefly explain each decision. Do not invent missing task inspection or user permission.
${JSON.stringify(fixtures.map(({ expected, ...input }) => input))}`;

assert.equal(new Set(fixtures.map(fixture => fixture.id)).size, fixtures.length);
for (const fixture of fixtures) {
  assert.ok(['watchdog', 'router', 'checker'].includes(fixture.role), `Missing/invalid role: ${fixture.id}`);
  assert.ok(actions.includes(fixture.expected.action));
  assert.equal(fixture.expected.flag === 'none', fixture.role !== 'watchdog', `Role/flag mismatch: ${fixture.id}`);
}

if (process.argv[2] === '--check') {
  console.log(`${fixtures.length} fixture definitions valid; no model behavior tested.`);
} else if (process.argv[2] === '--run' && process.argv[3]) {
  const directory = mkdtempSync(join(tmpdir(), 'fashion-recovery-'));
  try {
    const response = spawnSync('claude', [
      '--print', '--safe-mode', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--no-session-persistence', '--model', 'sonnet', '--max-budget-usd', '1',
      '--output-format', 'json', '--json-schema', JSON.stringify(schema),
      '--system-prompt', `You are testing Fashion workflow decisions. Follow these instructions:\n${instructions}`,
    ], { cwd: directory, input: prompt, encoding: 'utf8', timeout: 180000, maxBuffer: 4 * 1024 * 1024 });
    if (response.error) throw response.error;
    assert.equal(response.status, 0, response.stderr || response.stdout);
    const report = JSON.parse(response.stdout);
    writeFileSync(process.argv[3], JSON.stringify(report, null, 2) + '\n');
    assert.equal(report.is_error, false, report.result);
    const decisions = report.structured_output?.decisions;
    assert.ok(Array.isArray(decisions), 'No structured decisions returned');
    assert.equal(decisions.length, fixtures.length, 'Missing or extra decisions');
    assert.equal(new Set(decisions.map(decision => decision.id)).size, fixtures.length, 'Duplicate decisions');
    let failures = 0;
    for (const fixture of fixtures) {
      const decision = decisions.find(candidate => candidate.id === fixture.id);
      try {
        assert.ok(decision, `Missing ${fixture.id}`);
        const { closedState, ...expected } = fixture.expected;
        for (const [key, value] of Object.entries(expected)) assert.deepEqual(decision[key], value, key);
        if (closedState) assert.deepEqual([...decision.stateFields].sort(), [...stateKeys].sort());
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
  console.error('Usage: node tests/recovery-prompts.mjs --check | --run /absolute/path/report.json');
  process.exitCode = 2;
}
