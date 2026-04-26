const BROWSER_RUNTIME_PATH = 'browser://q-engine';
const STORAGE_KEYS = {
  runtimePath: 'runtimePath',
  projectsIndex: 'qanvas5:browser:projects:index',
  projectPrefix: 'qanvas5:browser:project:',
};

type RuntimeRequest =
  | { id: number; type: 'start'; payload: RuntimeStartPayload }
  | { id: number; type: 'start-commands' }
  | { id: number; type: 'frame'; payload: RuntimeFramePayload }
  | { id: number; type: 'query'; payload: RuntimeQueryPayload }
  | { id: number; type: 'stop' };

type RuntimeResponse =
  | { id: number; ok: true; type: 'start'; value: RuntimeStartResult }
  | { id: number; ok: true; type: 'start-commands'; value: RuntimeStartCommandsResult }
  | { id: number; ok: true; type: 'frame'; value: Record<string, unknown>[] }
  | { id: number; ok: true; type: 'query'; value: RuntimeQueryResult }
  | { id: number; ok: true; type: 'stop'; value: null }
  | { id: number; ok: false; error: string }
  | { type: 'stdout'; value: string }
  | { type: 'stderr'; value: string }
  | { type: 'exit'; code: number };

type RuntimeRequestType = RuntimeRequest['type'];

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  type: RuntimeRequestType;
};

type StoredProjectRecord = ProjectSnapshot & {
  updatedAt: number;
};

type BrowserAPI = BrowserRendererAPI;

const eventListeners = {
  stdout: new Set<(value: string) => void>(),
  stderr: new Set<(value: string) => void>(),
  exit: new Set<(code: number) => void>(),
};

let runtimeWorker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

const memoryStorage = new Map<string, string>();

function ensureBrowserRuntimePath() {
  const current = readStored(STORAGE_KEYS.runtimePath);
  if (!current) {
    writeStored(STORAGE_KEYS.runtimePath, BROWSER_RUNTIME_PATH);
  }

  return readStored(STORAGE_KEYS.runtimePath) || BROWSER_RUNTIME_PATH;
}

function readStored(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStorage.get(key) ?? null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryStorage.set(key, value);
  }
}

function removeStored(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memoryStorage.delete(key);
  }
}

function readJson<T>(key: string, fallback: T): T {
  const raw = readStored(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  writeStored(key, JSON.stringify(value));
}

function projectStorageKey(projectPath: string) {
  return `${STORAGE_KEYS.projectPrefix}${encodeURIComponent(projectPath)}`;
}

function getStoredProjectIndex() {
  return readJson<string[]>(STORAGE_KEYS.projectsIndex, []);
}

function setStoredProjectIndex(projectPaths: string[]) {
  writeJson(STORAGE_KEYS.projectsIndex, projectPaths);
}

function slugifyProjectName(projectName: string) {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'untitled';
}

function createProjectPath(projectName: string) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `browser://projects/${slugifyProjectName(projectName)}-${suffix}`;
}

function cloneSnapshot(payload: ProjectPayload, projectPath: string): StoredProjectRecord {
  return {
    projectName: payload.projectName,
    projectPath,
    activeFileName: payload.activeFileName,
    files: payload.files.map((file) => ({ ...file })),
    assets: payload.assets.map((asset) => ({ ...asset })),
    updatedAt: Date.now(),
  };
}

function sanitizeSnapshot(snapshot: StoredProjectRecord): ProjectSnapshot {
  return {
    projectName: snapshot.projectName,
    projectPath: snapshot.projectPath,
    activeFileName: snapshot.activeFileName,
    files: snapshot.files.map((file) => ({ ...file })),
    assets: snapshot.assets.map((asset) => ({ ...asset })),
  };
}

function readProjectRecord(projectPath: string) {
  return readJson<StoredProjectRecord | null>(projectStorageKey(projectPath), null);
}

function writeProjectRecord(snapshot: StoredProjectRecord) {
  writeJson(projectStorageKey(snapshot.projectPath), snapshot);
  const index = getStoredProjectIndex().filter((entry) => entry !== snapshot.projectPath);
  index.unshift(snapshot.projectPath);
  setStoredProjectIndex(index);
}

function listProjectRecords() {
  const index = getStoredProjectIndex();
  const records = index
    .map((projectPath) => readProjectRecord(projectPath))
    .filter((record): record is StoredProjectRecord => Boolean(record));

  if (records.length > 0) {
    return records;
  }

  const fallbackRecords: StoredProjectRecord[] = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(STORAGE_KEYS.projectPrefix)) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        const snapshot = JSON.parse(raw) as StoredProjectRecord;
        if (snapshot?.projectPath) {
          fallbackRecords.push(snapshot);
        }
      } catch {
        continue;
      }
    }
  } catch {
    for (const [key, raw] of memoryStorage.entries()) {
      if (!key.startsWith(STORAGE_KEYS.projectPrefix)) continue;
      try {
        const snapshot = JSON.parse(raw) as StoredProjectRecord;
        if (snapshot?.projectPath) {
          fallbackRecords.push(snapshot);
        }
      } catch {
        continue;
      }
    }
  }

  return fallbackRecords;
}

