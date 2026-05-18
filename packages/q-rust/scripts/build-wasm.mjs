#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'pkg');
const appPkg = resolve(root, '../../app/src/lib/browser/q-rust/pkg');
const appArtifacts = [
  resolve(appPkg, 'q_wasm.js'),
  resolve(appPkg, 'q_wasm_bg.wasm'),
];

function hasCommand(command) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(probe, [command], { stdio: 'ignore' });
  return result.status === 0;
}

function hasPrebuiltArtifacts() {
  return appArtifacts.every((path) => existsSync(path));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root, ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!hasCommand('cargo') || !hasCommand('wasm-bindgen')) {
  if (hasPrebuiltArtifacts()) {
    console.log(
      '[q-rust] cargo/wasm-bindgen not available; using committed WASM in app/src/lib/browser/q-rust/pkg/'
    );
    process.exit(0);
  }

  console.error(
    '[q-rust] cannot build WASM: cargo and wasm-bindgen are required but not on PATH, and prebuilt artifacts are missing.'
  );
  console.error('[q-rust] Install Rust (https://rustup.rs), then: rustup target add wasm32-unknown-unknown');
  console.error('[q-rust] cargo install wasm-bindgen-cli --version 0.2.100 --locked');
  process.exit(1);
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
console.log(`[q-rust] copied wasm package to ${appPkg}`);
