#!/usr/bin/env node
// Starts and stops long-lived worker processes (dev servers, watchers) with a
// recorded identity, so a later session can clean up after a dead worker
// without ever killing a process by port or by a PID that may have been reused.
//
//   start --root R --owner ID --role ROLE --attempt N [--task T] [--port P] [--cwd DIR] --log FILE -- cmd args...
//   stop  --root R [--owner ID] [--role ROLE] [--attempt N] [--pid P]
//   list  --root R [--owner ID]
//
// How ownership stays verifiable: `start` launches a small supervisor (this
// script in `__supervise` mode) as the leader of a new process group. The
// supervisor never changes directory, runs the command as its child in the same
// group, and stays alive until every process in the group has exited, even
// after the command itself exits or its children change directory. The record
// holds the supervisor's pid, start time and cwd; `stop` kills the group only
// while that identity still matches. If the supervisor is gone but processes
// remain in the group, ownership cannot be proven: `stop` refuses (exit 4) and
// keeps the record. One record per process group in <root>/.fashion/processes/.
//
// Exit codes: 0 ok, 1 start failed (nothing left running), 2 usage,
// 3 port held by another process, 4 refused or unverified (record kept).
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readlinkSync, realpathSync, writeFileSync, writeSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
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

function startTime(pid) {
  const out = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], { env, encoding: "utf8" });
  return out.status === 0 && out.stdout.trim() ? out.stdout.trim() : null; // null when gone
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

