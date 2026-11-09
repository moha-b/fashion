#!/usr/bin/env node
// Starts and stops long-lived worker processes (dev servers, watchers) with a
// recorded identity, so a later session can clean up after a dead worker
// without ever killing a process by port or by a PID that may have been reused.
//
//   start --root R --owner ID --role ROLE --attempt N [--task T] [--port P] [--cwd DIR] --log FILE -- cmd args...
//   stop  --root R [--owner ID] [--role ROLE] [--attempt N] [--pid P]
//   list  --root R [--owner ID]
//
// One record per process in <root>/.fashion/processes/, so parallel workers never
// write the same file. Identity = pid + process start time + working directory.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readlinkSync, realpathSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const env = { ...process.env, LC_ALL: "C", LANG: "C" };

function parseArgs(argv) {
  const opts = {};
  const dash = argv.indexOf("--");
  const own = dash === -1 ? argv : argv.slice(0, dash);
  opts.command = dash === -1 ? [] : argv.slice(dash + 1);
  for (let i = 0; i < own.length; i += 2) {
    if (!own[i].startsWith("--") || own[i + 1] === undefined) fail(2, `bad argument near ${own[i]}`);
    opts[own[i].slice(2)] = own[i + 1];
  }
  return opts;
}

function fail(code, message) {
  process.stderr.write(`owned-process: ${message}\n`);
  process.exit(code);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ps(pid, field) {
  const out = spawnSync("ps", ["-o", `${field}=`, "-p", String(pid)], { env, encoding: "utf8" });
  return out.status === 0 ? out.stdout.trim() : null;
}

function startTime(pid) {
  return ps(pid, "lstart"); // e.g. "Mon Nov  9 16:54:30 2026"; null when gone
}

function cwdOf(pid) {
  try {
    if (process.platform === "linux") return realpathSync(readlinkSync(`/proc/${pid}/cwd`));
    const out = spawnSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { env, encoding: "utf8" });
    const line = out.stdout.split("\n").find((l) => l.startsWith("n"));
    return line ? realpathSync(line.slice(1)) : null;
  } catch {
    return null;
  }
}

function groupMembers(pgid) {
  const out = spawnSync("pgrep", ["-g", String(pgid)], { env, encoding: "utf8" });
  return out.stdout.split("\n").map(Number).filter((n) => n > 0);
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: Number(port), host: "127.0.0.1" });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

function recordsDir(root) {
  return path.join(root, ".fashion", "processes");
}

function loadRecords(root) {
  const dir = recordsDir(root);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: path.join(dir, f), ...JSON.parse(readFileSync(path.join(dir, f), "utf8")) }));
}

