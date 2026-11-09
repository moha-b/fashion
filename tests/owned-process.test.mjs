// Real subprocess tests for plugins/fashion/scripts/owned-process.mjs.
// Run: node --test tests/owned-process.test.mjs   (macOS or Linux)
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const script = new URL("../plugins/fashion/scripts/owned-process.mjs", import.meta.url).pathname;
const root = realpathSync(mkdtempSync(path.join(tmpdir(), "fashion-owned-")));
const strays = [];
after(() => {
  for (const pid of strays) { try { process.kill(-pid, "SIGKILL"); } catch {} try { process.kill(pid, "SIGKILL"); } catch {} }
  rmSync(root, { recursive: true, force: true });
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const helper = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

// A server that also forks a child into its process group, like `npm run dev` -> next-server.
const serverWithChild = (port) => [process.execPath, "-e",
  `require("child_process").spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
   require("http").createServer((q, s) => s.end("ok")).listen(${port}, "127.0.0.1");`];

function startOwned(owner, port, extra = []) {
  const out = helper("start", "--root", root, "--owner", owner, "--role", "checker", "--attempt", "1",
    "--port", String(port), "--cwd", root, "--log", path.join(root, `${owner}.log`), ...extra, "--", ...serverWithChild(port));
  assert.equal(out.status, 0, out.stderr);
  const record = JSON.parse(out.stdout);
  strays.push(record.pid);
  return record;
}

const children = (pgid) => spawnSync("pgrep", ["-g", String(pgid)], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);

test("owned orphan: stop kills the recorded server and its child, then confirms exit", async () => {
  const port = await freePort();
  const record = startOwned("T01-orphan", port);
  await sleep(300);
  assert.ok(children(record.pgid).length >= 2, "server and its child run in the recorded group");
  const out = helper("stop", "--root", root, "--owner", "T01-orphan");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /"result":"stopped"/);
  assert.equal(children(record.pgid).length, 0, "whole group is gone");
  const saved = JSON.parse(readFileSync(record.record, "utf8"));
  assert.equal(saved.status, "stopped");
});

test("leader died, child survives: stop still cleans the verified group", async () => {
  const port = await freePort();
  const record = startOwned("T02-leader-gone", port);
  await sleep(300);
  process.kill(record.pid, "SIGKILL");
  await sleep(200);
  assert.equal(alive(record.pid), false);
  assert.ok(children(record.pgid).length >= 1, "child is left behind in the group");
  const out = helper("stop", "--root", root, "--owner", "T02-leader-gone");
  assert.equal(out.status, 0, out.stderr);
  assert.equal(children(record.pgid).length, 0);
});

test("PID reuse: a record whose start time no longer matches is refused and the process is left alone", async () => {
  const port = await freePort();
  const record = startOwned("T03-reused", port);
  const saved = JSON.parse(readFileSync(record.record, "utf8"));
  saved.startedAt = "Thu Jan  1 00:00:00 2026"; // the PID now looks like a different process
  writeFileSync(record.record, JSON.stringify(saved));
  const out = helper("stop", "--root", root, "--owner", "T03-reused");
  assert.equal(out.status, 4);
  assert.match(out.stdout, /identity-mismatch/);
  assert.equal(alive(record.pid), true, "an unverified process is never killed");
});

test("unrelated server on the recorded port: start refuses the port and stop never touches it", async () => {
  const port = await freePort();
  const unrelated = spawn(process.execPath, ["-e", `require("http").createServer((q,s)=>s.end("x")).listen(${port},"127.0.0.1")`], { stdio: "ignore", detached: true });
  strays.push(unrelated.pid);
  await sleep(400);
  const refused = helper("start", "--root", root, "--owner", "T04-port", "--role", "checker", "--attempt", "1",
    "--port", String(port), "--cwd", root, "--log", path.join(root, "T04.log"), "--", process.execPath, "-e", "setInterval(()=>{},1000)");
  assert.equal(refused.status, 3);
  assert.match(refused.stderr, /never stop it/);
  // A stale record that names only this port (its own PID long gone) must not reach the unrelated server.
  writeFileSync(path.join(root, ".fashion", "processes", "T04-port-checker-a1-1.json"), JSON.stringify({
    owner: "T04-port", role: "checker", attempt: 1, pid: 999999, pgid: 999999, startedAt: "Thu Jan  1 00:00:00 2026",
    cwd: root, port, status: "running" }));
  const out = helper("stop", "--root", root, "--owner", "T04-port");
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /"result":"exited"/);
  assert.equal(alive(unrelated.pid), true, "the unrelated server on the same port is still running");
});

test("records are one file per process so parallel workers never share a file", () => {
  const files = readdirSync(path.join(root, ".fashion", "processes"));
  assert.equal(new Set(files).size, files.length);
  assert.ok(files.every((f) => /-a\d+-\d+\.json$/.test(f)));
});
