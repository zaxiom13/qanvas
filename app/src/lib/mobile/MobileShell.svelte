<script lang="ts">
  import { tick } from 'svelte';
  import CanvasPanel from '$lib/components/CanvasPanel.svelte';
  import { appState } from '$lib/state/app-state.svelte';

  type MobileTab = 'editor' | 'canvas' | 'examples' | 'data' | 'settings';

  let activeTab = $state<MobileTab>('editor');
  let mobileCode = $state(appState.activeEditorValue);

  const quickTools = [
    { label: 'Clear', icon: 'clear' },
    { label: 'Background', icon: 'dropper' },
    { label: 'Stroke', icon: 'waves' },
    { label: 'Fill', icon: 'fill' },
    { label: 'Shape', icon: 'shape' },
    { label: 'Grid', icon: 'grid' },
    { label: 'Mirror', icon: 'mirror' },
    { label: 'Export', icon: 'export' },
  ];

  const bottomTabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'editor', label: 'Editor', icon: 'code' },
    { id: 'canvas', label: 'Canvas', icon: 'palette' },
    { id: 'examples', label: 'Examples', icon: 'cube' },
    { id: 'data', label: 'Data', icon: 'table' },
    { id: 'settings', label: 'Settings', icon: 'sliders' },
  ];

  let examples = $derived(appState.filteredExamples.slice(0, 9));
  let consoleEntries = $derived(appState.filteredConsole.slice(-7));

  $effect(() => {
    mobileCode = appState.activeEditorValue;
  });

  function updateCode(value: string) {
    mobileCode = value;
    appState.updateActiveEditorContent(value);
  }

  function setActiveTab(tab: MobileTab) {
    activeTab = tab;
    if (tab === 'canvas') {
      appState.setCanvasPanelTab('canvas');
    }
  }

  async function runOrStop() {
    if (appState.running) {
      await appState.stopSketch();
      return;
    }

    setActiveTab('canvas');
    await tick();
    await appState.runSketch();
  }

  async function resetSketch() {
    await appState.stopSketch(true);
    setActiveTab('canvas');
    await tick();
    await appState.runSketch();
  }
</script>

