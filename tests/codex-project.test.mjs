import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import { initProject } from '../plugins/fashion/scripts/codex-project.mjs';

const root = mkdtempSync(path.join(tmpdir(), 'fashion-codex-'));
after(() => rmSync(root, { recursive: true, force: true }));
const project = (name) => { const dir = path.join(root, name); mkdirSync(dir); return dir; };

test('start creates the shared state contract with inherited models and no host config or Git repo', () => {
  const dir = project('new project');
  initProject(dir);
  assert.deepEqual(readdirSync(dir).sort(), ['.fashion', 'handoff', 'references', 'research', 'ux']);
  const state = JSON.parse(readFileSync(path.join(dir, '.fashion/state.json')));
  const workflow = readFileSync(new URL('../plugins/fashion/skills/fashion/SKILL.md', import.meta.url), 'utf8');
  const template = JSON.parse(workflow.split('## state.json\n```json\n')[1].split('\n```')[0]);
  template.models = { research: 'inherit', critic: 'inherit' };
  assert.deepEqual(state, template);
});

test('repeated start preserves existing state and brief', () => {
  const dir = project('existing');
  initProject(dir);
  const brief = path.join(dir, '.fashion/brief.md');
  writeFileSync(brief, 'Approved brief');
  const before = readFileSync(path.join(dir, '.fashion/state.json'), 'utf8');
  assert.throws(() => initProject(dir), /already exists/);
  assert.equal(readFileSync(brief, 'utf8'), 'Approved brief');
  assert.equal(readFileSync(path.join(dir, '.fashion/state.json'), 'utf8'), before);
});

test('start preserves existing project content and Claude/Codex configuration', () => {
  const dir = project('with content');
  for (const name of ['references', '.claude', '.codex']) mkdirSync(path.join(dir, name));
  const files = ['references/brand.png', '.claude/settings.json', '.codex/config.toml', 'package.json'];
  for (const file of files) writeFileSync(path.join(dir, file), 'existing');
  initProject(dir);
  for (const file of files) assert.equal(readFileSync(path.join(dir, file), 'utf8'), 'existing');
});

test('a colliding file fails before any scaffold is written', () => {
  const dir = project('collision');
  writeFileSync(path.join(dir, 'ux'), 'keep');
  assert.throws(() => initProject(dir), /must be a directory/);
  assert.deepEqual(readdirSync(dir), ['ux']);
});

test('scaffold rejects a symlink outside the project and a dangling .fashion symlink', () => {
  const dir = project('symlink');
  const outside = project('outside');
  symlinkSync(outside, path.join(dir, 'references'));
  assert.throws(() => initProject(dir), /must be a directory/);
  assert.deepEqual(readdirSync(outside), []);
  const dangling = project('dangling');
  symlinkSync(path.join(root, 'absent'), path.join(dangling, '.fashion'));
  assert.throws(() => initProject(dangling), /already exists/);
});

test('CLI handles a spaced root and rejects extra arguments without creating a project', () => {
  const script = new URL('../plugins/fashion/scripts/codex-project.mjs', import.meta.url).pathname;
  const dir = project('cli project');
  const result = spawnSync(process.execPath, [script, 'init', '--root', dir], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).runtime, 'codex');
  const untouched = project('bad args');
  const invalid = spawnSync(process.execPath, [script, 'init', '--root', untouched, '--force'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Usage:/);
  assert.deepEqual(readdirSync(untouched), []);
});

test('CLI invoked through a symlink actually initializes the project', () => {
  const script = new URL('../plugins/fashion/scripts/codex-project.mjs', import.meta.url).pathname;
  const linkedScript = path.join(root, 'linked-project.mjs');
  symlinkSync(script, linkedScript);
  const dir = project('linked invocation');
  const result = spawnSync(process.execPath, [linkedScript, 'init', '--root', dir], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).runtime, 'codex');
  assert.equal(JSON.parse(readFileSync(path.join(dir, '.fashion/state.json'))).phase, 'brief');
});
