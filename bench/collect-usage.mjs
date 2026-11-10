#!/usr/bin/env node
// Collects model usage for one Fashion run from Claude Code transcripts and
// appends a run entry to a manifest (bench/README.md describes the fields).
//
//   node bench/collect-usage.mjs --project <dir> --run <id> --variant <name> --commit <sha>
//        [--since <ISO>] [--until <ISO>] [--inputs <dir>] [--prices <prices.json>]
//        [--session <id,id>] [--transcripts <dir>] [--out <manifest.json>]
//
// Reads ~/.claude/projects/<encoded project path>/*.jsonl and their
// subagents/agent-*.jsonl (+ .meta.json for the agent type). Usage is counted
// once per API request (requestId), because one request is written as several
// transcript lines. Cost is computed only from a prices file you supply; without
// one it is "unknown", never 0.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--") || argv[i + 1] === undefined) throw new Error(`bad argument near ${argv[i]}`);
    opts[argv[i].slice(2)] = argv[i + 1];
  }
  return opts;
}

export const encodeProject = (dir) => realpathSync(dir).replace(/[^a-zA-Z0-9]/g, "-");

// Parses a transcript. A malformed record inside the file is an error (with
// file:line), because skipping it would understate usage. The one tolerated case
// is a final line still being written by a live session (no trailing newline):
// it is reported as a warning and makes the collection incomplete.
function readJsonl(file) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const entries = [];
  const warnings = [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      const unfinishedTail = index === lines.length - 1 && !text.endsWith("\n");
      if (!unfinishedTail) throw new Error(`${file}:${index + 1}: malformed transcript record`);
      warnings.push(`${file}:${index + 1}: unfinished final line ignored (session still writing?)`);
      return;
    }
    if (entry.timestamp !== undefined) {
      const ms = Date.parse(entry.timestamp);
      if (!Number.isFinite(ms)) throw new Error(`${file}:${index + 1}: invalid timestamp ${JSON.stringify(entry.timestamp)}`);
      Object.defineProperty(entry, "ms", { value: ms, enumerable: false });
    }
    entries.push(entry);
  });
  return { entries, warnings };
}

// Window bounds and transcript timestamps are compared as instants, so fractional
// seconds and time-zone offsets compare correctly.
export function parseInstant(value, label) {
  if (value === undefined || value === null) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`invalid ${label} time: ${value}`);
  return ms;
}

const inWindow = (ms, since, until) => (since === null || ms >= since) && (until === null || ms <= until);
const iso = (ms) => (ms === null || ms === undefined ? null : new Date(ms).toISOString());

// A real human turn: a user message typed by a person. Skill and command text
// (isMeta), task notifications and other injected turns (origin) and tool results
// are not.
function isHumanTurn(entry) {
  if (entry.type !== "user" || entry.isSidechain || entry.isMeta || entry.origin) return false;
  const content = entry.message?.content;
  if (typeof content === "string") return content.trim() !== "";
  return Array.isArray(content) && content.some((c) => c.type === "text") && !content.some((c) => c.type === "tool_result");
}

function emptyUsage() {
  return { requests: 0, input: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0, output: 0 };
}

function addUsage(total, usage) {
  const writes = usage.cache_creation ?? {};
  const w5 = writes.ephemeral_5m_input_tokens ?? 0;
  const w1 = writes.ephemeral_1h_input_tokens ?? 0;
  total.requests += 1;
  total.input += usage.input_tokens ?? 0;
  // Older transcripts only give the total; count it as 5-minute writes.
  total.cacheWrite5m += w5 + w1 === 0 ? usage.cache_creation_input_tokens ?? 0 : w5;
  total.cacheWrite1h += w1;
  total.cacheRead += usage.cache_read_input_tokens ?? 0;
  total.output += usage.output_tokens ?? 0;
}

// prices: { "<model id>": { "input": $/MTok, "output": ..., "cacheWrite5m": ..., "cacheWrite1h": ..., "cacheRead": ... } }
function costOf(model, usage, prices) {
  const p = prices?.[model];
  if (!p) return "unknown";
  const keys = ["input", "output", "cacheWrite5m", "cacheWrite1h", "cacheRead"];
  if (keys.some((k) => typeof p[k] !== "number")) return "unknown";
  return Number((keys.reduce((sum, k) => sum + usage[k] * p[k], 0) / 1e6).toFixed(6));
}

