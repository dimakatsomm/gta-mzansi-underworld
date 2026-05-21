#!/usr/bin/env node
// Cross-platform: shallow-clone pinned QBox framework dependencies.
// Run via: pnpm fivem:deps  (from repo root)
// Safe to re-run: skips any dep whose directory already exists.

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..'); // apps/fivem-resources/

const deps = [
  { name: 'ox_lib',       url: 'https://github.com/overextended/ox_lib',       tag: 'v3.14.0' },
  { name: 'ox_inventory', url: 'https://github.com/overextended/ox_inventory',  tag: 'v2.35.1' },
  { name: 'qbx_core',     url: 'https://github.com/Qbox-project/qbx_core',     tag: 'v1.37.0' },
];

for (const dep of deps) {
  const dest = join(root, dep.name);
  if (existsSync(dest)) {
    console.log(`[${dep.name}] already present — skipping`);
    continue;
  }
  console.log(`[${dep.name}] cloning ${dep.tag} ...`);
  try {
    execSync(`git clone --depth 1 --branch ${dep.tag} ${dep.url} ${dest}`, { stdio: 'inherit' });
  } catch (err) {
    // Clean up partial directory so re-runs don't silently skip a corrupt tree
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    throw err;
  }
  console.log(`[${dep.name}] done`);
}

console.log('\nAll FiveM framework dependencies ready.');
