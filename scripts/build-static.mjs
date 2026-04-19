#!/usr/bin/env node
// Build a zero-install static site (browser backend) to qanvas/dist-static/
import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const appDist = resolve(root, 'app/dist');
const outDir = resolve(root, 'dist-static');

console.log('[static] building app…');
const r = spawnSync('npm', ['run', 'build', '--workspace', 'app'], {
  cwd: root,
  stdio: 'inherit',
});
if (r.status !== 0) process.exit(r.status ?? 1);

if (!existsSync(appDist)) {
  console.error(`[static] expected ${appDist} to exist after build`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(appDist, outDir, { recursive: true });

// Drop a sentinel telling the app to default to the browser backend.
writeFileSync(
  resolve(outDir, 'qanvas-default-backend.json'),
  JSON.stringify({ kind: 'browser' }, null, 2),
);

console.log(`[static] wrote ${outDir}`);
console.log('[static] serve with: npx http-server dist-static -p 8080');
