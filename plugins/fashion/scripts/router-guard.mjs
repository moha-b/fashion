#!/usr/bin/env node
// PreToolUse hook: keeps the fashion router from writing app code.
// Acts only when the hook fires in the router itself (agent_type "router" or
// "fashion:router"). Subagents carry their own agent_type, so workers pass.
// Fails open on any parse error so a broken hook never blocks other sessions.
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const ROUTER_TYPES = new Set(["router", "fashion:router"]);
const ALLOWED_DIRS = [".fashion", "tickets", "research", "ux", "references"];
const ALLOWED_FILES = [".claude/settings.json", ".gitignore"];

// Resolve symlinks (macOS /tmp -> /private/tmp) on the deepest part of the
// path that exists, so a file that is about to be created still compares.
function realish(p) {
  const tail = [];
  let head = path.resolve(p);
  for (;;) {
    try {
      return path.join(realpathSync(head), ...tail);
    } catch {
      const parent = path.dirname(head);
      if (parent === head) return path.resolve(p);
      tail.unshift(path.basename(head));
      head = parent;
    }
  }
}

function allowedUnder(root, target) {
  const relative = path.relative(root, target).split(path.sep).join("/");
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return false;
  return ALLOWED_FILES.includes(relative) || ALLOWED_DIRS.includes(relative.split("/")[0]);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

if (!ROUTER_TYPES.has(input.agent_type)) process.exit(0);

const tool = input.tool_input ?? {};
const raw = tool.file_path ?? tool.notebook_path;
if (typeof raw !== "string" || raw === "") process.exit(0);

const roots = [process.env.CLAUDE_PROJECT_DIR, input.cwd, process.cwd()]
  .filter((r) => typeof r === "string" && r !== "")
  .map(realish);
const base = roots[0] ?? process.cwd();
const target = realish(path.resolve(base, raw));

if (roots.some((root) => allowedUnder(root, target))) process.exit(0);

process.stderr.write(
  `Blocked: the fashion router does not write app code (${raw}). ` +
    `It may write only ${ALLOWED_DIRS.map((d) => d + "/").join(", ")}, ${ALLOWED_FILES.join(", ")} ` +
    `in the project root. Put this change in a ticket and assign it to a worker.\n`,
);
process.exit(2);