function save(record) {
  const { file, ...data } = record;
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function matches(record, opts) {
  return ["owner", "role"].every((k) => opts[k] === undefined || record[k] === opts[k])
    && (opts.attempt === undefined || String(record.attempt) === String(opts.attempt))
    && (opts.pid === undefined || String(record.pid) === String(opts.pid));
}

// "match": the recorded leader is alive with the same start time and cwd.
// "orphans": the leader is gone but members of its group remain in the recorded
// cwd, started no earlier than the leader. "exited": nothing left. "mismatch":
// the PID now belongs to a different process (reuse) - never touch it.
function identity(record) {
  const lstart = startTime(record.pid);
  if (lstart !== null) {
    return lstart === record.startedAt && cwdOf(record.pid) === record.cwd ? "match" : "mismatch";
  }
  const since = Date.parse(record.startedAt);
  const members = groupMembers(record.pgid).filter((pid) => {
    const started = Date.parse(startTime(pid) ?? "");
    return cwdOf(pid) === record.cwd && Number.isFinite(started) && started >= since;
  });
  return members.length ? "orphans" : "exited";
}

async function killGroup(pgid) {
  const signal = (sig) => { try { process.kill(-pgid, sig); } catch {} };
  signal("SIGTERM");
  for (let i = 0; i < 50 && groupMembers(pgid).length; i++) await sleep(100);
  if (groupMembers(pgid).length) {
    signal("SIGKILL");
    for (let i = 0; i < 20 && groupMembers(pgid).length; i++) await sleep(100);
  }
  return groupMembers(pgid).length === 0;
}

async function start(opts) {
  for (const key of ["root", "owner", "role", "attempt", "log"]) if (!opts[key]) fail(2, `start needs --${key}`);
  if (!opts.command.length) fail(2, "start needs a command after --");
  if (opts.port && (await portInUse(opts.port))) {
    fail(3, `port ${opts.port} is already in use by a process this record does not own; pick another port, never stop it`);
  }
  const root = realpathSync(opts.root);
  const cwd = realpathSync(opts.cwd ?? process.cwd());
  const log = openSync(opts.log, "a");
  const child = spawn(opts.command[0], opts.command.slice(1), { cwd, detached: true, stdio: ["ignore", log, log], env: process.env });
  closeSync(log);
  const exited = new Promise((resolve) => child.once("exit", (code) => resolve(code)));
  child.once("error", (error) => fail(1, `could not start: ${error.message}`));
  const early = await Promise.race([exited, sleep(500).then(() => undefined)]);
  if (early !== undefined) fail(1, `process exited at once with code ${early}; see ${opts.log}`);
  const startedAt = startTime(child.pid);
  if (startedAt === null) fail(1, "process vanished before its identity was recorded");
  mkdirSync(recordsDir(root), { recursive: true });
  const record = {
    file: path.join(recordsDir(root), `${opts.owner}-${opts.role}-a${opts.attempt}-${child.pid}.json`),
    owner: opts.owner, role: opts.role, attempt: Number(opts.attempt), task: opts.task ?? null,
    pid: child.pid, pgid: child.pid, startedAt, cwd, port: opts.port ? Number(opts.port) : null,
    command: opts.command, log: path.resolve(opts.log), status: "running",
    recordedAt: new Date().toISOString(), stoppedAt: null, note: null,
  };
  save(record);
  child.unref();
  const { file, ...printed } = record;
  console.log(JSON.stringify({ ...printed, record: file }));
}

async function stop(opts) {
  if (!opts.root) fail(2, "stop needs --root");
  const targets = loadRecords(realpathSync(opts.root)).filter((r) => r.status === "running" && matches(r, opts));
  let refused = 0;
  for (const record of targets) {
    const state = identity(record);
    if (state === "mismatch") {
      refused++;
      record.note = `pid ${record.pid} now belongs to another process (start time or cwd differs); left running`;
      console.log(JSON.stringify({ pid: record.pid, owner: record.owner, result: "identity-mismatch" }));
      save(record);
      continue;
    }
    const stopped = state === "exited" ? true : await killGroup(record.pgid);
    if (!stopped) refused++;
    record.status = stopped ? (state === "exited" ? "exited" : "stopped") : "running";
    record.stoppedAt = stopped ? new Date().toISOString() : null;
    record.note = stopped ? null : "processes survived SIGKILL";
    save(record);
    console.log(JSON.stringify({ pid: record.pid, owner: record.owner, result: stopped ? record.status : "still-running" }));
  }
  if (!targets.length) console.log(JSON.stringify({ result: "nothing-to-stop" }));
  process.exit(refused ? 4 : 0);
}

function list(opts) {
  if (!opts.root) fail(2, "list needs --root");
  for (const record of loadRecords(realpathSync(opts.root)).filter((r) => matches(r, opts))) {
    const live = record.status === "running" ? identity(record) : record.status;
    const { file, ...rest } = record;
    console.log(JSON.stringify({ ...rest, live }));
  }
}

const [mode, ...rest] = process.argv.slice(2);
const opts = parseArgs(rest);
if (mode === "start") await start(opts);
else if (mode === "stop") await stop(opts);
else if (mode === "list") list(opts);
else fail(2, "usage: owned-process.mjs start|stop|list --root <project> ...");
