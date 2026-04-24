<script lang="ts">
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

  function runOrStop() {
    if (appState.running && activeTab !== 'editor') {
      void appState.stopSketch();
      return;
    }

    void appState.runSketch();
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

    <div class="mobile-header-actions">
      <button class="mobile-action mobile-action--primary" type="button" aria-label="Run sketch" onclick={runOrStop}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {#if appState.running}
            <rect x="7" y="6" width="10" height="12" rx="2" fill="currentColor"></rect>
          {:else}
            <path d="M8 5v14l11-7z" fill="currentColor"></path>
          {/if}
        </svg>
      </button>
      <button class="mobile-action" type="button" aria-label="More actions">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v2M12 17v2M5 12h2M17 12h2M7.76 7.76l1.42 1.42M14.82 14.82l1.42 1.42M16.24 7.76l-1.42 1.42M9.18 14.82l-1.42 1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
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
          <button class="mobile-playbar-btn" type="button" aria-label="Reset sketch">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5v5h-5M17 10a6 6 0 1 0 1.5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <button class="mobile-playbar-btn" type="button" aria-label="Snapshot">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h2l1.5-2h3L15 7h2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="2" /><circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" stroke-width="2" /></svg>
          </button>
        </div>
        <div class="mobile-artboard" aria-label="Sketch preview">
          <div class="orbital orbital--a"></div>
          <div class="orbital orbital--b"></div>
          <div class="orbital orbital--c"></div>
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
                <span class={`quick-tool-icon quick-tool-icon--${tool.icon}`}></span>
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
                activeTab = 'editor';
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
      <button type="button" class:active={activeTab === tab.id} onclick={() => (activeTab = tab.id)}>
        <span class={`nav-icon nav-icon--${tab.icon}`}></span>
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
    min-height: 100dvh;
    background: var(--mobile-bg);
    color: var(--mobile-ink);
    font-family: var(--font-ui);
    overflow: hidden;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .mobile-header-actions,
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

  .mobile-action--primary,
  .mobile-playbar-btn--hot {
    border-color: color-mix(in srgb, var(--mobile-hot), white 28%);
    background: var(--mobile-hot);
    color: white;
  }

  .mobile-main {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding-bottom: 98px;
  }

  .mobile-editor,
  .mobile-canvas,
  .mobile-examples,
  .mobile-empty-panel {
    min-height: 100%;
  }

  .mobile-filebar {
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
    min-height: 54dvh;
    border: 0;
    border-radius: 0;
    margin: 0;
    padding: 18px 20px 120px;
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
    margin: -92px 0 0;
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
    margin: 0;
    color: var(--green);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.7;
  }

  .mobile-playbar {
    position: sticky;
    top: 0;
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

  .mobile-artboard {
    position: relative;
    aspect-ratio: 1;
    margin: 0;
    overflow: hidden;
    border-bottom: 1px solid var(--mobile-border);
    background:
      radial-gradient(circle at center, rgba(217, 79, 157, 0.95) 0 4%, transparent 4.5%),
      repeating-radial-gradient(circle at center, transparent 0 12px, rgba(76, 99, 214, 0.28) 13px 15px, transparent 16px 25px),
      var(--bg-canvas);
  }

  .orbital {
    position: absolute;
    inset: 12%;
    border: 12px dotted var(--accent);
    border-radius: 50%;
    mix-blend-mode: multiply;
  }

  .orbital--b {
    inset: 22%;
    border-color: var(--mobile-hot);
    transform: rotate(18deg);
  }

  .orbital--c {
    inset: 32%;
    border-color: var(--brand-5);
    transform: rotate(36deg);
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
    border-radius: 8px 8px 0 0;
  }

  .mobile-tools-sheet h2,
  .mobile-search-row h1,
  .mobile-empty-panel h1 {
    margin: 0 0 18px;
    font-size: 18px;
  }

  .quick-tools-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
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
    width: 28px;
    height: 28px;
    border: 2px solid currentColor;
    border-radius: 6px;
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
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
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
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
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
    min-height: 64px;
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
    border-radius: 5px;
  }

  @media (max-width: 390px) {
    .quick-tools-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mobile-example-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
