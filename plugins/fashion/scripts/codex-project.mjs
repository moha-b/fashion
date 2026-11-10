#!/usr/bin/env node
// Initialize local project metadata without granting permissions or changing host configuration.
import { lstatSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const initialState = {
  phase: 1, loop: 0, platform: null, mobileStack: null, siteType: null, siteUrl: null,
  decisions: [], openQuestions: [], references: [], researcherDone: false,
  analystDone: false, postedCompetitors: 0,
  models: { research: 'inherit', implement: 'inherit', watchdog: 'inherit' },
  git: null, maxWorkers: 3, screens: [], currentScreen: null,
};

function existingEntry(file) {
  try { return lstatSync(file); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function validateRoot(root) {
  if (existingEntry(path.join(root, '.fashion'))) {
    throw new Error('Fashion project already exists; use $fashion:fashion resume. Nothing changed.');
  }
  for (const name of ['research', 'ux', 'references']) {
    const entry = existingEntry(path.join(root, name));
    if (entry && (!entry.isDirectory() || entry.isSymbolicLink())) {
      throw new Error(`${name} must be a directory inside the project; nothing changed.`);
    }
  }
}

export function initProject(directory) {
  const root = realpathSync(directory);
  validateRoot(root);
  mkdirSync(path.join(root, '.fashion'));
  writeFileSync(path.join(root, '.fashion', 'state.json'), JSON.stringify(initialState, null, 2) + '\n', { flag: 'wx' });
  writeFileSync(path.join(root, '.fashion', 'brief.md'), '# Brief\n', { flag: 'wx' });
  for (const name of ['research', 'ux', 'references']) {
    mkdirSync(path.join(root, name), { recursive: true });
    const keep = path.join(root, name, '.gitkeep');
    if (!existingEntry(keep)) writeFileSync(keep, '', { flag: 'wx' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const [action, flag, directory, ...extra] = process.argv.slice(2);
    if (action !== 'init' || flag !== '--root' || !directory || extra.length) {
      throw new Error('Usage: node codex-project.mjs init --root <project-directory>');
    }
    initProject(directory);
    console.log(JSON.stringify({ root: realpathSync(directory), phase: 1, runtime: 'codex' }));
  } catch (error) {
    console.error(`fashion: ${error.message}`);
    process.exitCode = 1;
  }
}
