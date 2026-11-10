#!/usr/bin/env node
// Moves a Fashion project from the retired build workflow (plugin 0.4 and
// earlier: a state.json without "schema") to the design-only state, schema 2.
//
//   node migrate-state.mjs --root <project root> [--dry-run] [--now <ISO time>]
//
// Idempotent: a schema-2 state is reported and left alone. It archives the old
// state, then writes the new one atomically and appends to .fashion/migration.md.
// It only reads tickets/, prototypes/ and .fashion/processes/: it never edits,
// deletes, stops or relaunches anything from the old workflow, and never runs git.
// Prints one JSON line. Exit codes: 0 done or nothing to do, 2 usage or no
// state, 3 unreadable or unsupported state.
import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SCHEMA = 2;
const LIVE_STAGES = new Set(["building", "merging", "checking", "fixing"]);
const RESEARCH_FILES = ["research/competitors.md", "ux/design-systems.md", "ux/directions.md"];
const LEFT_UNTOUCHED = ["tickets/", "prototypes/", ".fashion/processes/", ".fashion/browser-runtime.json"];
const PHASES = { 1: "brief", 2: "research", 3: "direction", 4: "direction", done: "done" };

export function initialState() {
  return {
    schema: SCHEMA,
    phase: "brief",
    platform: null,
    mobileOS: null,
    siteType: null,
    siteUrl: null,
    backend: { tool: "stitch", status: "unchecked", checkedAt: null, projectId: null, fileUrl: null, designSystemId: null },
    research: { status: "pending", taskId: null },
    references: [],
    decisions: [],
    openQuestions: [],
    direction: { round: 0, candidates: [], chosen: null },
    screens: [],
    critic: { taskId: null, round: 0 },
    approvals: { brief: false, direction: false, screens: false, handoff: false },
    models: { research: "opus", critic: "sonnet" },
    legacy: null,
  };
}

export class MigrationError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

export function inventory(root) {
  const rel = (file) => path.relative(root, file).split(path.sep).join("/");
  const tickets = [];
  const ticketsDir = path.join(root, "tickets");
  if (existsSync(ticketsDir)) {
    for (const entry of readdirSync(ticketsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      let stage = "unknown";
      let taskId = null;
      try {
        const state = readJson(path.join(ticketsDir, entry.name, "state.json"));
        if (typeof state.stage === "string") stage = state.stage;
        if (typeof state.taskId === "string") taskId = state.taskId;
      } catch {
        // Missing or invalid ticket state is reported as stage "unknown".
      }
      tickets.push({ id: entry.name, stage, taskId });
    }
  }
  tickets.sort((a, b) => a.id.localeCompare(b.id));
  const processRecords = walk(path.join(root, ".fashion", "processes"))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => {
      try {
        const record = readJson(file);
        if (record.status !== "running") return [];
        return [{
          file: rel(file), owner: record.owner ?? null, role: record.role ?? null,
          pid: record.pid ?? null, port: record.port ?? null, command: record.command ?? null,
        }];
      } catch {
        return [{ file: rel(file), unreadable: true }];
      }
    });
  return {
    tickets,
    processRecords,
    prototypeScreenshots: walk(path.join(root, "prototypes"))
      .filter((file) => /\.(png|jpe?g|webp)$/i.test(file)).map(rel).sort(),
    researchFiles: RESEARCH_FILES.filter((file) => existsSync(path.join(root, file))),
    untouched: LEFT_UNTOUCHED.filter((entry) => existsSync(path.join(root, entry))),
  };
}

function researchStatus(old, inv, accepted) {
  if (old.researcherDone === true && old.analystDone === true) return "done";
  if (inv.researchFiles.length) return accepted ? "done" : "partial";
  return accepted ? "skipped" : "pending";
}

export function migrateState(old, inv, now) {
  const phase = old.phase ?? 1;
  const mapped = PHASES[phase];
  if (!mapped) throw new MigrationError(`unrecognized legacy phase ${JSON.stringify(old.phase)}`, 3);
  const next = initialState();
  next.phase = mapped;
  for (const key of ["platform", "siteType", "siteUrl"]) if (old[key] !== undefined) next[key] = old[key];
  for (const key of ["references", "decisions", "openQuestions"]) if (Array.isArray(old[key])) next[key] = [...old[key]];
  if (typeof old.models?.research === "string") next.models.research = old.models.research;
  if (old.mobileStack === "swiftui") next.mobileOS = "ios";
  else if (old.platform === "mobile") {
    next.openQuestions.push(
      `Mobile OS: iOS, Android or both? The retired build workflow recorded only a code stack (${old.mobileStack ?? "none"}).`,
    );
  }
  const started = mapped !== "brief";
  const accepted = started && mapped !== "research";
  next.approvals.brief = started;
  next.research.status = started ? researchStatus(old, inv, accepted) : "pending";
  if (Array.isArray(old.screens)) {
    next.screens = old.screens
      .filter((screen) => screen && typeof screen.id === "string")
      .map((screen) => ({
        id: screen.id,
        title: typeof screen.title === "string" ? screen.title : screen.id,
        states: ["default"],
        frames: [],
        status: "planned",
        round: 0,
      }));
  }
  const byStage = {};
  for (const ticket of inv.tickets) byStage[ticket.stage] = (byStage[ticket.stage] ?? 0) + 1;
  next.legacy = {
    fromSchema: 1,
    fromPhase: phase,
    migratedAt: now,
    archive: null,
    recreateBaseline: mapped === "done" || String(phase) === "4",
    completedUnderBuildWorkflow: mapped === "done",
    tickets: { total: inv.tickets.length, byStage },
    activeTickets: inv.tickets.filter((t) => LIVE_STAGES.has(t.stage) || (t.taskId !== null && t.stage !== "done")),
    processRecords: inv.processRecords,
    prototypeScreenshots: inv.prototypeScreenshots,
    untouched: inv.untouched,
  };
  return next;
}