function summarizeFile(file, since, until, agent) {
  const parsed = readJsonl(file);
  const entries = parsed.entries.filter((e) => e.ms === undefined || inWindow(e.ms, since, until));
  const byRequest = new Map(); // last line per request carries the final usage
  const times = [];
  const efforts = new Set();
  for (const e of entries) {
    if (e.ms !== undefined) times.push(e.ms);
    if (e.type !== "assistant" || !e.message?.usage) continue;
    byRequest.set(e.requestId ?? e.message.id ?? e.uuid, e);
    if (e.effort) efforts.add(e.effort);
  }
  const perModel = {};
  for (const e of byRequest.values()) {
    const model = e.message.model ?? "unknown";
    addUsage((perModel[model] ??= emptyUsage()), e.message.usage);
  }
  times.sort((a, b) => a - b);
  return { agent, file, perModel, efforts: [...efforts], start: times[0] ?? null, end: times.at(-1) ?? null, entries, warnings: parsed.warnings };
}

// Time the run spent waiting for a person: from the last main-thread assistant
// line before a human turn to that turn.
function humanWaitMs(entries) {
  let lastAssistant = null;
  let wait = 0;
  for (const e of entries.filter((x) => !x.isSidechain && x.ms !== undefined).sort((a, b) => a.ms - b.ms)) {
    if (e.type === "assistant") lastAssistant = e.ms;
    else if (isHumanTurn(e) && lastAssistant !== null) {
      wait += e.ms - lastAssistant;
      lastAssistant = null;
    }
  }
  return wait;
}

