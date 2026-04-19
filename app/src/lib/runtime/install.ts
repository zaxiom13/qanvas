/**
 * Bridges the new pluggable RuntimeBackend onto the existing `window.browserAPI`
 * surface used everywhere in the existing UI. By doing this we do NOT need to
 * refactor the rest of the app — swapping the backend at runtime Just Works.
 *
 * Project storage (localStorage) stays in the browser regardless of backend.
 */

import type { QanvasBackendConfig, QanvasRuntime } from './backend';
import { createRuntime } from './adapters';

const STORAGE_KEYS = {
  runtimePath: 'runtimePath',
  projectsIndex: 'qanvas:projects:index',
  projectPrefix: 'qanvas:project:',
};

type StoredProjectRecord = ProjectSnapshot & { updatedAt: number };

// ---------- runtime container ----------

let currentRuntime: QanvasRuntime | null = null;
let currentInfoLabel = 'Browser (jqport)';
const runtimeListeners = {
  stdout: new Set<(v: string) => void>(),
  stderr: new Set<(v: string) => void>(),
  exit: new Set<(n: number) => void>(),
  info: new Set<(label: string) => void>(),
};
const subscriptions: Array<() => void> = [];

function disposeRuntime() {
  for (const off of subscriptions.splice(0)) off();
  if (currentRuntime) {
    try { currentRuntime.dispose(); } catch { /* ignore */ }
    currentRuntime = null;
  }
}

function attachRuntime(runtime: QanvasRuntime) {
  subscriptions.push(runtime.onStdout((v) => runtimeListeners.stdout.forEach((cb) => cb(v))));
  subscriptions.push(runtime.onStderr((v) => runtimeListeners.stderr.forEach((cb) => cb(v))));
  subscriptions.push(runtime.onExit((c) => runtimeListeners.exit.forEach((cb) => cb(c))));
  subscriptions.push(runtime.onInfoChange((info) => {
    currentInfoLabel = info.label;
    runtimeListeners.info.forEach((cb) => cb(info.label));
  }));
  currentInfoLabel = runtime.info().label;
  runtimeListeners.info.forEach((cb) => cb(currentInfoLabel));
}

export function switchBackend(config: QanvasBackendConfig) {
  disposeRuntime();
  const runtime = createRuntime(config);
  currentRuntime = runtime;
  attachRuntime(runtime);
  return runtime.info();
}

export function getCurrentRuntime(): QanvasRuntime {
  if (!currentRuntime) {
    throw new Error('No runtime installed. Call switchBackend() first.');
  }
  return currentRuntime;
}

// ---------- localStorage project storage ----------

function readStored(key: string) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStored(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}
function readJson<T>(key: string, fallback: T): T {
  const raw = readStored(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
function writeJson(key: string, value: unknown) { writeStored(key, JSON.stringify(value)); }

function slug(name: string) {
  return (name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled');
}
function projectPath(name: string) {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `qanvas://projects/${slug(name)}-${rnd}`;
}
function keyOf(p: string) { return `${STORAGE_KEYS.projectPrefix}${encodeURIComponent(p)}`; }

function toSnapshot(p: StoredProjectRecord): ProjectSnapshot {
  return {
    projectName: p.projectName,
    projectPath: p.projectPath,
    activeFileName: p.activeFileName,
    files: p.files.map((f) => ({ ...f })),
    assets: p.assets.map((a) => ({ ...a })),
  };
}

function listProjectRecords(): StoredProjectRecord[] {
  const index = readJson<string[]>(STORAGE_KEYS.projectsIndex, []);
  return index
    .map((p) => readJson<StoredProjectRecord | null>(keyOf(p), null))
    .filter((x): x is StoredProjectRecord => Boolean(x));
}

// ---------- install BrowserRendererAPI ----------

export function installQanvasAPI(): BrowserRendererAPI {
  if (!readStored(STORAGE_KEYS.runtimePath)) {
    writeStored(STORAGE_KEYS.runtimePath, 'qanvas://runtime');
  }

  const api: BrowserRendererAPI = {
    pickAssets: async () => [],
    getProjectsRoot: async () => 'qanvas://projects',
    listProjects: async () =>
      listProjectRecords()
        .map((p) => ({
          projectName: p.projectName,
          projectPath: p.projectPath,
          updatedAt: p.updatedAt,
          fileCount: p.files.length,
          assetCount: p.assets.length,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    readProject: async (p) => {
      const rec = readJson<StoredProjectRecord | null>(keyOf(p), null);
      if (!rec) throw new Error(`Project not found: ${p}`);
      return toSnapshot(rec);
    },
    saveProject: async (payload) => {
      const p = payload.projectPath?.trim() || projectPath(payload.projectName);
      const rec: StoredProjectRecord = {
        projectName: payload.projectName,
        projectPath: p,
        activeFileName: payload.activeFileName,
        files: payload.files.map((f) => ({ ...f })),
        assets: payload.assets.map((a) => ({ ...a })),
        updatedAt: Date.now(),
      };
      writeJson(keyOf(p), rec);
      const idx = readJson<string[]>(STORAGE_KEYS.projectsIndex, []).filter((x) => x !== p);
      idx.unshift(p);
      writeJson(STORAGE_KEYS.projectsIndex, idx);
      return toSnapshot(rec);
    },
    detectRuntime: async () => currentInfoLabel,
    startRuntime: async (payload) => getCurrentRuntime().start(payload),
    startCommandsRuntime: async () => getCurrentRuntime().startCommands(),
    frameRuntime: async (payload) => getCurrentRuntime().frame(payload),
    queryRuntime: async (payload) => getCurrentRuntime().query(payload),
    stopRuntime: async () => { await getCurrentRuntime().stop(); },
    onMenuEvent: () => () => {},
    onRuntimeStdout: (cb) => { runtimeListeners.stdout.add(cb); return () => runtimeListeners.stdout.delete(cb); },
    onRuntimeStderr: (cb) => { runtimeListeners.stderr.add(cb); return () => runtimeListeners.stderr.delete(cb); },
    onRuntimeExit: (cb) => { runtimeListeners.exit.add(cb); return () => runtimeListeners.exit.delete(cb); },
  };

  (window as Window).browserAPI = api;
  return api;
}

export function subscribeRuntimeInfo(cb: (label: string) => void): () => void {
  runtimeListeners.info.add(cb);
  cb(currentInfoLabel);
  return () => runtimeListeners.info.delete(cb);
}
