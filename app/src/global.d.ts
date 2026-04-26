declare global {
  type ConsoleType = 'info' | 'stdout' | 'stderr';

  type ConsoleEntry = {
    id: number;
    type: ConsoleType;
    text: string;
    ts: number;
  };

  type SketchFile = {
    name: string;
    content: string;
  };

  type AssetEntry = {
    name: string;
    sourcePath?: string | null;
    absolutePath?: string | null;
    relativePath?: string | null;
    dataUrl?: string | null;
  };

  type ProjectPayload = {
    projectName: string;
    projectPath?: string | null;
    activeFileName: string;
    files: SketchFile[];
    assets: AssetEntry[];
  };

  type ProjectSnapshot = {
    projectName: string;
    projectPath: string;
    activeFileName: string;
    files: SketchFile[];
    assets: AssetEntry[];
  };

  type ProjectLibraryEntry = {
    projectName: string;
    projectPath: string;
    updatedAt: number;
    fileCount: number;
    assetCount: number;
  };

  type RuntimeBackendMode = 'interpreter' | 'compiled-js' | 'auto';

  type RuntimeBackend = 'interpreter' | 'compiled-js';

  type CompileDiagnostic = {
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
    nodeKind?: string;
  };

  type CompiledSketchResult = {
    status: 'compiled' | 'unsupported' | 'error';
    backend: RuntimeBackend;
    code: string | null;
    diagnostics: CompileDiagnostic[];
    unsupported: string[];
    metadata?: {
      runtimeVersion?: string;
      sourceHash?: string;
    };
  };

  type RuntimeStartPayload = {
    runtimePath: string;
    files: SketchFile[];
    projectPath?: string | null;
    debugConsole?: boolean;
    backendMode?: RuntimeBackendMode;
    compiled?: CompiledSketchResult | null;
  };

  type RuntimeFramePayload = {
    frameInfo: Record<string, unknown>;
    input: Record<string, unknown>;
    canvas: Record<string, unknown>;
    debugConsole?: boolean;
  };

  type RuntimeStartResult = {
    config: Record<string, unknown>;
    backend: RuntimeBackend;
    fallbackReason?: string | null;
  };

  type RuntimeStartCommandsResult = Record<string, unknown>[];

  type RuntimeQueryPayload = {
    runtimePath: string;
    files: SketchFile[];
    expression: string;
    debugConsole?: boolean;
  };

  type RuntimeQueryResult = {
    ok: boolean;
    value?: unknown;
    error?: string;
  };

  type BrowserMenuEventName =
    | 'menu:new-sketch'
    | 'menu:open-project'
    | 'menu:save'
    | 'menu:save-as'
    | 'menu:toggle-comment';

  type BrowserRendererAPI = {
    pickAssets: () => Promise<AssetEntry[]>;
    getProjectsRoot: () => Promise<string>;
    listProjects: () => Promise<ProjectLibraryEntry[]>;
    readProject: (projectPath: string) => Promise<ProjectSnapshot>;
    saveProject: (payload: ProjectPayload) => Promise<ProjectSnapshot>;
    detectRuntime: () => Promise<string | null>;
    startRuntime: (payload: RuntimeStartPayload) => Promise<RuntimeStartResult>;
    startCommandsRuntime: () => Promise<RuntimeStartCommandsResult>;
    frameRuntime: (payload: RuntimeFramePayload) => Promise<Record<string, unknown>[]>;
    queryRuntime: (payload: RuntimeQueryPayload) => Promise<RuntimeQueryResult>;
    stopRuntime: () => Promise<void>;
    onMenuEvent: (channel: BrowserMenuEventName, callback: () => void) => () => void;
    onRuntimeStdout: (callback: (value: string) => void) => () => void;
    onRuntimeStderr: (callback: (value: string) => void) => () => void;
    onRuntimeExit: (callback: (code: number) => void) => () => void;
  };

  interface Window {
    browserAPI: BrowserRendererAPI;
  }
}

export {};
