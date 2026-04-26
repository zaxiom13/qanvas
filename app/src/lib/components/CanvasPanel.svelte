<script lang="ts">
  import { browserGateway } from '$lib/browser';
  import { onMount } from 'svelte';
  import { CanvasSurface } from '$lib/runtime/canvas-surface';
  import { encodeRgbaFramesToGif } from '$lib/runtime/gif-export';
  import { appState } from '$lib/state/app-state.svelte';
  import InlineCopy from '$lib/components/InlineCopy.svelte';
  import { highlightQSnippetHtml } from '$lib/mobile/q-highlight-html';

  type Props = {
    hideTourPanel?: boolean;
  };

  let { hideTourPanel = false }: Props = $props();

  type CompiledDiagnostic = {
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
    nodeKind?: string;
  };

  type CompiledOutputView = {
    status: 'compiled' | 'unsupported' | 'error' | string;
    backend?: 'interpreter' | 'compiled-js' | string;
    code?: string | null;
    diagnostics?: CompiledDiagnostic[];
    unsupported?: string[];
    metadata?: {
      runtimeVersion?: string;
      sourceHash?: string;
    };
    meta?: string;
    output?: string;
  };

  const surface = new CanvasSurface();
  const GIF_EXPORT_FPS = 60;
  let canvasElement = $state<HTMLCanvasElement | null>(null);

  let gifRecording = $state(false);
  let gifFrames: Uint8ClampedArray[] = [];
  let gifTargetFrameCount = 0;
  let gifFrameDelayMs = Math.round(1000 / GIF_EXPORT_FPS);
  let gifExportNonce = 0;

  let guidedTourTitle = $derived.by(() => {
    if (appState.tourFinished) return 'Restart guided tour';
    if (appState.nextTourExample) {
      return appState.lastExampleId
        ? `Next tutorial · ${appState.nextTourExample.name}`
        : `Start guided tour · ${appState.nextTourExample.name}`;
    }
    return 'Restart guided tour';
  });
  let containerElement = $state<HTMLDivElement | null>(null);
  let frameHandle = 0;
  let frameNumber = 0;
  let startTime = 0;
  let lastTime = 0;
  let activeRunNonce = -1;
  let inFlight = false;
  let compiledOutputTitle = $state('Unsupported feature');
  let compiledOutputSummary = $state('Fallback: interpreter');
  let compiledOutputBackend = $state('interpreter');
  let compiledOutputCode = $state('');
  let compiledOutputDiagnostics = $state<CompiledDiagnostic[]>([]);
  let compiledOutputUnsupported = $state<string[]>([]);
  let compiledOutputHasCode = $state(false);
  let canvasMenuOpen = $state(false);

  $effect(() => {
    const view = appState.activeCompiledOutput as unknown as CompiledOutputView;
    const generatedCode = typeof view.code === 'string' ? view.code.trim() : '';
    const hasCode = generatedCode.length > 0;
    const backendLabel = view.backend ?? 'interpreter';

    compiledOutputBackend = backendLabel;
    compiledOutputCode = generatedCode;
    compiledOutputDiagnostics = view.diagnostics ?? [];
    compiledOutputUnsupported = view.unsupported ?? [];
    compiledOutputHasCode = hasCode;
    compiledOutputTitle = hasCode ? 'Compiled JS' : view.status === 'error' ? 'Compile error' : 'Unsupported feature';
    compiledOutputSummary = hasCode
      ? `Backend: ${backendLabel}`
      : `Fallback: interpreter${backendLabel ? ` • Backend: ${backendLabel}` : ''}`;
  });

  const inputState = {
    mouse: null as [number, number] | null,
    mouseButtons: { left: false, middle: false, right: false },
    scroll: [0, 0] as [number, number],
    key: '',
    keys: new Set<string>(),
  };

  function setMouseToCanvasCenter() {
    if (!canvasElement) return;
    const rect = canvasElement.getBoundingClientRect();
    inputState.mouse = [rect.width * 0.5, rect.height * 0.5];
  }

  function updateMouse(event: PointerEvent) {
    if (!canvasElement) return;
    const rect = canvasElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      return;
    }
    inputState.mouse = [x, y];
  }

  function consumeInput() {
    const payload = {
      mouse: inputState.mouse,
      mouseButtons: { ...inputState.mouseButtons },
      scroll: [...inputState.scroll],
      key: inputState.key,
      keys: [...inputState.keys],
    };

    inputState.scroll = [0, 0];
    return payload;
  }

  function isExpectedFrameStop(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      !appState.running ||
      appState.runtimeTransitioning ||
      activeRunNonce !== appState.runNonce ||
      message === 'Runtime stopped.' ||
      message === 'q runtime is not running.' ||
      message.startsWith('q exited with code')
    );
  }

  function renderCommands(commands: Record<string, unknown>[]) {
    surface.draw(resolveImageSources(commands), {
      showFps: appState.showFps,
      fps: appState.fps,
    });
  }

  function resolveImageSources(commands: Record<string, unknown>[]) {
    return commands.map((command) => {
      if (command.kind !== 'image') return command;
      const data = command.data;
      if (!Array.isArray(data)) {
        if (!data || typeof data !== 'object' || !('src' in data)) return command;
        return {
          ...command,
          data: { ...(data as Record<string, unknown>), src: appState.resolveAssetSource(String((data as Record<string, unknown>).src ?? '')) },
        };
      }
      return {
        ...command,
        data: data.map((row) => {
          if (!row || typeof row !== 'object' || !('src' in row)) return row;
          return { ...(row as Record<string, unknown>), src: appState.resolveAssetSource(String((row as Record<string, unknown>).src ?? '')) };
        }),
      };
    });
  }

  function stopGifRecordingAndDiscard() {
    gifRecording = false;
    gifFrames = [];
    gifTargetFrameCount = 0;
  }

  function cancelGifExportRecording() {
    gifExportNonce += 1;
    stopGifRecordingAndDiscard();
  }

  function startGifExportRecording(durationSeconds: number) {
    stopGifRecordingAndDiscard();
    const frames = Math.max(1, Math.round(durationSeconds * GIF_EXPORT_FPS));
    gifTargetFrameCount = frames;
    gifRecording = true;
    gifExportNonce += 1;
    const nonce = gifExportNonce;
    appState.appendConsole('info', `Recording ${durationSeconds}s GIF at ${GIF_EXPORT_FPS} fps (${frames} frames)…`);

    window.setTimeout(() => {
      if (gifExportNonce !== nonce || !gifRecording) return;
      void finalizeGifExport(nonce);
    }, durationSeconds * 1000);
  }

  async function finalizeGifExport(expectedNonce: number) {
    if (gifExportNonce !== expectedNonce) return;

    const captured = gifFrames;
    const [width, height] = surface.getBackingStoreSize();

    stopGifRecordingAndDiscard();

    if (captured.length === 0) {
      appState.appendConsole('stderr', 'GIF export failed: no frames were captured.');
      return;
    }

    if (width < 1 || height < 1) {
      appState.appendConsole('stderr', 'GIF export failed: canvas has no backing store pixels.');
      return;
    }

    try {
      const bytes = encodeRgbaFramesToGif(captured, width, height, gifFrameDelayMs);
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'image/gif' });
      const url = URL.createObjectURL(blob);
      const base = appState.activeFileName.replace(/\.q$/, '') || 'sketch';
      const link = document.createElement('a');
      link.download = `${base}-animation.gif`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      appState.appendConsole('info', `GIF exported (${captured.length} frames).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      appState.appendConsole('stderr', `GIF export failed: ${message}`);
    }
  }

  async function renderFrame(now: number, allowPaused = false) {
    frameHandle = 0;
    if (!appState.running || (!allowPaused && appState.paused) || inFlight || activeRunNonce !== appState.runNonce) return;

    inFlight = true;

    try {
      if (!startTime) {
        startTime = now;
        lastTime = now;
      }

      const size = surface.getSize();
      appState.setCanvasSize(size as [number, number]);

      const commands = await browserGateway.runtime.frame({
        frameInfo: {
          frameNum: frameNumber,
          time: now - startTime,
          dt: frameNumber === 0 ? 16 : now - lastTime,
        },
        input: consumeInput(),
        canvas: {
          size,
          pixelRatio: window.devicePixelRatio || 1,
        },
        debugConsole: appState.debugConsole,
      });

      renderCommands([...appState.runtimeStartCommands, ...commands]);

      if (gifRecording && gifFrames.length < gifTargetFrameCount) {
        const snapshot = surface.captureRgbaSnapshot();
        if (snapshot) {
          gifFrames.push(snapshot);
        }
      }

      appState.setFps(surface.updateFps(now));
      frameNumber += 1;
      appState.recordRenderedFrame(allowPaused ? 'manual' : 'continuous');
      lastTime = now;
    } catch (error) {
      if (!isExpectedFrameStop(error)) {
        appState.handleRuntimeError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (allowPaused) {
        appState.completeDebugStep();
      }
      inFlight = false;
      if (appState.running && !appState.paused && activeRunNonce === appState.runNonce) {
        frameHandle = requestAnimationFrame(renderFrame);
      }
    }
  }

  $effect(() => {
    if (!appState.running) {
      cancelGifExportRecording();
    }
  });

  function scheduleFrameLoop(reset: boolean) {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;

    if (!appState.running || appState.paused) return;

    if (reset) {
      frameNumber = 0;
      startTime = 0;
      lastTime = 0;
      activeRunNonce = appState.runNonce;
    }

    frameHandle = requestAnimationFrame(renderFrame);
  }

  onMount(() => {
    if (!canvasElement) return;

    surface.attach(canvasElement);
    const resize = () => {
      surface.resize();
      const size = surface.getSize();
      appState.setCanvasSize(size as [number, number]);
      if (!inputState.mouse) {
        setMouseToCanvasCenter();
      }
    };
    const resizeObserver =
      typeof ResizeObserver === 'function' && containerElement
        ? new ResizeObserver(() => {
            resize();
          })
        : null;

    resize();
    resizeObserver?.observe(containerElement ?? canvasElement);
    window.addEventListener('resize', resize);

    appState.registerCanvasExports(
      () => surface.exportPng(`${appState.activeFileName.replace(/\.q$/, '') || 'sketch'}-frame.png`),
      (durationSeconds) => startGifExportRecording(durationSeconds)
    );

    const onTourShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== '[' && event.key !== ']') return;
      if (appState.activeModal) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
        if (target.closest('.monaco-editor')) return;
      }
      if (!appState.isOnTour && !appState.lastExampleId && event.key === ']') {
        event.preventDefault();
        void appState.loadNextTourExample();
        return;
      }
      if (event.key === ']' && appState.nextTourExample) {
        event.preventDefault();
        void appState.loadNextTourExample();
      } else if (event.key === '[' && appState.previousTourExample) {
        event.preventDefault();
        void appState.loadPreviousTourExample();
      }
    };
    window.addEventListener('keydown', onTourShortcut);
    const onDocumentPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest('.canvas-action-menu')) {
        canvasMenuOpen = false;
      }
    };
    window.addEventListener('pointerdown', onDocumentPointerDown);

    return () => {
      cancelGifExportRecording();
      appState.registerCanvasExports(null, null);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onTourShortcut);
      window.removeEventListener('pointerdown', onDocumentPointerDown);
      cancelAnimationFrame(frameHandle);
    };
  });

  $effect(() => {
    const nonce = appState.runNonce;
    if (nonce !== activeRunNonce && appState.running) {
      renderCommands(appState.runtimeStartCommands);
      if (appState.paused) {
        frameNumber = 0;
        startTime = 0;
        lastTime = 0;
        activeRunNonce = nonce;
        return;
      }

      scheduleFrameLoop(true);
    }
  });

  $effect(() => {
    const startCommands = appState.runtimeStartCommands;
    if (!appState.running || activeRunNonce !== appState.runNonce || !startCommands.length) {
      return;
    }

    renderCommands(startCommands);
  });

  $effect(() => {
    const running = appState.running;
    const paused = appState.paused;

    if (!running || paused) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
      return;
    }

    if (!frameHandle) {
      scheduleFrameLoop(false);
    }
  });

  $effect(() => {
    const pendingSteps = appState.debugPendingSteps;
    if (!appState.running || !appState.paused || pendingSteps < 1 || inFlight || activeRunNonce !== appState.runNonce) {
      return;
    }

    void renderFrame(performance.now(), true);
  });

  $effect(() => {
    if (appState.canvasPanelTab !== 'canvas' || !canvasElement) {
      return;
    }

    surface.resize();
    const size = surface.getSize();
    appState.setCanvasSize(size as [number, number]);
  });
</script>

<section id="canvas-panel">
  <div class="canvas-toolbar">
    <div class="canvas-panel-tabs" role="tablist" aria-label="Canvas panel view">
      <button
        id="canvas-tab-canvas"
        class="canvas-panel-tab"
        type="button"
        class:is-active={appState.canvasPanelTab === 'canvas'}
        onclick={() => appState.setCanvasPanelTab('canvas')}
      >
        {appState.workspaceMode === 'practice' ? 'Output' : 'Canvas'}
      </button>
      <button
        id="canvas-tab-compiled"
        class="canvas-panel-tab"
        type="button"
        class:is-active={appState.canvasPanelTab === 'compiled'}
        onclick={() => appState.setCanvasPanelTab('compiled')}
      >
        Compiled
      </button>
    </div>
    <div class="canvas-toolbar-actions">
      <div class="canvas-action-menu">
        <button id="btn-canvas-actions" class="btn-icon-only canvas-toolbar-btn" type="button" title="Canvas actions" aria-label="Canvas actions" aria-expanded={canvasMenuOpen} onclick={() => (canvasMenuOpen = !canvasMenuOpen)}>
          <svg class="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
        {#if canvasMenuOpen}
          <div class="canvas-action-dropdown" role="menu">
            <button type="button" role="menuitem" class:is-active={appState.showFps} onclick={() => { appState.toggleFps(); canvasMenuOpen = false; }}>
              <svg class="icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" /><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
              <span>Toggle FPS overlay</span>
            </button>
            <button type="button" role="menuitem" onclick={() => { void appState.startOrContinueGuidedTour(); canvasMenuOpen = false; }}>
              <svg class="icon" viewBox="0 0 16 16" fill="none"><path d="M5 3h8M5 8h8M5 13h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /><path d="M2.5 3.5h.01M2.5 8.5h.01M2.5 13.5h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
              <span>{guidedTourTitle}</span>
            </button>
            <button type="button" role="menuitem" onclick={() => { appState.exportPng(); canvasMenuOpen = false; }}>
              <svg class="icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none" /><path d="M2 9l3-3 3 3 2-2 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" /><circle cx="5.5" cy="5.5" r="1" fill="currentColor" /></svg>
              <span>Export PNG</span>
            </button>
            <button type="button" role="menuitem" onclick={() => { appState.openGifModal(); canvasMenuOpen = false; }}>
              <svg class="icon" viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none" /><path d="M5 8h2v1H5V7h3M9 7h2M10 7v2M4 4V3M8 4V3M12 4V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
              <span>Export GIF</span>
            </button>
          </div>
        {/if}
      </div>
      <div class="canvas-size-label" id="canvas-size-label">{appState.currentCanvasSize[0]} × {appState.currentCanvasSize[1]}</div>
    </div>
  </div>

  <div
    id="canvas-container"
    bind:this={containerElement}
    class:is-hidden={appState.canvasPanelTab !== 'canvas'}
  >
    <canvas
      bind:this={canvasElement}
      class="svelte-canvas"
      aria-label="Sketch canvas"
      tabindex="0"
      onpointermove={updateMouse}
      onpointerdown={(event) => {
        updateMouse(event);
        if (event.button === 0) inputState.mouseButtons.left = true;
        if (event.button === 1) inputState.mouseButtons.middle = true;
        if (event.button === 2) inputState.mouseButtons.right = true;
      }}
      onpointerup={(event) => {
        updateMouse(event);
        if (event.button === 0) inputState.mouseButtons.left = false;
        if (event.button === 1) inputState.mouseButtons.middle = false;
        if (event.button === 2) inputState.mouseButtons.right = false;
      }}
      onpointerleave={() => {
        inputState.mouseButtons = { left: false, middle: false, right: false };
      }}
      onwheel={(event) => {
        inputState.scroll = [event.deltaX, event.deltaY];
      }}
      onkeydown={(event) => {
        inputState.key = event.key;
        inputState.keys.add(event.key);
      }}
      onkeyup={(event) => {
        inputState.keys.delete(event.key);
        inputState.key = '';
      }}
    ></canvas>

    <div id="sketch-overlay" class="sketch-overlay" class:sketch-overlay--idle={appState.overlayMode === 'idle' || appState.overlayMode === 'runtime-missing'} class:sketch-overlay--empty-idle={appState.overlayMode === 'idle'} class:sketch-overlay--running={appState.overlayMode === 'running'} class:sketch-overlay--stopped={appState.overlayMode === 'stopped'} class:sketch-overlay--error={appState.overlayMode === 'error'}>
      <div class="overlay-content">
        {#if appState.overlayMode === 'runtime-missing'}
          <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--red)" stroke-width="2"></circle>
            <path d="M24 14v12M24 32v2" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"></path>
          </svg>
          <p class="overlay-label">q runtime not configured</p>
          <div class="overlay-actions">
            <button class="btn-primary overlay-primary-action" type="button" onclick={() => (appState.activeModal = 'settings')}>Configure</button>
            <button class="overlay-link" type="button" onclick={() => (appState.activeModal = 'examples')}>Browse examples</button>
          </div>
        {:else if appState.overlayMode === 'error'}
          <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--red)" stroke-width="2"></circle>
            <path d="M24 14v12M24 32v2" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"></path>
          </svg>
          <p class="overlay-label">Sketch error</p>
          {#if appState.overlayMessage}
            <div class="overlay-error-msg">{appState.overlayMessage}</div>
          {/if}
        {:else if appState.overlayMode === 'stopped'}
          <svg class="overlay-icon" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--text-secondary)" stroke-width="2"></circle>
            <rect x="16" y="16" width="16" height="16" rx="2" fill="var(--text-secondary)"></rect>
          </svg>
          <p class="overlay-label">Sketch stopped</p>
        {/if}
      </div>
    </div>

    {#if appState.isOnTour && appState.overlayMode !== 'runtime-missing'}
      {@const tourEx = appState.currentTourExample}
      {@const lesson = tourEx?.lesson}
      <div class="tour-canvas-chrome" aria-label="Guided tour controls">
        <div class="tour-strip" class:tour-strip--running={appState.overlayMode === 'running'} style={`--example-accent:${tourEx?.accent ?? '#5B6FE8'}`}>
          <button
            class="tour-strip-btn"
            type="button"
            onclick={() => void appState.loadPreviousTourExample()}
            disabled={!appState.previousTourExample}
            title="Previous tutorial ( [ )"
            aria-label="Previous tutorial"
          >‹</button>
          <div class="tour-strip-label" title={`Tutorial ${appState.currentTourStep} of ${appState.tourLength}`}>
            <span class="tour-strip-step">Tutorial {appState.currentTourStep}/{appState.tourLength}</span>
            <span class="tour-strip-name">{tourEx?.name ?? ''}</span>
          </div>
          <button
            class="tour-strip-btn"
            type="button"
            onclick={() => void appState.loadNextTourExample()}
            disabled={!appState.nextTourExample}
            title="Next tutorial ( ] )"
            aria-label="Next tutorial"
          >›</button>
        </div>

        {#if tourEx && lesson && !hideTourPanel}
          <aside
            class="tour-lesson-panel"
            class:tour-lesson-panel--collapsed={!appState.tourLessonExpanded}
            style={`--example-accent:${tourEx.accent}`}
          >
            <div class="tour-lesson-panel-bar">
              <div class="tour-lesson-panel-bar-text">
                <span class="tour-lesson-panel-eyebrow">Tutorial {appState.currentTourStep} of {appState.tourLength}</span>
                <span class="tour-lesson-panel-title">{tourEx.name}</span>
              </div>
              <button
                type="button"
                class="tour-lesson-panel-toggle"
                aria-expanded={appState.tourLessonExpanded}
                onclick={() => appState.toggleTourLessonPanel()}
              >
                {appState.tourLessonExpanded ? 'Hide guide' : 'Show guide'}
              </button>
            </div>
            {#if appState.tourLessonExpanded}
              <div class="tour-lesson-panel-body">
                <p class="tour-lesson-panel-teaches"><InlineCopy text={lesson.teaches} /></p>
                <p class="tour-lesson-panel-intro"><InlineCopy text={lesson.intro} /></p>
                {#if lesson.highlight}
                  <figure class="tour-lesson-panel-highlight">
                    <figcaption><InlineCopy text={lesson.highlight.caption} /></figcaption>
                    <pre><code class="tour-lesson-highlight-code">{@html highlightQSnippetHtml(lesson.highlight.code)}</code></pre>
                  </figure>
                {/if}
                <p class="tour-lesson-panel-shortcuts"><kbd>[</kbd> previous tutorial · <kbd>]</kbd> next tutorial</p>
              </div>
            {/if}
          </aside>
        {/if}
      </div>
    {/if}
  </div>

  <div
    id="compiled-output-panel"
    class="compiled-output-panel"
    class:is-hidden={appState.canvasPanelTab !== 'compiled'}
  >
    <div class="compiled-output-header">
      <div>
        <div class="compiled-output-eyebrow">Compiled</div>
        <div class="compiled-output-meta" id="compiled-output-meta">{compiledOutputTitle} • {compiledOutputSummary}</div>
      </div>
      <div id="compiled-output-badges" class="compiled-output-badges" aria-label="Compilation status">
        <span class={`compiled-output-badge compiled-output-badge--${compiledOutputHasCode ? 'success' : compiledOutputTitle === 'Compile error' ? 'error' : 'warning'}`}>
          {compiledOutputTitle}
        </span>
        <span class="compiled-output-badge compiled-output-badge--muted">Backend: {compiledOutputBackend}</span>
        {#if !compiledOutputHasCode}
          <span class="compiled-output-badge compiled-output-badge--warning">Fallback: interpreter</span>
        {/if}
      </div>
    </div>
    {#if compiledOutputHasCode}
      <pre id="compiled-output-pre" class="compiled-output-code">{compiledOutputCode}</pre>
    {:else}
      <div id="compiled-output-diagnostics" class="compiled-output-diagnostics">
        <p class="compiled-output-empty-title">{compiledOutputTitle}</p>
        <p class="compiled-output-empty-copy">
          No generated JavaScript is available for this sketch. The runtime will fall back to the interpreter.
        </p>

        {#if compiledOutputUnsupported.length}
          <div class="compiled-output-group">
            <div class="compiled-output-group-title">Unsupported features</div>
            <ul class="compiled-output-list">
              {#each compiledOutputUnsupported as item}
                <li class="compiled-output-item">{item}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if compiledOutputDiagnostics.length}
          <div class="compiled-output-group">
            <div class="compiled-output-group-title">Diagnostics</div>
            <ul class="compiled-output-list">
              {#each compiledOutputDiagnostics as diagnostic}
                <li class={`compiled-output-item compiled-output-item--${diagnostic.severity}`}>
                  <span class="compiled-output-item-severity">{diagnostic.severity}</span>
                  <span class="compiled-output-item-message">{diagnostic.message}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</section>
