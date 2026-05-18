#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'pkg');
const appPkg = resolve(root, '../../app/src/lib/browser/q-rust/pkg');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root, ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('cargo', ['build', '--release', '-p', 'q_wasm', '--target', 'wasm32-unknown-unknown']);

mkdirSync(outDir, { recursive: true });
run('wasm-bindgen', [
  resolve(root, 'target/wasm32-unknown-unknown/release/q_wasm.wasm'),
  '--out-dir',
  outDir,
  '--target',
  'web',
  '--no-typescript',
]);

rmSync(appPkg, { recursive: true, force: true });
mkdirSync(dirname(appPkg), { recursive: true });
cpSync(outDir, appPkg, { recursive: true });
console.log(`Copied wasm package to ${appPkg}`);
