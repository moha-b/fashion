#!/usr/bin/env node
// PreToolUse hook: keeps Fashion's own agents design-only.
// Acts only for Fashion agents (router, researcher, visual-critic, with or
// without the "fashion:" prefix); other agents and sessions pass untouched.
// It blocks writes outside the Fashion folders, and code files anywhere, so
// no application code or provider-generated code lands in a Fashion project.
// Fails open on a parse error so a broken hook never blocks other sessions.
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const FASHION_AGENTS = new Set(
  ["router", "researcher", "visual-critic"].flatMap((name) => [name, `fashion:${name}`]),
);
const ALLOWED_DIRS = [".fashion", "research", "ux", "references", "handoff"];
const ALLOWED_FILES = [".claude/settings.json", ".gitignore"];
const CODE_EXTENSIONS = new Set([
  ".html", ".htm", ".xhtml", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx",
  ".css", ".scss", ".sass", ".less", ".vue", ".svelte", ".astro", ".dart", ".swift", ".kt",
  ".kts", ".java", ".m", ".mm", ".py", ".rb", ".php", ".go", ".rs", ".sh",
]);

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

function block(reason) {
  process.stderr.write(
    `Blocked: Fashion is design-only and writes no application code (${reason}). ` +
      `Fashion's agents may write only non-code files in ${ALLOWED_DIRS.map((d) => d + "/").join(", ")} ` +
      `and ${ALLOWED_FILES.join(", ")} in the project root. ` +
      `Make design changes in the design tool (Stitch or Figma) or in the Fashion docs.\n`,
  );
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

if (!FASHION_AGENTS.has(input?.agent_type)) process.exit(0);

const tool = input.tool_input ?? {};
const raw = tool.file_path ?? tool.notebook_path;
if (typeof raw !== "string" || raw === "") process.exit(0);

if (CODE_EXTENSIONS.has(path.extname(raw).toLowerCase())) block(`${raw} is a code file`);

const roots = [process.env.CLAUDE_PROJECT_DIR, input.cwd, process.cwd()]
  .filter((r) => typeof r === "string" && r !== "")
  .map(realish);
const base = roots[0] ?? process.cwd();
const target = realish(path.resolve(base, raw));

if (roots.some((root) => allowedUnder(root, target))) process.exit(0);
block(`${raw} is outside the Fashion folders`);
