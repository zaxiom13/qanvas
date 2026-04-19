import type { BrowserGateway } from '$lib/browser';

export const DEFAULT_PROJECT_NAME = 'untitled';
const DEFAULT_ENTRY_FILE = 'sketch.q';

type ProjectHost = {
  projectPath: string | null;
  projectName: string;
  projectNameDraft: string;
  files: SketchFile[];
  activeFileName: string;
  assets: AssetEntry[];
  unsaved: boolean;
  projectsRoot: string;
  projectLibrary: ProjectLibraryEntry[];
  projectLibraryLoading: boolean;
  newFileName: string;
  renamingProject: boolean;
  setProjectName: (value: string, persist?: boolean) => void;
  markDirty: (options?: { refreshRuntime?: boolean }) => void;
  clearAutosave: () => void;
  appendConsole: (type: ConsoleType, text: string) => void;
};

function joinPath(...parts: string[]) {
  return parts.join('/').replace(/\/+/g, '/');
}

export class ProjectSessionController {
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(private readonly browser: BrowserGateway) {}

  startProjectRename(host: ProjectHost) {
    host.renamingProject = true;
    host.projectNameDraft = host.projectName;
  }

  finishProjectRename(host: ProjectHost, commit: boolean) {
    if (commit) {
      const nextName = host.projectNameDraft.trim() || DEFAULT_PROJECT_NAME;
      const changed = nextName !== host.projectName;
      host.setProjectName(nextName);
      if (changed) {
        host.markDirty();
      }
    } else {
      host.projectNameDraft = host.projectName;
    }

    host.renamingProject = false;
  }

  updateActiveFileContent(host: ProjectHost, content: string) {
    const activeFile = host.files.find((file) => file.name === host.activeFileName);
    if (activeFile?.content === content) {
      return false;
    }

    host.files = host.files.map((file) => (file.name === host.activeFileName ? { ...file, content } : file));
    return true;
  }

  createFile(host: ProjectHost) {
    const rawName = host.newFileName.trim();
    if (!rawName) return false;

    const nextName = rawName.includes('.') ? rawName : `${rawName}.q`;
    if (host.files.some((file) => file.name === nextName)) {
      return false;
    }

    host.files = [...host.files, { name: nextName, content: `/ ${nextName}\n` }];
    host.activeFileName = nextName;
    host.newFileName = '';
    host.markDirty({ refreshRuntime: true });
    return true;
  }

  renameFile(host: ProjectHost, oldName: string, newName: string) {
    const rawName = newName.trim();
    const trimmed = rawName.includes('.') ? rawName : `${rawName}.q`;
    if (!trimmed || trimmed === oldName || host.files.some((file) => file.name === trimmed)) {
      return false;
    }

    host.files = host.files.map((file) => (file.name === oldName ? { ...file, name: trimmed } : file));
    if (host.activeFileName === oldName) {
      host.activeFileName = trimmed;
    }
    host.markDirty({ refreshRuntime: true });
    return true;
  }

  deleteFile(host: ProjectHost, name: string) {
    if (name === DEFAULT_ENTRY_FILE) return false;

    host.files = host.files.filter((file) => file.name !== name);
    if (!host.files.some((file) => file.name === host.activeFileName)) {
      host.activeFileName = host.files[0]?.name ?? DEFAULT_ENTRY_FILE;
    }
    host.markDirty({ refreshRuntime: true });
    return true;
  }

  async importAssets(host: ProjectHost) {
    const paths = await this.browser.files.pickAssets();
    if (!paths.length) return false;

    const existing = new Set(host.assets.map((asset) => asset.name));
    const nextAssets = [...host.assets];

    for (const assetPath of paths) {
      const name = assetPath.split('/').pop() || assetPath;
      if (existing.has(name)) continue;
      existing.add(name);
      nextAssets.push({
        name,
        sourcePath: assetPath,
        relativePath: joinPath('assets', name),
      });
      host.appendConsole('info', `Asset imported: ${name}`);
    }

    if (nextAssets.length === host.assets.length) {
      return false;
    }

    host.assets = nextAssets;
    host.markDirty({ refreshRuntime: true });
    return true;
  }

  async refreshProjectLibrary(host: ProjectHost) {
    host.projectLibraryLoading = true;

    try {
      host.projectsRoot = await this.browser.projects.root();
      host.projectLibrary = await this.browser.projects.list();
    } finally {
      host.projectLibraryLoading = false;
    }
  }

  resetProject(host: ProjectHost, template: string, name: string) {
    host.clearAutosave();
    host.projectPath = null;
    host.setProjectName(name);
    host.files = [{ name: DEFAULT_ENTRY_FILE, content: template }];
    host.activeFileName = DEFAULT_ENTRY_FILE;
    host.assets = [];
    host.unsaved = true;
  }

  loadProject(host: ProjectHost, snapshot: ProjectSnapshot, defaultSketch: string) {
    host.clearAutosave();
    host.projectPath = snapshot.projectPath;
    host.setProjectName(snapshot.projectName);
    host.files = snapshot.files.length ? snapshot.files : [{ name: DEFAULT_ENTRY_FILE, content: defaultSketch }];
    host.activeFileName = host.files.some((file) => file.name === snapshot.activeFileName)
      ? snapshot.activeFileName
      : (host.files[0]?.name ?? DEFAULT_ENTRY_FILE);
    host.assets = snapshot.assets;
    host.unsaved = false;
    host.appendConsole('info', `Opened project: ${snapshot.projectName}`);
  }

  async readProject(projectPath: string) {
    return this.browser.projects.read(projectPath);
  }

  async saveProject(
    host: ProjectHost,
    forceChoosePath: boolean,
    options: {
      silent?: boolean;
      onSaved?: (snapshot: ProjectSnapshot) => Promise<void> | void;
    } = {}
  ) {
    return this.withSaveLock(async () => {
      let targetPath = host.projectPath;
      if (!targetPath || forceChoosePath) {
        targetPath = null;
      }

      const snapshot = await this.browser.projects.save({
        projectName: host.projectName,
        projectPath: targetPath,
        activeFileName: host.activeFileName,
        files: host.files.map((file) => ({ ...file })),
        assets: host.assets.map((asset) => ({ ...asset })),
      });

      host.projectPath = snapshot.projectPath;
      host.assets = host.assets.map((asset) => ({
        ...asset,
        absolutePath: joinPath(snapshot.projectPath, 'assets', asset.name),
        relativePath: joinPath('assets', asset.name),
      }));

      if (!options.silent) {
        host.appendConsole('info', `Saved ${host.projectName} to ${snapshot.projectPath}`);
      }

      await options.onSaved?.(snapshot);
      return snapshot;
    });
  }

  private async withSaveLock<T>(task: () => Promise<T>) {
    const previous = this.saveQueue;
    let release!: () => void;
    this.saveQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await task();
    } finally {
      release();
    }
  }
}