function hashInputs(dir) {
  const files = [];
  const walk = (d) => readdirSync(d).sort().forEach((name) => {
    const full = path.join(d, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(full);
  });
  walk(dir);
  return Object.fromEntries(files.map((f) => [path.relative(dir, f), createHash("sha256").update(readFileSync(f)).digest("hex")]));
}

const version = (cmd, args) => {
  const out = spawnSync(cmd, args, { encoding: "utf8" });
  return out.status === 0 ? out.stdout.trim() : "unknown";
};

// Fields the operator fills in after a run. Recollecting a run refreshes the
// computed usage but never touches these.
export const OPERATOR_FIELDS = ["outcome", "revisions", "failures", "evidence"];

export function writeManifest(out, entry) {
  mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const manifest = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : { runs: [] };
  const previous = manifest.runs.find((r) => r.run === entry.run);
  const merged = { ...entry };
  if (previous) {
    for (const key of OPERATOR_FIELDS) merged[key] = previous[key];
    for (const key of Object.keys(previous)) if (!(key in merged)) merged[key] = previous[key];
    merged.collections = (previous.collections ?? 1) + 1;
  } else {
    merged.collections = 1;
  }
  manifest.runs = manifest.runs.filter((r) => r.run !== entry.run).concat(merged);
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
  return merged;
}

export function collect(opts) {
  const transcripts = opts.transcripts ?? path.join(homedir(), ".claude", "projects", encodeProject(opts.project));
  if (!existsSync(transcripts)) throw new Error(`no transcripts at ${transcripts}`);
  const prices = opts.prices ? JSON.parse(readFileSync(opts.prices, "utf8")) : null;
  const since = parseInstant(opts.since, "--since");
  const until = parseInstant(opts.until, "--until");
  if (since !== null && until !== null && since > until) throw new Error("--since is after --until");
  const files = [];
  const sessions = opts.session ? new Set(String(opts.session).split(",")) : null;
  for (const name of readdirSync(transcripts)) {
    if (sessions && !sessions.has(name.replace(/\.jsonl$/, ""))) continue;
    const full = path.join(transcripts, name);
    if (name.endsWith(".jsonl")) files.push({ file: full, agent: "main" });
    const sub = path.join(transcripts, name, "subagents");
    if (statSync(full).isDirectory() && existsSync(sub)) {
      for (const f of readdirSync(sub).filter((x) => x.endsWith(".jsonl"))) {
        const meta = path.join(sub, f.replace(/\.jsonl$/, ".meta.json"));
        const type = existsSync(meta) ? JSON.parse(readFileSync(meta, "utf8")).agentType ?? "subagent" : "subagent";
        files.push({ file: path.join(sub, f), agent: type });
      }
    }
  }
  const summaries = files.map(({ file, agent }) => summarizeFile(file, since, until, agent))
    // Keep a file that only produced warnings (an unfinished line, or every valid
    // record outside the window): its warning must still mark the run incomplete.
    .filter((s) => Object.keys(s.perModel).length || s.entries.length || s.warnings.length);

  const agents = {};
  const models = {};
  for (const s of summaries) {
    for (const [model, usage] of Object.entries(s.perModel)) {
      const a = ((agents[s.agent] ??= { runs: 0, perModel: {} }).perModel[model] ??= emptyUsage());
      const m = (models[model] ??= emptyUsage());
      for (const k of Object.keys(usage)) { a[k] += usage[k]; m[k] += usage[k]; }
    }
    if (agents[s.agent]) agents[s.agent].runs += 1;
  }
  for (const a of Object.values(agents)) {
    for (const [model, usage] of Object.entries(a.perModel)) usage.costUSD = costOf(model, usage, prices);
  }
  const modelCosts = Object.fromEntries(Object.entries(models).map(([m, u]) => [m, { ...u, costUSD: costOf(m, u, prices) }]));
  const costs = Object.values(modelCosts).map((m) => m.costUSD);
  const priced = costs.length && costs.every((c) => typeof c === "number")
    ? Number(costs.reduce((a, b) => a + b, 0).toFixed(6)) : "unknown";
  // An incomplete collection never reports a total as if it were complete.
  const warnings = summaries.flatMap((s) => s.warnings);
  const complete = warnings.length === 0;
  const totalCostUSD = complete ? priced : "unknown";
  const lowerBoundCostUSD = complete ? null : priced;

  const starts = summaries.map((s) => s.start).filter((x) => x !== null).sort((a, b) => a - b);
  const ends = summaries.map((s) => s.end).filter((x) => x !== null).sort((a, b) => a - b);
  const mainEntries = summaries.filter((s) => s.agent === "main").flatMap((s) => s.entries);
  return {
    run: opts.run, variant: opts.variant ?? null, commit: opts.commit ?? null,
    collectedAt: new Date().toISOString(),
    window: { since: opts.since ?? null, until: opts.until ?? null, sessions: opts.session ?? null },
    start: iso(starts[0]), end: iso(ends.at(-1)),
    wallMs: starts.length && ends.length ? ends.at(-1) - starts[0] : null,
    complete, warnings,
    humanWaitMs: humanWaitMs(mainEntries),
    efforts: [...new Set(summaries.flatMap((s) => s.efforts))],
    models: modelCosts, agents, totalCostUSD, lowerBoundCostUSD,
    pricesFile: opts.prices ?? null,
    tools: { claude: version("claude", ["--version"]), node: process.version },
    inputs: opts.inputs ? hashInputs(opts.inputs) : null,
    transcripts: summaries.map((s) => s.file),
    // Filled in by the operator from bench/checklist.md after the run:
    outcome: null, revisions: null, failures: [], evidence: {},
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (!opts.project || !opts.run) throw new Error("--project and --run are required");
    const entry = collect(opts);
    if (opts.out) writeManifest(opts.out, entry);
    for (const warning of entry.warnings) process.stderr.write(`collect-usage: warning: ${warning}\n`);
    console.log(JSON.stringify({ run: entry.run, complete: entry.complete, totalCostUSD: entry.totalCostUSD, lowerBoundCostUSD: entry.lowerBoundCostUSD, wallMs: entry.wallMs, humanWaitMs: entry.humanWaitMs,
      models: Object.fromEntries(Object.entries(entry.models).map(([m, u]) => [m, { requests: u.requests, output: u.output, costUSD: u.costUSD }])) }));
  } catch (error) {
    process.stderr.write(`collect-usage: ${error.message}\n`);
    process.exit(1);
  }
}
