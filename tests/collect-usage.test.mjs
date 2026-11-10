// Tests for bench/collect-usage.mjs on synthetic Claude Code transcripts.
// Run: node --test tests/collect-usage.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { collect } from "../bench/collect-usage.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "fashion-usage-"));
after(() => rmSync(dir, { recursive: true, force: true }));

const usage = (input, output, read = 0, w5 = 0, w1 = 0) => ({
  input_tokens: input, output_tokens: output, cache_read_input_tokens: read,
  cache_creation_input_tokens: w5 + w1, cache_creation: { ephemeral_5m_input_tokens: w5, ephemeral_1h_input_tokens: w1 },
});
const assistant = (ts, requestId, model, u, extra = {}) => ({ type: "assistant", timestamp: ts, requestId, effort: "high", message: { model, usage: u }, ...extra });
const user = (ts, content, extra = {}) => ({ type: "user", timestamp: ts, message: { content }, ...extra });
const write = (file, entries) => writeFileSync(file, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");

// Session A: one request written as two lines (same requestId), a skill text turn,
// a task notification, a tool result, and one real human reply after 60 s.
write(path.join(dir, "A.jsonl"), [
  user("2026-11-10T10:00:00.000Z", "/fashion:start"),
  user("2026-11-10T10:00:00.500Z", [{ type: "text", text: "skill body" }], { isMeta: true }),
  assistant("2026-11-10T10:00:01.000Z", "r1", "claude-opus-5", usage(10, 50, 1000, 200, 300)),
  assistant("2026-11-10T10:00:02.000Z", "r1", "claude-opus-5", usage(10, 50, 1000, 200, 300)),
  user("2026-11-10T10:00:03.000Z", [{ type: "tool_result", content: "ok" }]),
  assistant("2026-11-10T10:00:04.000Z", "r2", "claude-opus-5", usage(5, 20)),
  user("2026-11-10T10:00:30.000Z", "<task-notification>done</task-notification>", { origin: { kind: "task-notification" } }),
  user("2026-11-10T10:01:04.000Z", "yes, go"),
  assistant("2026-11-10T10:01:05.000Z", "r3", "claude-opus-5", usage(5, 30)),
]);
mkdirSync(path.join(dir, "A", "subagents"), { recursive: true });
write(path.join(dir, "A", "subagents", "agent-x1.jsonl"), [
  assistant("2026-11-10T10:00:10.000Z", "s1", "claude-sonnet-5", usage(1, 100, 5000), { isSidechain: true }),
  assistant("2026-11-10T10:00:20.000Z", "s2", "claude-sonnet-5", usage(1, 200, 6000), { isSidechain: true }),
]);
writeFileSync(path.join(dir, "A", "subagents", "agent-x1.meta.json"), JSON.stringify({ agentType: "fashion:builder" }));
// Session B: another run in the same project, outside the window and the session filter.
write(path.join(dir, "B.jsonl"), [assistant("2026-11-10T12:00:00.000Z", "b1", "claude-opus-5", usage(999, 999))]);

const prices = path.join(dir, "prices.json");
writeFileSync(prices, JSON.stringify({
  "claude-opus-5": { input: 1, output: 2, cacheWrite5m: 3, cacheWrite1h: 4, cacheRead: 0.5 },
}));

test("counts each request once, attributes subagents, and filters by session", () => {
  const r = collect({ project: dir, run: "t", transcripts: dir, session: "A" });
  assert.deepEqual(r.models["claude-opus-5"].requests, 3);
  assert.equal(r.models["claude-opus-5"].output, 100, "r1 counted once: 50 + 20 + 30");
  assert.equal(r.models["claude-opus-5"].cacheWrite5m, 200);
  assert.equal(r.models["claude-opus-5"].cacheWrite1h, 300);
  assert.equal(r.models["claude-sonnet-5"].output, 300);
  assert.equal(r.agents["fashion:builder"].perModel["claude-sonnet-5"].requests, 2);
  assert.equal(r.agents.main.perModel["claude-opus-5"].requests, 3);
  assert.ok(!r.transcripts.some((f) => f.endsWith("B.jsonl")));
});

test("human wait counts only real human turns, not skill text, notifications or tool results", () => {
  const r = collect({ project: dir, run: "t", transcripts: dir, session: "A" });
  assert.equal(r.humanWaitMs, 60000, "from the last assistant line (10:00:04) to 'yes, go' (10:01:04)");
});

test("cost is unknown without prices and never 0; partial prices stay unknown", () => {
  const none = collect({ project: dir, run: "t", transcripts: dir, session: "A" });
  assert.equal(none.totalCostUSD, "unknown");
  const partial = collect({ project: dir, run: "t", transcripts: dir, session: "A", prices });
  assert.equal(typeof partial.models["claude-opus-5"].costUSD, "number");
  assert.equal(partial.models["claude-sonnet-5"].costUSD, "unknown", "no price for sonnet");
  assert.equal(partial.totalCostUSD, "unknown", "one unknown model makes the total unknown");
});

test("cost uses each token class at its own price", () => {
  const r = collect({ project: dir, run: "t", transcripts: dir, session: "A", prices });
  // opus: input 20*1 + output 100*2 + write5m 200*3 + write1h 300*4 + read 1000*0.5 = 2520 per MTok units
  assert.equal(r.models["claude-opus-5"].costUSD, 2520 / 1e6);
});

test("time window excludes lines outside it", () => {
  const r = collect({ project: dir, run: "t", transcripts: dir, since: "2026-11-10T11:00:00Z" });
  assert.deepEqual(Object.keys(r.models), ["claude-opus-5"]);
  assert.equal(r.models["claude-opus-5"].output, 999);
});