// Every live process in the group. Throws when the group cannot be inspected,
// so an inspection failure is never mistaken for an empty group.
function groupMembers(pgid) {
  const out = spawnSync("pgrep", ["-g", String(pgid)], { env, encoding: "utf8" });
  if (out.status === 1) return [];
  if (out.status !== 0) throw new Error(`pgrep -g ${pgid} failed: ${out.error?.message ?? out.stderr.trim()}`);
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

const recordsDir = (root) => path.join(root, ".fashion", "processes");

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

// "match": the supervisor is alive with the recorded start time and cwd, so the
// group is ours. "mismatch": the pid now belongs to another process (reuse).
// "unverified": the supervisor is gone but the group still has members whose
// ownership cannot be proven. "exited": the group is empty.
function identity(record) {
  const lstart = startTime(record.pid);
  if (lstart !== null) {
    return lstart === record.startedAt && cwdOf(record.pid) === record.cwd ? "match" : "mismatch";
  }
  return groupMembers(record.pgid).length ? "unverified" : "exited";
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

// Runs as the group leader. Keeps the group verifiable until it is empty.
async function supervise(opts) {
  const log = openSync(opts.log, "a");
  const note = (text) => writeSync(log, `[owned-process] ${new Date().toISOString()} ${text}\n`);
  const child = spawn(opts.command[0], opts.command.slice(1), { stdio: ["ignore", log, log], env: process.env });
  const code = await new Promise((resolve) => {
    child.once("error", (error) => { note(`could not start command: ${error.message}`); resolve(127); });
    child.once("exit", (exitCode, signal) => { note(`command exited (${exitCode ?? signal})`); resolve(exitCode ?? 128); });
  });
  // The command is done; stay the verifiable leader while anything else in the group runs.
  for (;;) {
    let others;
    try { others = groupMembers(process.pid).filter((pid) => pid !== process.pid); } catch { others = [-1]; }
    if (!others.length) break;
    await sleep(300);
  }
  closeSync(log);
  process.exit(code);
}

async function start(opts) {
  for (const key of ["root", "owner", "role", "attempt", "log"]) if (!opts[key]) fail(2, `start needs --${key}`);
  if (!opts.command.length) fail(2, "start needs a command after --");
  if (opts.port && (await portInUse(opts.port))) {
    fail(3, `port ${opts.port} is already in use by a process this record does not own; pick another port, never stop it`);
  }
  const root = realpathSync(opts.root);
  const cwd = realpathSync(opts.cwd ?? process.cwd());
  const log = path.resolve(opts.log);
  mkdirSync(recordsDir(root), { recursive: true });

  const supervisor = spawn(process.execPath, [SELF, "__supervise", "--log", log, "--", ...opts.command],
    { cwd, detached: true, stdio: "ignore", env: process.env });
  const pgid = supervisor.pid;
  if (!pgid) fail(1, "could not launch the supervisor");
  const exited = new Promise((resolve) => supervisor.once("exit", (code) => resolve(code ?? 1)));

  // Register immediately. If the identity cannot be read or the record cannot be
  // written, stop the group we just created before failing, so nothing is left
  // running without a record.
  let record;
  try {
    let startedAt = null;
    for (let i = 0; i < 20 && startedAt === null; i++) { startedAt = startTime(pgid); if (startedAt === null) await sleep(10); }
    if (startedAt === null) throw new Error("could not read the supervisor's start time");
    record = {
      file: path.join(recordsDir(root), `${opts.owner}-${opts.role}-a${opts.attempt}-${pgid}.json`),
      owner: opts.owner, role: opts.role, attempt: Number(opts.attempt), task: opts.task ?? null,
      pid: pgid, pgid, startedAt, cwd, port: opts.port ? Number(opts.port) : null,
      command: opts.command, log, status: "running",
      recordedAt: new Date().toISOString(), stoppedAt: null, note: null,
    };
    save(record);
  } catch (error) {
    const cleaned = await killGroup(pgid).catch(() => false);
    fail(cleaned ? 1 : 4, `could not record ownership (${error.message}); launched group ${pgid} ${cleaned ? "stopped" : "may still be running"}`);
  }

  // The supervisor exits only once the whole group is empty, so an early exit
  // means nothing is left running.
  const early = await Promise.race([exited, sleep(500).then(() => undefined)]);
  if (early !== undefined) {
    record.status = "exited";
    record.stoppedAt = new Date().toISOString();
    record.note = `exited at once with code ${early}`;
    save(record);
    fail(1, `process exited at once with code ${early} and left nothing running; see ${log}`);
  }
  supervisor.unref();
  const { file, ...printed } = record;
  console.log(JSON.stringify({ ...printed, record: file }));
}

async function stop(opts) {
  if (!opts.root) fail(2, "stop needs --root");
  const targets = loadRecords(realpathSync(opts.root)).filter((r) => r.status === "running" && matches(r, opts));
  let refused = 0;
  for (const record of targets) {
    let result;
    try {
      const state = identity(record);
      if (state === "mismatch") {
        result = "identity-mismatch";
        record.note = `pid ${record.pid} now belongs to another process (start time or cwd differs); left running`;
      } else if (state === "unverified") {
        result = "unverified";
        record.note = `supervisor ${record.pid} is gone but processes remain in group ${record.pgid}; ownership cannot be proven, left running`;
      } else if (state === "exited") {
        result = "exited";
      } else {
        result = (await killGroup(record.pgid)) ? "stopped" : "still-running";
        if (result === "still-running") record.note = "processes survived SIGKILL";
      }
    } catch (error) {
      result = "inspection-failed";
      record.note = `could not inspect the process group: ${error.message}`;
    }
    if (result === "stopped" || result === "exited") {
      record.status = result;
      record.stoppedAt = new Date().toISOString();
      record.note = null;
    } else {
      refused++;
    }
    save(record);
    console.log(JSON.stringify({ pid: record.pid, owner: record.owner, result }));
  }
  if (!targets.length) console.log(JSON.stringify({ result: "nothing-to-stop" }));
  process.exit(refused ? 4 : 0);
}

function list(opts) {
  if (!opts.root) fail(2, "list needs --root");
  for (const record of loadRecords(realpathSync(opts.root)).filter((r) => matches(r, opts))) {
    let live = record.status;
    if (record.status === "running") {
      try { live = identity(record); } catch (error) { live = `inspection-failed: ${error.message}`; }
    }
    const { file, ...rest } = record;
    console.log(JSON.stringify({ ...rest, live }));
  }
}

const [mode, ...rest] = process.argv.slice(2);
const opts = parseArgs(rest);
if (mode === "__supervise") await supervise(opts);
else if (mode === "start") await start(opts);
else if (mode === "stop") await stop(opts);
else if (mode === "list") list(opts);
else fail(2, "usage: owned-process.mjs start|stop|list --root <project> ...");