<div class="mobile-shell">
  <header class="mobile-header">
    <div>
      <div class="mobile-brand">
        <span class="brand-q">q</span><span>anvas</span><span class="brand-5">5</span>
      </div>
      <p>kdb+/q creative coding</p>
    </div>
  </header>

  <main class="mobile-main">
    {#if activeTab === 'editor'}
      <section class="mobile-editor">
        <div class="mobile-filebar">
          <button class="mobile-filetab" type="button">
            <span>{appState.activeFileName}</span>
            <span class="unsaved-dot" hidden={!appState.unsaved}></span>
          </button>
          <div class="mobile-canvas-status">
            <span class="status-dot"></span>
            <span>{Math.round(appState.fps || 60)} FPS</span>
          </div>
        </div>
        <textarea
          class="mobile-code"
          spellcheck="false"
          autocapitalize="off"
          autocomplete="off"
          value={mobileCode}
          oninput={(event) => updateCode(event.currentTarget.value)}
          aria-label="q sketch editor"
        ></textarea>
        <div class="mobile-console">
          <div class="sheet-handle"></div>
          <div class="mobile-console-tabs">
            <strong>Console</strong>
            <span>Data</span>
            <span>Errors</span>
          </div>
          <pre>{#if consoleEntries.length}{#each consoleEntries as entry}{entry.type === 'stderr' ? 'err' : entry.type === 'info' ? 'info' : 'q'}&#41; {entry.text}
{/each}{:else}q) qanvas5
Qanvas5 ready.
q){/if}</pre>
        </div>
      </section>
    {:else if activeTab === 'canvas'}
      <section class="mobile-canvas">
        <div class="mobile-playbar">
          <button class="mobile-playbar-btn mobile-playbar-btn--hot" type="button" aria-label="Run sketch" onclick={runOrStop}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"></path></svg>
          </button>
          <button class="mobile-playbar-btn" type="button" aria-label="Stop sketch" onclick={() => void appState.stopSketch()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="8" height="8" rx="1.5" fill="currentColor"></rect></svg>
          </button>
          <button class="mobile-playbar-btn" type="button" aria-label="Reset sketch" onclick={() => void resetSketch()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5v5h-5M17 10a6 6 0 1 0 1.5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <button class="mobile-playbar-btn" type="button" aria-label="Snapshot" onclick={() => appState.exportPng()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h2l1.5-2h3L15 7h2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="2" /><circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" stroke-width="2" /></svg>
          </button>
        </div>
        <div class="mobile-canvas-stage">
          <CanvasPanel />
        </div>
        <div class="mobile-canvas-meta">
          <span><span class="status-dot"></span>{Math.round(appState.fps || 60)} FPS</span>
          <span>{appState.currentCanvasSize[0] || 800} x {appState.currentCanvasSize[1] || 600}</span>
          <span>t: 359</span>
        </div>
        <div class="mobile-tools-sheet">
          <div class="sheet-handle"></div>
          <h2>Quick Tools</h2>
          <div class="quick-tools-grid">
            {#each quickTools as tool}
              <button class="quick-tool" type="button">
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
                  {#if tool.icon === 'clear'}
                    <path d="M5 12a7 7 0 0 1 12.2-4.7M19 12a7 7 0 0 1-12.2 4.7M17 5v4h-4M7 19v-4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  {:else if tool.icon === 'dropper'}
                    <path d="m14 5 5 5M11 8l5 5-7 7H4v-5zM13 6l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  {:else if tool.icon === 'waves'}
                    <path d="M4 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M4 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                  {:else if tool.icon === 'fill'}
                    <path d="m5 14 7-7 6 6-7 7H5zM14 4l6 6M19 17c0 1.5-1 3-2.5 3S14 18.5 14 17c0-1 .9-2.4 2.5-4 1.6 1.6 2.5 3 2.5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                  {:else if tool.icon === 'shape'}
                    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2" />
                  {:else if tool.icon === 'grid'}
                    <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                  {:else if tool.icon === 'mirror'}
                    <path d="M5 4h5v16H5zM14 4h5v16h-5zM12 3v18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                  {:else}
                    <path d="M12 4v11M8 8l4-4 4 4M5 14v5h14v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                  {/if}
                </svg>
                <span>{tool.label}</span>
              </button>
            {/each}
          </div>
        </div>
      </section>
    {:else if activeTab === 'examples'}
      <section class="mobile-examples">
        <div class="mobile-search-row">
          <h1>Examples</h1>
          <button class="mobile-action" type="button" aria-label="Search examples">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" /><path d="M16.5 16.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          </button>
        </div>
        <div class="mobile-category-row">
          {#each appState.exampleCategories as category}
            <button class:active={appState.exampleCategory === category} type="button" onclick={() => (appState.exampleCategory = category)}>{category}</button>
          {/each}
        </div>
        <div class="mobile-example-grid">
          {#each examples as example}
            <button
              class="mobile-example-card"
              type="button"
              style={`--example-accent: ${example.accent}`}
              onclick={() => {
                void appState.loadExample(example.id);
                setActiveTab('editor');
              }}
            >
              <span class="example-thumb"></span>
              <strong>{example.name}</strong>
              <small>by qanvas5</small>
            </button>
          {/each}
        </div>
      </section>
    {:else if activeTab === 'data'}
      <section class="mobile-empty-panel">
        <h1>Data</h1>
        {#if consoleEntries.length}
          <div class="mobile-data-list">
            {#each consoleEntries as entry}
              <article>
                <strong>{entry.type}</strong>
                <p>{entry.text}</p>
              </article>
            {/each}
          </div>
        {:else}
          <p>Run a sketch to inspect tables, arrays, runtime output, and errors here.</p>
        {/if}
      </section>
    {:else}
      <section class="mobile-empty-panel">
        <h1>Settings</h1>
        <p>Runtime, canvas, exports, sync, and display preferences can live behind large native-feeling rows.</p>
      </section>
    {/if}
  </main>

  <nav class="mobile-bottom-nav" aria-label="Mobile workspace">
    {#each bottomTabs as tab}
      <button type="button" class:active={activeTab === tab.id} onclick={() => setActiveTab(tab.id)}>
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
          {#if tab.icon === 'code'}
            <path d="m9 8-4 4 4 4M15 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          {:else if tab.icon === 'palette'}
            <path d="M12 4a8 8 0 0 0 0 16h1.2a1.9 1.9 0 0 0 1.2-3.4 1.4 1.4 0 0 1 .9-2.5H17a3 3 0 0 0 3-3C20 7.2 16.5 4 12 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
            <path d="M8.5 10h.01M11 7.8h.01M14 8.3h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          {:else if tab.icon === 'cube'}
            <path d="m12 3 7 4v10l-7 4-7-4V7zM12 11l7-4M12 11v10M12 11 5 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          {:else if tab.icon === 'table'}
            <path d="M4 5h16v14H4zM4 10h16M9 5v14M15 5v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          {:else}
            <path d="M5 7h14M5 17h14M8 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM16 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          {/if}
        </svg>
        <span>{tab.label}</span>
      </button>
    {/each}
  </nav>
</div>

<style>
  .mobile-shell {
    --mobile-bg: var(--bg-app);
    --mobile-panel: var(--bg-editor);
    --mobile-panel-2: var(--bg-console);
    --mobile-border: var(--border);
    --mobile-ink: var(--text-primary);
    --mobile-muted: var(--text-secondary);
    --mobile-hot: #d94f9d;
    display: flex;
    flex-direction: column;
    height: 100dvh;
    min-height: 0;
    background: var(--mobile-bg);
    color: var(--mobile-ink);
    font-family: var(--font-ui);
    overflow: hidden;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 16px;
    padding: calc(env(safe-area-inset-top) + 14px) 18px 12px;
    background: var(--bg-toolbar);
    border-bottom: 1px solid var(--mobile-border);
  }

  .mobile-brand {
    font-size: 26px;
    font-weight: 800;
    line-height: 1;
  }

  .brand-q {
    color: var(--brand-q);
  }

  .brand-5 {
    color: var(--brand-5);
  }

  .mobile-header p {
    margin-top: 4px;
    color: var(--mobile-muted);
    font-size: 12px;
  }

  .mobile-playbar {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .mobile-action,
  .mobile-playbar-btn {
    display: inline-grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 1px solid var(--mobile-border);
    border-radius: 8px;
    background: var(--bg-chrome);
    color: var(--mobile-ink);
    box-shadow: var(--shadow-sm);
  }

  .mobile-action svg,
  .mobile-playbar-btn svg {
    width: 24px;
    height: 24px;
  }

  .mobile-playbar-btn--hot {
    border-color: color-mix(in srgb, var(--mobile-hot), white 28%);
    background: var(--mobile-hot);
    color: white;
  }

  .mobile-main {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    padding-bottom: 0;
  }

  .mobile-editor,
  .mobile-canvas {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .mobile-editor {
    display: flex;
    flex-direction: column;
  }

  .mobile-canvas,
  .mobile-examples,
  .mobile-empty-panel {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .mobile-examples,
  .mobile-empty-panel {
    height: 100%;
    min-height: 0;
  }

  .mobile-filebar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--mobile-border);
    background: var(--bg-sidebar);
  }

  .mobile-filetab {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border-right: 1px solid var(--mobile-border);
    color: var(--accent);
    font-weight: 700;
  }

  .mobile-canvas-status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 18px;
    color: var(--mobile-muted);
    font-size: 12px;
  }

  .status-dot,
  .unsaved-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--green);
  }

  .unsaved-dot {
    background: var(--mobile-hot);
  }

  .mobile-code {
    display: block;
    width: 100%;
    flex: 1 1 auto;
    min-height: 0;
    border: 0;
    border-radius: 0;
    margin: 0;
    padding: 18px 20px;
    overflow: auto;
    background:
      linear-gradient(90deg, rgba(76, 99, 214, 0.06) 1px, transparent 1px) 0 0 / 56px 56px,
      var(--mobile-panel);
    color: var(--text-code);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.65;
    user-select: text;
    white-space: pre-wrap;
    resize: none;
    outline: none;
  }

  .mobile-console,
  .mobile-tools-sheet {
    margin: 0;
    padding: 10px 18px 20px;
    border-top: 1px solid var(--mobile-border);
    background: color-mix(in srgb, var(--mobile-panel-2), white 12%);
    box-shadow: 0 -12px 26px rgba(70, 50, 34, 0.12);
  }

  .sheet-handle {
    width: 48px;
    height: 5px;
    margin: 0 auto 12px;
    border-radius: 999px;
    background: rgba(120, 104, 84, 0.32);
  }

  .mobile-console-tabs {
    display: flex;
    gap: 28px;
    margin-bottom: 12px;
    color: var(--mobile-muted);
  }

  .mobile-console-tabs strong {
    color: var(--mobile-ink);
  }

  .mobile-console pre {
    max-height: 118px;
    overflow: auto;
    margin: 0;
    color: var(--green);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.7;
  }

  .mobile-playbar {
    position: static;
    z-index: 2;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 10px;
    background: var(--bg-toolbar);
    border-bottom: 1px solid var(--mobile-border);
  }

  .mobile-playbar-btn {
    width: 100%;
  }

  .mobile-canvas-stage {
    height: clamp(280px, 48dvh, 460px);
    min-height: 0;
    border-bottom: 1px solid var(--mobile-border);
    background: var(--bg-canvas);
  }

  .mobile-canvas-stage :global(#canvas-panel) {
    height: 100%;
    min-height: 0;
  }

  .mobile-canvas-stage :global(.canvas-toolbar) {
    display: none;
  }

  .mobile-canvas-stage :global(#canvas-container) {
    min-height: 0;
  }

  .mobile-canvas-stage :global(.overlay-content) {
    width: min(280px, calc(100% - 32px));
    padding: 14px 16px;
  }

  .mobile-canvas-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 18px;
    color: var(--mobile-muted);
    font-size: 12px;
    background: var(--mobile-panel);
    border-bottom: 1px solid var(--mobile-border);
  }

  .mobile-canvas-meta span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  .mobile-tools-sheet {
    margin-top: 0;
    border-radius: 0;
  }

  .mobile-tools-sheet h2,
  .mobile-search-row h1,
  .mobile-empty-panel h1 {
    margin: 0 0 18px;
    font-size: 18px;
  }

  .quick-tools-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .quick-tool {
    display: grid;
    place-items: center;
    gap: 8px;
    min-height: 84px;
    border: 1px solid var(--mobile-border);
    border-radius: 8px;
    background: var(--bg-editor);
    color: var(--mobile-ink);
    font-size: 12px;
  }

  .quick-tool-icon,
  .nav-icon {
    width: 26px;
    height: 26px;
  }

  .mobile-examples {
    padding: 18px 14px 24px;
  }

  .mobile-search-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .mobile-category-row {
    display: flex;
    gap: 8px;
    padding-bottom: 14px;
    overflow-x: auto;
  }

  .mobile-category-row button {
    flex: 0 0 auto;
    min-height: 42px;
    padding: 0 14px;
    border: 1px solid var(--mobile-border);
    border-radius: 8px;
    background: var(--bg-chrome);
    color: var(--mobile-muted);
  }

  .mobile-category-row button.active {
    border-color: var(--mobile-hot);
    background: var(--mobile-hot);
    color: white;
  }

  .mobile-example-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .mobile-example-card {
    display: grid;
    gap: 6px;
    padding: 6px;
    border: 1px solid var(--mobile-border);
    border-radius: 8px;
    background: var(--mobile-panel);
    text-align: left;
  }

  .example-thumb {
    aspect-ratio: 1;
    border-radius: 5px;
    background:
      radial-gradient(circle at 50% 50%, var(--example-accent), transparent 42%),
      repeating-conic-gradient(from 0deg, var(--example-accent) 0 8deg, transparent 8deg 18deg),
      #171613;
  }

  .mobile-example-card strong {
    font-size: 12px;
    line-height: 1.2;
  }

  .mobile-example-card small {
    color: var(--mobile-muted);
    font-size: 10px;
  }

  .mobile-empty-panel {
    display: grid;
    align-content: center;
    padding: 28px;
    background: var(--mobile-panel);
  }

  .mobile-empty-panel p {
    max-width: 34ch;
    color: var(--mobile-muted);
    font-size: 15px;
    line-height: 1.5;
  }

  .mobile-data-list {
    display: grid;
    gap: 10px;
  }

  .mobile-data-list article {
    padding: 12px;
    border: 1px solid var(--mobile-border);
    border-radius: 8px;
    background: var(--bg-chrome);
  }

  .mobile-data-list strong {
    display: block;
    margin-bottom: 6px;
    color: var(--accent);
    text-transform: uppercase;
    font-size: 11px;
  }

  .mobile-data-list p {
    max-width: none;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    white-space: pre-wrap;
  }

  .mobile-bottom-nav {
    position: static;
    flex: 0 0 auto;
    z-index: 5;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    padding: 10px 10px calc(env(safe-area-inset-bottom) + 10px);
    border-top: 1px solid var(--mobile-border);
    background: color-mix(in srgb, var(--bg-toolbar), white 8%);
    box-shadow: 0 -10px 24px rgba(70, 50, 34, 0.13);
  }

  .mobile-bottom-nav button {
    display: grid;
    place-items: center;
    gap: 5px;
    min-width: 0;
    min-height: 62px;
    border-radius: 8px;
    color: var(--mobile-muted);
    font-size: 11px;
  }

  .mobile-bottom-nav button.active {
    background: color-mix(in srgb, var(--accent), white 82%);
    color: var(--accent-active);
  }

  .nav-icon {
    width: 24px;
    height: 24px;
  }

  @media (max-width: 390px) {
    .mobile-header {
      padding-right: 12px;
      padding-left: 14px;
    }

    .mobile-action,
    .mobile-playbar-btn {
      height: 44px;
      width: 44px;
    }

    .mobile-brand {
      font-size: 24px;
    }
  }
</style>
