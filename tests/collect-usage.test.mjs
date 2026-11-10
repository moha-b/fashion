// Tests for bench/collect-usage.mjs on synthetic Claude Code transcripts.
// Run: node --test tests/collect-usage.test.mjs
import assert from "node:assert/strict";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { spawnSync } from "node:child_process";
import { collect, writeManifest } from "../bench/collect-usage.mjs";

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

// Codex review of PR #9, findings 1-4.

test("recollecting a run keeps the operator's outcome, revisions, failures and evidence", () => {
  const out = path.join(dir, "rt", "manifest.json");
  writeManifest(out, collect({ project: dir, run: "keep", transcripts: dir, session: "A" }));
  const manifest = JSON.parse(readFileSync(out, "utf8"));
  Object.assign(manifest.runs[0], { outcome: "pass", revisions: 2, failures: ["checker blocked once"], evidence: { approval: "ux/decisions.md#L12" }, notes: "operator note" });
  writeFileSync(out, JSON.stringify(manifest));
  const again = writeManifest(out, collect({ project: dir, run: "keep", transcripts: dir, session: "A" }));
  assert.equal(again.outcome, "pass");
  assert.equal(again.revisions, 2);
  assert.deepEqual(again.failures, ["checker blocked once"]);
  assert.deepEqual(again.evidence, { approval: "ux/decisions.md#L12" });
  assert.equal(again.notes, "operator note", "unknown operator keys survive too");
  assert.equal(again.collections, 2);
  assert.equal(JSON.parse(readFileSync(out, "utf8")).runs.length, 1);
});

test("time bounds compare instants: fractional seconds and offsets, invalid bounds rejected", () => {
  const t = path.join(dir, "time");
  mkdirSync(t);
  write(path.join(t, "S.jsonl"), [
    assistant("2026-11-10T10:00:00.500Z", "f1", "claude-opus-5", usage(1, 100)),
    assistant("2026-11-10T12:00:00+02:00", "f2", "claude-opus-5", usage(1, 7)), // 10:00:00Z
  ]);
  const frac = collect({ project: t, run: "t", transcripts: t, since: "2026-11-10T10:00:00.100Z" });
  assert.equal(frac.models["claude-opus-5"].output, 100, "10:00:00.500Z is after 10:00:00.100Z");
  const all = collect({ project: t, run: "t", transcripts: t, since: "2026-11-10T10:00:00Z" });
  assert.equal(all.models["claude-opus-5"].output, 107, "the +02:00 line is exactly 10:00:00Z and counts");
  const offset = collect({ project: t, run: "t", transcripts: t, until: "2026-11-10T11:00:00.000+01:00" });
  assert.equal(offset.models["claude-opus-5"].output, 7, "11:00+01:00 is 10:00:00Z: the .500Z line is after it, the +02:00 line is exactly at it");
  assert.throws(() => collect({ project: t, run: "t", transcripts: t, since: "yesterday-ish" }), /invalid --since/);
  assert.throws(() => collect({ project: t, run: "t", transcripts: t, since: "2026-11-11T00:00:00Z", until: "2026-11-10T00:00:00Z" }), /after --until/);
});

test("a malformed record inside a transcript fails with file and line", () => {
  const m = path.join(dir, "bad");
  mkdirSync(m);
  writeFileSync(path.join(m, "S.jsonl"), [
    JSON.stringify(assistant("2026-11-10T10:00:00Z", "b1", "claude-opus-5", usage(1, 10))),
    "not json",
    JSON.stringify(assistant("2026-11-10T10:00:01Z", "b2", "claude-opus-5", usage(1, 10))),
  ].join("\n") + "\n");
  assert.throws(() => collect({ project: m, run: "t", transcripts: m }), /S\.jsonl:2: malformed transcript record/);
});

test("an unfinished final line marks the run incomplete: no total, only a labelled lower bound", () => {
  const u = path.join(dir, "tail");
  mkdirSync(u);
  const file = path.join(u, "S.jsonl");
  write(file, [assistant("2026-11-10T10:00:00Z", "u1", "claude-opus-5", usage(1, 10))]);
  appendFileSync(file, '{"type":"assistant","timestamp":"2026-11-10T10:00:0'); // still being written
  const r = collect({ project: u, run: "t", transcripts: u, prices });
  assert.equal(r.complete, false);
  assert.match(r.warnings[0], /unfinished final line/);
  assert.equal(r.totalCostUSD, "unknown");
  assert.equal(typeof r.lowerBoundCostUSD, "number");
});

test("the documented command works with a fresh output directory", () => {
  const out = path.join(dir, "fresh", "results", "manifest.json");
  const run = spawnSync(process.execPath, [new URL("../bench/collect-usage.mjs", import.meta.url).pathname,
    "--project", dir, "--transcripts", dir, "--session", "A", "--run", "fresh-1", "--out", out], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.ok(existsSync(out));
  assert.equal(JSON.parse(readFileSync(out, "utf8")).runs[0].run, "fresh-1");
});

// Codex recheck of eba6796: warnings from files with no usable usage.

test("a subagent transcript that is only an unfinished line still marks the run incomplete", () => {
  const w = path.join(dir, "warn-only");
  mkdirSync(path.join(w, "A", "subagents"), { recursive: true });
  write(path.join(w, "A.jsonl"), [assistant("2026-11-10T10:00:00Z", "w1", "claude-opus-5", usage(10, 20))]);
  writeFileSync(path.join(w, "A", "subagents", "agent-new.jsonl"), '{"type":"assistant","timestamp":"2026-11-10T10:00:01');
  const r = collect({ project: w, run: "t", transcripts: w, session: "A", prices });
  assert.equal(r.complete, false);
  assert.match(r.warnings[0], /agent-new\.jsonl:1: unfinished final line/);
  assert.equal(r.totalCostUSD, "unknown");
  assert.equal(r.lowerBoundCostUSD, (10 * 1 + 20 * 2) / 1e6, "the valid request is the lower bound");
  assert.ok(r.transcripts.some((f) => f.endsWith("agent-new.jsonl")), "the broken file is listed");
});

test("an unfinished tail stays a warning when every valid record is outside the window", () => {
  const o = path.join(dir, "warn-window");
  mkdirSync(o);
  const file = path.join(o, "S.jsonl");
  write(file, [assistant("2026-11-10T08:00:00Z", "o1", "claude-opus-5", usage(1, 5))]);
  appendFileSync(file, '{"type":"assistant","timestamp":"2026-11-10T10:00:0');
  const r = collect({ project: o, run: "t", transcripts: o, since: "2026-11-10T09:00:00Z", prices });
  assert.equal(r.complete, false);
  assert.match(r.warnings[0], /S\.jsonl:2: unfinished final line/);
  assert.equal(r.totalCostUSD, "unknown");
});

