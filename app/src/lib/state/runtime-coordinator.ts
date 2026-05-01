import type { BrowserGateway } from '$lib/browser';
import { compileSketch } from '$lib/compiler/compiled-output';
import {
  beginRuntimeStart,
  beginRuntimeStop,
  completeQueuedRuntimeStep,
  completeRuntimeStart,
  completeRuntimeStop,
  exitRuntime,
  failRuntime,
  hasLiveRuntimeSession,
  isRuntimeActive,
  isRuntimePaused,
  isRuntimeTransitioning,
  pauseRuntime,
  queueRuntimeStep,
  recordRuntimeFrame,
  resumeRuntime,
  type RuntimeControlState,
  type RuntimeFrameKind,
} from '$lib/state/runtime-control-fsm';

type RuntimeHost = {
  runtimePath: string;
  runtimePathDraft: string;
  runtimeOk: boolean;
  runtimeDetectStatus: string;
  runtimeDetectTone: 'idle' | 'ok' | 'error';
  runtimeControl: RuntimeControlState;
  overlayMode: 'idle' | 'running' | 'stopped' | 'error' | 'runtime-missing';
  overlayMessage: string;
  showFps: boolean;
  debugConsole: boolean;
  fps: number;
  currentCanvasSize: [number, number];
  runtimeStartCommands: Record<string, unknown>[];
  runNonce: number;
  appendConsole: (type: ConsoleType, text: string) => void;
  flushPendingStructuredStdout: () => void;
};

export type RuntimeProjectSource = {
  projectPath: string | null;
  files: SketchFile[];
  activeFileName: string;
};

export class RuntimeCoordinator {
  private ignoreNextRuntimeExit = false;
  private runtimeActionQueue: Promise<void> = Promise.resolve();
  private expectedRuntimeStop = false;

  constructor(private readonly browser: BrowserGateway) {}

  toggleFps(host: RuntimeHost) {
    host.showFps = !host.showFps;
  }

  async detectRuntime(host: RuntimeHost) {
    host.runtimeDetectStatus = 'Detecting…';
    host.runtimeDetectTone = 'idle';

    const detected = await this.browser.runtime.detect();
    if (!detected) {
      host.runtimeDetectStatus = 'q not found on PATH.';
      host.runtimeDetectTone = 'error';
      return;
    }

    host.runtimePathDraft = detected;
    host.runtimeDetectStatus = `Found: ${detected}`;
    host.runtimeDetectTone = 'ok';
  }

  saveSettings(host: RuntimeHost) {
    host.runtimePath = host.runtimePathDraft.trim();
    this.validateRuntime(host);
  }

  validateRuntime(host: RuntimeHost) {
    host.runtimeOk = host.runtimePath.length > 0;
    if (!isRuntimeActive(host.runtimeControl)) {
      host.overlayMode = host.runtimeOk ? 'idle' : 'runtime-missing';
    }
  }

  async primeRuntimePath(host: RuntimeHost) {
    if (host.runtimePath) {
      this.validateRuntime(host);
      return false;
    }

    const detected = await this.browser.runtime.detect();
    if (!detected) {
      this.validateRuntime(host);
      return false;
    }

    host.runtimePath = detected;
    host.runtimePathDraft = detected;
    this.validateRuntime(host);
    host.appendConsole('info', `Detected q runtime at ${detected}`);
    return true;
  }

  async runProject(host: RuntimeHost, source: RuntimeProjectSource, message = `▶ Running ${source.activeFileName}`) {
    await this.withRuntimeLock(async () => {
      if (!host.runtimeOk) {
        await this.primeRuntimePath(host);
        if (!host.runtimeOk) return;
      }

      await this.startRuntimeFromProject(host, source, message);
    });
  }

  async stepProject(host: RuntimeHost, source: RuntimeProjectSource, options: { restart?: boolean } = {}) {
    await this.withRuntimeLock(async () => {
      if (!host.runtimeOk) {
        await this.primeRuntimePath(host);
        if (!host.runtimeOk) return;
      }

      if (!isRuntimeActive(host.runtimeControl) || options.restart) {
        const started = await this.startRuntimeFromProject(host, source, options.restart ? '↦ Setup step (updated sketch)' : '↦ Setup step', {
          paused: true,
        });
        if (started) {
          host.appendConsole('info', 'Setup completed. Press Step again for frame 0.');
        }
        return;
      }

      const nextFrame = host.runtimeControl.frameNumber;
      host.runtimeControl = queueRuntimeStep(host.runtimeControl);
      host.appendConsole('info', `↦ Frame ${nextFrame}`);
    });
  }

  pauseSketch(host: RuntimeHost) {
    if (!isRuntimeActive(host.runtimeControl)) return;

    const nextState = isRuntimePaused(host.runtimeControl)
      ? resumeRuntime(host.runtimeControl)
      : pauseRuntime(host.runtimeControl);
    const message = nextState.mode === 'paused' ? '⏸ Paused' : '▶ Resumed';
    host.runtimeControl = nextState;
    host.appendConsole('info', message);
  }

  async stopRuntime(host: RuntimeHost, quiet = false) {
    await this.withRuntimeLock(async () => {
      await this.stopRuntimeInternal(host, quiet);
    });
  }

