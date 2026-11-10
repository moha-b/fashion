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
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
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

const readJsonl = (file) => readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((line) => {
  try { return [JSON.parse(line)]; } catch { return []; }
});

const inWindow = (ts, since, until) => (!since || ts >= since) && (!until || ts <= until);

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
  const entries = readJsonl(file).filter((e) => !e.timestamp || inWindow(e.timestamp, since, until));
  const byRequest = new Map(); // last line per request carries the final usage
  const times = [];
  const efforts = new Set();
  for (const e of entries) {
    if (e.timestamp) times.push(e.timestamp);
    if (e.type !== "assistant" || !e.message?.usage) continue;
    byRequest.set(e.requestId ?? e.message.id ?? e.uuid, e);
    if (e.effort) efforts.add(e.effort);
  }
  const perModel = {};
  for (const e of byRequest.values()) {
    const model = e.message.model ?? "unknown";
    addUsage((perModel[model] ??= emptyUsage()), e.message.usage);
  }
  times.sort();
  return { agent, file, perModel, efforts: [...efforts], start: times[0] ?? null, end: times.at(-1) ?? null, entries };
}

// Time the run spent waiting for a person: from the last main-thread assistant
// line before a human turn to that turn.
function humanWaitMs(entries) {
  let lastAssistant = null;
  let wait = 0;
  for (const e of entries.filter((x) => !x.isSidechain && x.timestamp).sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    if (e.type === "assistant") lastAssistant = e.timestamp;
    else if (isHumanTurn(e) && lastAssistant) {
      wait += Date.parse(e.timestamp) - Date.parse(lastAssistant);
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

export function collect(opts) {
  const transcripts = opts.transcripts ?? path.join(homedir(), ".claude", "projects", encodeProject(opts.project));
  if (!existsSync(transcripts)) throw new Error(`no transcripts at ${transcripts}`);
  const prices = opts.prices ? JSON.parse(readFileSync(opts.prices, "utf8")) : null;
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
  const summaries = files.map(({ file, agent }) => summarizeFile(file, opts.since, opts.until, agent))
    .filter((s) => Object.keys(s.perModel).length || s.entries.length);

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
  const totalCostUSD = costs.length && costs.every((c) => typeof c === "number")
    ? Number(costs.reduce((a, b) => a + b, 0).toFixed(6)) : "unknown";

  const starts = summaries.map((s) => s.start).filter(Boolean).sort();
  const ends = summaries.map((s) => s.end).filter(Boolean).sort();
  const mainEntries = summaries.filter((s) => s.agent === "main").flatMap((s) => s.entries);
  return {
    run: opts.run, variant: opts.variant ?? null, commit: opts.commit ?? null,
    collectedAt: new Date().toISOString(),
    window: { since: opts.since ?? null, until: opts.until ?? null, sessions: opts.session ?? null },
    start: starts[0] ?? null, end: ends.at(-1) ?? null,
    wallMs: starts[0] && ends.length ? Date.parse(ends.at(-1)) - Date.parse(starts[0]) : null,
    humanWaitMs: humanWaitMs(mainEntries),
    efforts: [...new Set(summaries.flatMap((s) => s.efforts))],
    models: modelCosts, agents, totalCostUSD,
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
    if (opts.out) {
      const manifest = existsSync(opts.out) ? JSON.parse(readFileSync(opts.out, "utf8")) : { runs: [] };
      manifest.runs = manifest.runs.filter((r) => r.run !== entry.run).concat(entry);
      writeFileSync(opts.out, JSON.stringify(manifest, null, 2) + "\n");
    }
    console.log(JSON.stringify({ run: entry.run, totalCostUSD: entry.totalCostUSD, wallMs: entry.wallMs, humanWaitMs: entry.humanWaitMs,
      models: Object.fromEntries(Object.entries(entry.models).map(([m, u]) => [m, { requests: u.requests, output: u.output, costUSD: u.costUSD }])) }));
  } catch (error) {
    process.stderr.write(`collect-usage: ${error.message}\n`);
    process.exit(1);
  }
}
