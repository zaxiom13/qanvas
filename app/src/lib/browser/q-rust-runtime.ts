/// <reference lib="webworker" />

import { installQrustHost, uninstallQrustHost } from './q-rust-host';
import type { HostFileSystem } from '@qpad/engine';
import init, { QRuntime } from './q-rust/pkg/q_wasm.js';
import wasmUrl from './q-rust/pkg/q_wasm_bg.wasm?url';

let wasmReady: Promise<void> | null = null;
let runtime: QRuntime | null = null;

async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      await init({ module_or_path: wasmUrl });
    })();
  }
  await wasmReady;
}

/** Warm WASM in the worker so the first sketch run can use Rust without a cold-start miss. */
export function preloadRustWasm() {
  return ensureWasm();
}

export async function createRustWasmRuntime(files: SketchFile[], fs: HostFileSystem) {
  await ensureWasm();
  installQrustHost(fs);
  runtime = new QRuntime();
  const payload = JSON.stringify(
    files.map((file) => ({
      name: file.name,
      content: file.content ?? '',
    }))
  );
  runtime.loadFiles(payload);
  const configJson = runtime.initSketch();
  const config = JSON.parse(configJson) as Record<string, unknown>;
  return { runtime, config };
}

export function runRustWasmFrame(
  instance: QRuntime,
  frameInfo: Record<string, unknown>,
  input: Record<string, unknown>,
  canvas: Record<string, unknown>
) {
  const commandsJson = instance.runFrame(
    JSON.stringify(frameInfo),
    JSON.stringify(input),
    JSON.stringify(canvas)
  );
  return JSON.parse(commandsJson) as Record<string, unknown>[];
}

export function rustWasmStartCommands(instance: QRuntime) {
  const commandsJson = instance.startCommands();
  return JSON.parse(commandsJson) as Record<string, unknown>[];
}

export async function rustWasmQuery(instance: QRuntime, expression: string) {
  const raw = instance.query(expression);
  return JSON.parse(raw) as RuntimeQueryResult;
}

export function disposeRustWasmRuntime() {
  runtime?.reset();
  runtime = null;
  uninstallQrustHost();
}

export type { QRuntime };