function createRuntimeWorker() {
  const worker = new Worker(new URL('./q-runtime-worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.addEventListener('message', (event: MessageEvent<RuntimeResponse>) => {
    const message = event.data;

    if ('type' in message && message.type === 'stdout') {
      eventListeners.stdout.forEach((listener) => listener(message.value));
      return;
    }

    if ('type' in message && message.type === 'stderr') {
      eventListeners.stderr.forEach((listener) => listener(message.value));
      return;
    }

    if ('type' in message && message.type === 'exit') {
      eventListeners.exit.forEach((listener) => listener(message.code));
      return;
    }

    if (!('id' in message)) return;

    const pending = pendingRequests.get(message.id);
    if (!pending) {
      return;
    }

    if ('ok' in message && !message.ok) {
      pendingRequests.delete(message.id);
      const error = new Error(message.error);
      pending.reject(error);
      emitStderr(message.error);
      return;
    }

    if ('type' in message && pending.type !== message.type) {
      return;
    }

    pendingRequests.delete(message.id);
    pending.resolve(message.value);
  });

  worker.addEventListener('error', (event) => {
    const error = event.error instanceof Error ? event.error : new Error(event.message);
    rejectAllPending(error);
    eventListeners.stderr.forEach((listener) => listener(error.message));
  });

  worker.addEventListener('messageerror', () => {
    const error = new Error('Browser q runtime message could not be decoded.');
    rejectAllPending(error);
    eventListeners.stderr.forEach((listener) => listener(error.message));
  });

  return worker;
}

function rejectAllPending(error: Error) {
  for (const [id, pending] of pendingRequests.entries()) {
    pending.reject(error);
    pendingRequests.delete(id);
  }
}

function ensureRuntimeWorker() {
  runtimeWorker ??= createRuntimeWorker();
  return runtimeWorker;
}

function requestWorker<T>(type: RuntimeRequestType, payload?: RuntimeStartPayload | RuntimeFramePayload | RuntimeQueryPayload) {
  const worker = ensureRuntimeWorker();
  const id = nextRequestId;
  nextRequestId += 1;

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, type });
    const request =
      type === 'stop'
        ? { id, type }
        : { id, type, payload };
    worker.postMessage(request);
  });
}

function emitStdout(value: string) {
  eventListeners.stdout.forEach((listener) => listener(value));
}

function emitStderr(value: string) {
  eventListeners.stderr.forEach((listener) => listener(value));
}

function pickImageAssets() {
  return new Promise<AssetEntry[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener('cancel', () => {
      cleanup();
      resolve([]);
    }, { once: true });

    input.addEventListener('change', async () => {
      const files = Array.from(input.files ?? []);
      const assets = await Promise.all(files.map((file) => new Promise<AssetEntry>((assetResolve) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          assetResolve({
            name: file.name,
            sourcePath: file.name,
            relativePath: `assets/${file.name}`,
            dataUrl: typeof reader.result === 'string' ? reader.result : null,
          });
        }, { once: true });
        reader.addEventListener('error', () => {
          assetResolve({
            name: file.name,
            sourcePath: file.name,
            relativePath: `assets/${file.name}`,
          });
        }, { once: true });
        reader.readAsDataURL(file);
      })));
      cleanup();
      resolve(assets);
    }, { once: true });

    input.click();
  });
}

export function installBrowserAPI(): BrowserAPI {
  ensureBrowserRuntimePath();

  const api: BrowserAPI = {
    pickAssets: pickImageAssets,
    getProjectsRoot: async () => 'browser://projects',
    listProjects: async () =>
      listProjectRecords()
        .map((snapshot) => ({
          projectName: snapshot.projectName,
          projectPath: snapshot.projectPath,
          updatedAt: snapshot.updatedAt,
          fileCount: snapshot.files.length,
          assetCount: snapshot.assets.length,
        }))
        .sort((left, right) => right.updatedAt - left.updatedAt),
    readProject: async (projectPath: string) => {
      const snapshot = readProjectRecord(projectPath);
      if (!snapshot) {
        throw new Error(`Project not found: ${projectPath}`);
      }
      return sanitizeSnapshot(snapshot);
    },
    saveProject: async (payload: ProjectPayload) => {
      const projectPath = payload.projectPath?.trim() || createProjectPath(payload.projectName);
      const snapshot = cloneSnapshot(payload, projectPath);
      writeProjectRecord(snapshot);
      return sanitizeSnapshot(snapshot);
    },
    detectRuntime: async () => {
      ensureBrowserRuntimePath();
      return readStored(STORAGE_KEYS.runtimePath) || BROWSER_RUNTIME_PATH;
    },
    startRuntime: async (payload: RuntimeStartPayload) =>
      requestWorker<RuntimeStartResult>('start', payload),
    startCommandsRuntime: async () =>
      requestWorker<RuntimeStartCommandsResult>('start-commands'),
    frameRuntime: async (payload: RuntimeFramePayload) =>
      requestWorker<Record<string, unknown>[]>('frame', payload),
    queryRuntime: async (payload: RuntimeQueryPayload) =>
      requestWorker<RuntimeQueryResult>('query', payload),
    stopRuntime: async () => {
      await requestWorker<null>('stop');
      emitStdout('Browser q runtime stopped.');
    },
    onMenuEvent: () => () => {},
    onRuntimeStdout: (callback: (value: string) => void) => {
      eventListeners.stdout.add(callback);
      return () => eventListeners.stdout.delete(callback);
    },
    onRuntimeStderr: (callback: (value: string) => void) => {
      eventListeners.stderr.add(callback);
      return () => eventListeners.stderr.delete(callback);
    },
    onRuntimeExit: (callback: (code: number) => void) => {
      eventListeners.exit.add(callback);
      return () => eventListeners.exit.delete(callback);
    },
  };

  (window as Window).browserAPI = api;
  return api;
}

export function resetBrowserProjectsForTests() {
  try {
    removeStored(STORAGE_KEYS.projectsIndex);
    for (const project of listProjectRecords()) {
      removeStored(projectStorageKey(project.projectPath));
    }
  } catch {
    memoryStorage.clear();
  }
}
