type Unsubscribe = () => void;
type BrowserEventHandler<T> = (value: T) => void;
type BrowserEventSubscription<T> = (callback: BrowserEventHandler<T>) => Unsubscribe;

export type MenuEventName = BrowserMenuEventName;

export type BrowserGateway = {
  files: {
    pickAssets: () => Promise<string[]>;
  };
  projects: {
    root: () => Promise<string>;
    list: () => Promise<ProjectLibraryEntry[]>;
    read: (projectPath: string) => Promise<ProjectSnapshot>;
    save: (payload: ProjectPayload) => Promise<ProjectSnapshot>;
  };
  runtime: {
    detect: () => Promise<string | null>;
    start: (payload: RuntimeStartPayload) => Promise<RuntimeStartResult>;
    startCommands: () => Promise<RuntimeStartCommandsResult>;
    frame: (payload: RuntimeFramePayload) => Promise<Record<string, unknown>[]>;
    query: (payload: RuntimeQueryPayload) => Promise<RuntimeQueryResult>;
    stop: () => Promise<void>;
    onStdout: BrowserEventSubscription<string>;
    onStderr: BrowserEventSubscription<string>;
    onExit: BrowserEventSubscription<number>;
  };
  menu: {
    on: (channel: MenuEventName, callback: () => void) => Unsubscribe;
    onNewSketch: (callback: () => void) => Unsubscribe;
    onOpenProject: (callback: () => void) => Unsubscribe;
    onSave: (callback: () => void) => Unsubscribe;
    onSaveAs: (callback: () => void) => Unsubscribe;
    onToggleComment: (callback: () => void) => Unsubscribe;
  };
};

function getRendererAPI(): BrowserRendererAPI {
  if (typeof window === 'undefined' || !window.browserAPI) {
    throw new Error('browserAPI is only available in the renderer process.');
  }

  return window.browserAPI;
}

export function createBrowserGateway(getAPI: () => BrowserRendererAPI = getRendererAPI): BrowserGateway {
  const fileApi = () => getAPI();
  const projectApi = () => getAPI();
  const runtimeApi = () => getAPI();
  const menuApi = () => getAPI();

  return {
    files: {
      pickAssets: () => fileApi().pickAssets(),
    },
    projects: {
      root: () => projectApi().getProjectsRoot(),
      list: () => projectApi().listProjects(),
      read: (projectPath: string) => projectApi().readProject(projectPath),
      save: (payload: ProjectPayload) => projectApi().saveProject(payload),
    },
    runtime: {
      detect: () => runtimeApi().detectRuntime(),
      start: (payload: RuntimeStartPayload) => runtimeApi().startRuntime(payload),
      startCommands: () => runtimeApi().startCommandsRuntime(),
      frame: (payload: RuntimeFramePayload) => runtimeApi().frameRuntime(payload),
      query: (payload: RuntimeQueryPayload) => runtimeApi().queryRuntime(payload),
      stop: () => runtimeApi().stopRuntime(),
      onStdout: (callback: BrowserEventHandler<string>) => runtimeApi().onRuntimeStdout(callback),
      onStderr: (callback: BrowserEventHandler<string>) => runtimeApi().onRuntimeStderr(callback),
      onExit: (callback: BrowserEventHandler<number>) => runtimeApi().onRuntimeExit(callback),
    },
    menu: {
      on: (channel: MenuEventName, callback: () => void) => menuApi().onMenuEvent(channel, callback),
      onNewSketch: (callback: () => void) => menuApi().onMenuEvent('menu:new-sketch', callback),
      onOpenProject: (callback: () => void) => menuApi().onMenuEvent('menu:open-project', callback),
      onSave: (callback: () => void) => menuApi().onMenuEvent('menu:save', callback),
      onSaveAs: (callback: () => void) => menuApi().onMenuEvent('menu:save-as', callback),
      onToggleComment: (callback: () => void) => menuApi().onMenuEvent('menu:toggle-comment', callback),
    },
  };
}

export const browserGateway = createBrowserGateway();
