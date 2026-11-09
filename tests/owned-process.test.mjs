// Real subprocess tests for plugins/fashion/scripts/owned-process.mjs.
// Every test asserts the actual state of the processes, not only the helper's exit code.
// Run: node --test tests/owned-process.test.mjs   (macOS or Linux)
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const script = new URL("../plugins/fashion/scripts/owned-process.mjs", import.meta.url).pathname;
const root = realpathSync(mkdtempSync(path.join(tmpdir(), "fashion-owned-")));
mkdirSync(path.join(root, "sub"));
const groups = [];
const strays = [];
after(() => {
  for (const pgid of groups) { try { process.kill(-pgid, "SIGKILL"); } catch {} }
  for (const pid of strays) { try { process.kill(pid, "SIGKILL"); } catch {} }
  try { chmodSync(path.join(root, ".fashion", "processes"), 0o755); } catch {}
  rmSync(root, { recursive: true, force: true });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const helper = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
const members = (pgid) => spawnSync("pgrep", ["-g", String(pgid)], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).map(Number);
const childrenOf = (pid) => spawnSync("pgrep", ["-P", String(pid)], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).map(Number);
const byMarker = (marker) => spawnSync("pgrep", ["-f", marker], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).map(Number);

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

// Node one-liners. Each child carries a marker so a test can find it by command line.
const node = (code) => [process.execPath, "-e", code];
const spawnChild = (marker, { chdir = false } = {}) =>
  `require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(`${chdir ? 'process.chdir("sub");' : ""}setInterval(()=>{},1000)//${marker}`)}], { stdio: "ignore" }).unref();`;

function start(owner, command, extra = []) {
  const out = helper("start", "--root", root, "--owner", owner, "--role", "checker", "--attempt", "1",
    "--cwd", root, "--log", path.join(root, `${owner}.log`), ...extra, "--", ...command);
  if (out.status === 0) groups.push(JSON.parse(out.stdout).pgid);
  return out;
}

test("owned server with a child: stop kills the whole group and confirms exit", async () => {
  const port = await freePort();
  const out = start("T01-orphan", node(`${spawnChild("m-t01")} require("http").createServer((q,s)=>s.end("ok")).listen(${port},"127.0.0.1");`), ["--port", String(port)]);
  assert.equal(out.status, 0, out.stderr);
  const record = JSON.parse(out.stdout);
  await sleep(400);
  assert.ok(members(record.pgid).length >= 3, "supervisor, server and child share the group");
  const stop = helper("stop", "--root", root, "--owner", "T01-orphan");
  assert.equal(stop.status, 0, stop.stderr);
  assert.match(stop.stdout, /"result":"stopped"/);
  assert.deepEqual(members(record.pgid), []);
  assert.equal(JSON.parse(readFileSync(record.record, "utf8")).status, "stopped");
});

test("command died and its child moved to another directory: stop still cleans it (Codex finding 1)", async () => {
  const out = start("T02-chdir", node(`${spawnChild("m-t02", { chdir: true })} setInterval(()=>{},1000);`));
  assert.equal(out.status, 0, out.stderr);
  const record = JSON.parse(out.stdout);
  await sleep(400);
  const [command] = childrenOf(record.pid);
  process.kill(command, "SIGKILL");
  await sleep(300);
  const [survivor] = byMarker("m-t02");
  assert.ok(survivor && alive(survivor), "child in sub/ survives its parent");
  const stop = helper("stop", "--root", root, "--owner", "T02-chdir");
  assert.equal(stop.status, 0, stop.stderr);
  assert.match(stop.stdout, /"result":"stopped"/);
  assert.equal(alive(survivor), false, "the child that changed directory is gone");
  assert.deepEqual(members(record.pgid), []);
});

test("launcher exits at once but leaves a child: start keeps a record and stop cleans it (Codex finding 2)", async () => {
  const out = start("T03-early", node(spawnChild("m-t03")));
  assert.equal(out.status, 0, `start must not fail while a child still runs: ${out.stderr}`);
  const record = JSON.parse(out.stdout);
  const [child] = byMarker("m-t03");
  assert.ok(child && alive(child));
  assert.match(readFileSync(record.log, "utf8"), /command exited \(0\)/);
  const stop = helper("stop", "--root", root, "--owner", "T03-early");
  assert.equal(stop.status, 0, stop.stderr);
  assert.equal(alive(child), false);
  assert.deepEqual(members(record.pgid), []);
});

test("command exits at once with nothing left: start fails and leaves an exited record", async () => {
  const out = start("T04-noop", node("process.exit(3)"));
  assert.equal(out.status, 1);
  assert.match(out.stderr, /left nothing running/);
  const [file] = readdirSync(path.join(root, ".fashion", "processes")).filter((f) => f.startsWith("T04-noop"));
  const record = JSON.parse(readFileSync(path.join(root, ".fashion", "processes", file), "utf8"));
  assert.equal(record.status, "exited");
  assert.deepEqual(members(record.pgid), []);
});

test("supervisor gone while processes remain: stop refuses, keeps the record, touches nothing", async () => {
  const out = start("T05-unverified", node(`${spawnChild("m-t05")} setInterval(()=>{},1000);`));
  assert.equal(out.status, 0, out.stderr);
  const record = JSON.parse(out.stdout);
  await sleep(400);
  process.kill(record.pid, "SIGKILL"); // the supervisor itself
  await sleep(300);
  const before = members(record.pgid);
  assert.ok(before.length >= 1);
  const stop = helper("stop", "--root", root, "--owner", "T05-unverified");
  assert.equal(stop.status, 4);
  assert.match(stop.stdout, /"result":"unverified"/);
  assert.deepEqual(members(record.pgid), before, "unverified processes are left running");
  const saved = JSON.parse(readFileSync(record.record, "utf8"));
  assert.equal(saved.status, "running", "the record stays for recovery");
  assert.match(saved.note, /ownership cannot be proven/);
});

test("PID reuse: a record whose start time no longer matches is refused and the process is left alone", async () => {
  const out = start("T06-reused", node("setInterval(()=>{},1000)"));
  assert.equal(out.status, 0, out.stderr);
  const record = JSON.parse(out.stdout);
  const saved = JSON.parse(readFileSync(record.record, "utf8"));
  saved.startedAt = "Thu Jan  1 00:00:00 2026";
  writeFileSync(record.record, JSON.stringify(saved));
  const stop = helper("stop", "--root", root, "--owner", "T06-reused");
  assert.equal(stop.status, 4);
  assert.match(stop.stdout, /identity-mismatch/);
  assert.equal(alive(record.pid), true);
});

test("unrelated server on the recorded port: start refuses the port and stop never touches it", async () => {
  const port = await freePort();
  const unrelated = spawn(process.execPath, ["-e", `require("http").createServer((q,s)=>s.end("x")).listen(${port},"127.0.0.1")`], { stdio: "ignore" });
  strays.push(unrelated.pid);
  await sleep(400);
  const refused = start("T07-port", node("setInterval(()=>{},1000)"), ["--port", String(port)]);
  assert.equal(refused.status, 3);
  assert.match(refused.stderr, /never stop it/);
  writeFileSync(path.join(root, ".fashion", "processes", "T07-port-checker-a1-1.json"), JSON.stringify({
    owner: "T07-port", role: "checker", attempt: 1, pid: 999999, pgid: 999999, startedAt: "Thu Jan  1 00:00:00 2026",
    cwd: root, port, status: "running" }));
  const stop = helper("stop", "--root", root, "--owner", "T07-port");
  assert.equal(stop.status, 0, stop.stderr);
  assert.match(stop.stdout, /"result":"exited"/);
  assert.equal(alive(unrelated.pid), true);
});

test("record write fails: start stops the group it launched and fails", async () => {
  const dir = path.join(root, ".fashion", "processes");
  chmodSync(dir, 0o555);
  try {
    const out = start("T08-unwritable", node(`${spawnChild("m-t08")} setInterval(()=>{},1000);//m-t08-parent`));
    assert.equal(out.status, 1, out.stderr);
    assert.match(out.stderr, /could not record ownership.*stopped/);
    await sleep(200);
    assert.deepEqual(byMarker("m-t08"), [], "nothing from the launch is left running");
  } finally {
    chmodSync(dir, 0o755);
  }
});

test("records are one file per process group so parallel workers never share a file", () => {
  const files = readdirSync(path.join(root, ".fashion", "processes"));
  assert.equal(new Set(files).size, files.length);
  assert.ok(files.every((f) => /-a\d+-\d+\.json$/.test(f)));
});
