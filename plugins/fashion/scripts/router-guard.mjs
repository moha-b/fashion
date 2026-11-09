#!/usr/bin/env node
// PreToolUse hook: keeps the fashion router from writing app code.
// Acts only when the hook fires in the router itself (agent_type "router" or
// "fashion:router"). Subagents carry their own agent_type, so workers pass.
// Fails open on any parse error so a broken hook never blocks other sessions.
import { readFileSync } from "node:fs";
import path from "node:path";

const ROUTER_TYPES = new Set(["router", "fashion:router"]);
const ALLOWED_DIRS = [".fashion", "tickets", "research", "ux", "references"];
const ALLOWED_FILES = [".claude/settings.json", ".gitignore"];

function isAllowed(relative) {
  if (ALLOWED_FILES.includes(relative)) return true;
  const first = relative.split("/")[0];
  return ALLOWED_DIRS.includes(first);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

if (!ROUTER_TYPES.has(input.agent_type)) process.exit(0);

const tool = input.tool_input ?? {};
const target = tool.file_path ?? tool.notebook_path;
if (typeof target !== "string" || target === "") process.exit(0);

const root = input.cwd ?? process.cwd();
const relative = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");
const outside = relative.startsWith("..") || path.isAbsolute(relative);

if (!outside && isAllowed(relative)) process.exit(0);

process.stderr.write(
  `Blocked: the fashion router does not write app code (${target}). ` +
    `It may write only ${ALLOWED_DIRS.map((d) => d + "/").join(", ")}, ${ALLOWED_FILES.join(", ")}. ` +
    `Put this change in a ticket and assign it to a worker.\n`,
);
process.exit(2);