function parseArgs(argv) {
  const opts = { root: null, now: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--root" || arg === "--now") {
      const value = argv[++i];
      if (!value) throw new MigrationError(`${arg} needs a value`, 2);
      opts[arg.slice(2)] = value;
    } else throw new MigrationError(`unknown argument ${arg}`, 2);
  }
  if (!opts.root) throw new MigrationError("usage: migrate-state.mjs --root <project root> [--dry-run] [--now <ISO time>]", 2);
  if (opts.now !== null && Number.isNaN(Date.parse(opts.now))) throw new MigrationError(`invalid --now ${opts.now}`, 2);
  return opts;
}

// Reuses an archive that already holds these exact bytes (a rerun after an
// interrupted migration); never overwrites a different one.
function archivePath(root, original) {
  const dir = path.join(root, ".fashion", "legacy");
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? "state-v1.json" : `state-v1-${n}.json`);
    if (!existsSync(candidate) || readFileSync(candidate, "utf8") === original) return candidate;
  }
}

function logEntry(state) {
  const legacy = state.legacy;
  const lines = [
    `## ${legacy.migratedAt}: schema 1 to 2`,
    `- Phase ${JSON.stringify(legacy.fromPhase)} became \`${state.phase}\`. Research: \`${state.research.status}\`.`,
    `- Old state archived at \`${legacy.archive}\`.`,
    "- The build workflow is retired: nothing was built, merged, checked, stopped or deleted.",
  ];
  if (legacy.untouched.length) lines.push(`- Left as they were: ${legacy.untouched.map((p) => `\`${p}\``).join(", ")}.`);
  if (legacy.activeTickets.length) {
    lines.push(`- Tickets in flight, not resumed: ${legacy.activeTickets
      .map((t) => `${t.id} (${t.stage}${t.taskId ? `, task ${t.taskId}` : ""})`).join(", ")}.`);
  }
  if (legacy.processRecords.length) {
    lines.push(`- Process records still marked running, not stopped: ${legacy.processRecords.map((r) => r.file).join(", ")}.`);
  }
  return lines.join("\n") + "\n\n";
}

export function run(argv) {
  const opts = parseArgs(argv);
  const root = path.resolve(opts.root);
  const stateFile = path.join(root, ".fashion", "state.json");
  if (!existsSync(stateFile)) throw new MigrationError(`no Fashion state at ${stateFile}; run /fashion:start`, 2);
  const original = readFileSync(stateFile, "utf8");
  let old;
  try {
    old = JSON.parse(original);
  } catch (error) {
    throw new MigrationError(`state.json is not valid JSON: ${error.message}`, 3);
  }
  if (!old || typeof old !== "object" || Array.isArray(old)) throw new MigrationError("state.json is not a JSON object", 3);
  if (old.schema === SCHEMA) return { migrated: false, reason: "already schema 2", phase: old.phase };
  if (old.schema !== undefined) throw new MigrationError(`unsupported state schema ${JSON.stringify(old.schema)}`, 3);

  const next = migrateState(old, inventory(root), opts.now ?? new Date().toISOString());
  const archive = archivePath(root, original);
  next.legacy.archive = path.relative(root, archive).split(path.sep).join("/");
  const summary = {
    migrated: !opts.dryRun,
    dryRun: opts.dryRun,
    fromPhase: next.legacy.fromPhase,
    phase: next.phase,
    archive: next.legacy.archive,
    researchStatus: next.research.status,
    activeTickets: next.legacy.activeTickets,
    processRecords: next.legacy.processRecords,
    prototypeScreenshots: next.legacy.prototypeScreenshots.length,
    untouched: next.legacy.untouched,
  };
  if (opts.dryRun) return summary;

  mkdirSync(path.dirname(archive), { recursive: true });
  if (!existsSync(archive)) writeFileSync(archive, original);
  const temporary = `${stateFile}.tmp-${process.pid}`;
  writeFileSync(temporary, JSON.stringify(next, null, 2) + "\n");
  renameSync(temporary, stateFile);
  appendFileSync(path.join(root, ".fashion", "migration.md"), logEntry(next));
  return summary;
}

function main() {
  try {
    console.log(JSON.stringify(run(process.argv.slice(2))));
  } catch (error) {
    if (!(error instanceof MigrationError)) throw error;
    console.error(error.message);
    process.exitCode = error.code;
  }
}

const invoked = process.argv[1] && (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (invoked) main();