  handleRuntimeError(host: RuntimeHost, message: string) {
    host.flushPendingStructuredStdout();
    if (this.expectedRuntimeStop && (message === 'Runtime stopped.' || message.startsWith('q exited with code'))) {
      return;
    }

    host.runtimeControl = failRuntime(host.runtimeControl);
    host.overlayMode = 'error';
    host.overlayMessage = message;
    host.appendConsole('stderr', message);
  }

  handleRuntimeExit(host: RuntimeHost, code: number) {
    host.flushPendingStructuredStdout();
    if (this.ignoreNextRuntimeExit) {
      this.ignoreNextRuntimeExit = false;
      return;
    }

    if (!hasLiveRuntimeSession(host.runtimeControl)) return;
    host.appendConsole('info', `q process exited (code ${code})`);
    host.runtimeControl = exitRuntime(host.runtimeControl);
    host.overlayMode = host.runtimeOk ? 'idle' : 'runtime-missing';
  }

  setCanvasSize(host: RuntimeHost, size: [number, number]) {
    host.currentCanvasSize = size;
  }

  setFps(host: RuntimeHost, value: number) {
    host.fps = value;
  }

  recordRenderedFrame(host: RuntimeHost, kind: RuntimeFrameKind) {
    host.runtimeControl = recordRuntimeFrame(host.runtimeControl, kind);
  }

  completeDebugStep(host: RuntimeHost) {
    host.runtimeControl = completeQueuedRuntimeStep(host.runtimeControl);
  }

  isRunning(host: RuntimeHost) {
    return isRuntimeActive(host.runtimeControl);
  }

  isPaused(host: RuntimeHost) {
    return isRuntimePaused(host.runtimeControl);
  }

  isTransitioning(host: RuntimeHost) {
    return isRuntimeTransitioning(host.runtimeControl);
  }

  private async startRuntimeFromProject(
    host: RuntimeHost,
    source: RuntimeProjectSource,
    message: string,
    options: { paused?: boolean } = {}
  ) {
    const runtimePath = host.runtimePath.trim();
    if (!runtimePath) {
      this.handleRuntimeError(host, 'q runtime path is missing. Configure the q binary in Settings.');
      return false;
    }

    if (!source.files.some((file) => file.name === 'sketch.q')) {
      this.handleRuntimeError(host, 'The project must include a sketch.q entry point.');
      return false;
    }

    await this.stopRuntimeInternal(host, true);
    host.runtimeControl = beginRuntimeStart(host.runtimeControl, options.paused ? 'step' : 'run');
    host.appendConsole('info', message);

    try {
      const compiled = selectCompiledSketch(source);
      const startResult = await this.browser.runtime.start({
        runtimePath,
        projectPath: source.projectPath,
        files: source.files.map((file) => ({ ...file })),
        debugConsole: host.debugConsole,
        backendMode: 'auto',
        compiled,
      });
      host.runtimeStartCommands = [];
      host.runtimeControl = completeRuntimeStart(host.runtimeControl);
      host.overlayMode = 'running';
      host.overlayMessage = '';
      host.runNonce += 1;
      if (startResult.backend === 'compiled-js') {
        host.appendConsole('info', 'Compiled JS backend active.');
      } else if (startResult.fallbackReason) {
        host.appendConsole('info', `Compiled JS unavailable. Falling back to interpreter: ${startResult.fallbackReason}`);
      }
      void this.loadStartCommands(host, host.runNonce);
      return true;
    } catch (error) {
      this.handleRuntimeError(host, error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private async loadStartCommands(host: RuntimeHost, runNonce: number) {
    try {
      const commands = await this.browser.runtime.startCommands();
      if (host.runNonce !== runNonce || !isRuntimeActive(host.runtimeControl)) return;
      host.runtimeStartCommands = commands.map((command) => ({ ...command }));
    } catch (error) {
      if (host.runNonce !== runNonce || !isRuntimeActive(host.runtimeControl)) return;
      this.handleRuntimeError(host, error instanceof Error ? error.message : String(error));
    }
  }

  private async stopRuntimeInternal(host: RuntimeHost, quiet = false) {
    host.flushPendingStructuredStdout();
    const wasRunning = this.isRunning(host);
    host.runtimeControl = beginRuntimeStop(host.runtimeControl);
    this.expectedRuntimeStop = wasRunning;

    if (wasRunning) {
      this.ignoreNextRuntimeExit = true;
      await this.browser.runtime.stop();
    }

    this.expectedRuntimeStop = false;
    host.runtimeControl = completeRuntimeStop(host.runtimeControl);
    host.runtimeStartCommands = [];
    host.runNonce += 1;

    if (!quiet) {
      host.overlayMode = 'stopped';
      host.appendConsole('info', '■ Stopped');
    } else if (host.runtimeOk) {
      host.overlayMode = 'idle';
    }
  }

  private async withRuntimeLock<T>(task: () => Promise<T>) {
    const previous = this.runtimeActionQueue;
    let release!: () => void;
    this.runtimeActionQueue = new Promise<void>((resolve) => {
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

function selectCompiledSketch(source: RuntimeProjectSource) {
  if (source.files.length !== 1) {
    return null;
  }

  const sketchFile = source.files.find((file) => file.name === 'sketch.q');
  if (!sketchFile) {
    return null;
  }

  return compileSketch(sketchFile.content);
}
