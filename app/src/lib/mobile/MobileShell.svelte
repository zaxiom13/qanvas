<script lang="ts">
  import { tick } from 'svelte';
  import CanvasPanel from '$lib/components/CanvasPanel.svelte';
  import { appState } from '$lib/state/app-state.svelte';

  type MobileTab = 'editor' | 'canvas' | 'examples' | 'files' | 'settings';
  type MobileConsoleFilter = 'all' | 'stdout' | 'stderr' | 'info';

  let activeTab = $state<MobileTab>('editor');
  let mobileCode = $state(appState.activeEditorValue);

  const bottomTabs: { id: MobileTab; label: string; icon: string }[] = [
    { id: 'editor', label: 'Editor', icon: 'code' },
    { id: 'canvas', label: 'Canvas', icon: 'palette' },
    { id: 'examples', label: 'Examples', icon: 'cube' },
    { id: 'files', label: 'Files', icon: 'file' },
    { id: 'settings', label: 'Settings', icon: 'sliders' },
  ];

  let examples = $derived(appState.filteredExamples.slice(0, 9));
  let filteredConsoleEntries = $derived(appState.filteredConsole);

  function formatTimestamp(ts: number) {
    const date = new Date(ts);
    const pad = (value: number, width = 2) => String(value).padStart(width, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  }

  function setMobileConsoleFilter(filter: MobileConsoleFilter) {
    appState.consoleFilter = filter;
  }

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

  function renameMobileFile(name: string) {
    const next = window.prompt('Rename file', name);
    if (next) appState.renameFile(name, next);
  }

  function deleteMobileFile(name: string) {
    if (window.confirm(`Delete "${name}"?`)) {
      appState.deleteFile(name);
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
        <div
          class="mobile-console"
          class:mobile-console--collapsed={appState.mobileConsoleCollapsed}
          aria-label="Console output"
        >
          {#if !appState.mobileConsoleCollapsed}
            <div class="sheet-handle"></div>
          {/if}
          <div class="mobile-console-toolbar">
            <span class="mobile-console-title">Console</span>
            <div class="mobile-console-filters" role="tablist" aria-label="Console filter">
              <button
                type="button"
                class="mobile-console-filter-btn"
                class:mobile-console-filter-btn--active={appState.consoleFilter === 'all'}
                onclick={() => setMobileConsoleFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                class="mobile-console-filter-btn"
                class:mobile-console-filter-btn--active={appState.consoleFilter === 'stdout'}
                onclick={() => setMobileConsoleFilter('stdout')}
              >
                Data
              </button>
              <button
                type="button"
                class="mobile-console-filter-btn"
                class:mobile-console-filter-btn--active={appState.consoleFilter === 'stderr'}
                onclick={() => setMobileConsoleFilter('stderr')}
              >
                Errors
              </button>
              <button
                type="button"
                class="mobile-console-filter-btn"
                class:mobile-console-filter-btn--active={appState.consoleFilter === 'info'}
                onclick={() => setMobileConsoleFilter('info')}
              >
                Info
              </button>
            </div>
            <button
              class="btn-icon-only mobile-console-collapse-btn"
              type="button"
              aria-expanded={!appState.mobileConsoleCollapsed}
              title={appState.mobileConsoleCollapsed ? 'Expand console' : 'Collapse console'}
              aria-label={appState.mobileConsoleCollapsed ? 'Expand console' : 'Collapse console'}
              onclick={() => appState.toggleMobileConsoleCollapsed()}
            >
              <svg class="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                {#if appState.mobileConsoleCollapsed}
                  <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                {:else}
                  <path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                {/if}
              </svg>
            </button>
            <button
              class="btn-icon-only mobile-console-clear-btn"
              type="button"
              title="Clear console"
              aria-label="Clear console"
              onclick={() => appState.clearConsole(false)}
            >
              <svg class="icon" viewBox="0 0 16 16" fill="none">
                <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M4 4l1 9h6l1-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
              </svg>
            </button>
          </div>
          {#if !appState.mobileConsoleCollapsed}
            <div class="mobile-console-output">
              {#each filteredConsoleEntries as entry (entry.id)}
                <div class={`console-line console-line--${entry.type}`}>
                  <span class="console-prefix">{entry.type === 'stdout' ? '›' : entry.type === 'stderr' ? '✕' : '—'}</span>
                  {#if appState.debugConsole}
                    <span class="console-timestamp">{formatTimestamp(entry.ts)}</span>
                  {/if}
                  <span class="console-text">{entry.text}</span>
                  <button
                    type="button"
                    class="console-line-delete"
                    title="Delete line"
                    aria-label="Delete line"
                    onclick={() => appState.removeConsoleEntry(entry.id)}
                  >
                    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden="true">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                    </svg>
                  </button>
                </div>
              {:else}
                <p class="mobile-console-empty">No lines for this filter. Run a sketch or switch tabs.</p>
              {/each}
            </div>
          {/if}
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
    {:else if activeTab === 'files'}
      <section class="mobile-files-panel" aria-labelledby="mobile-files-heading">
        <div class="mobile-files-panel-header">
          <h1 id="mobile-files-heading">Files</h1>
          <div class="mobile-files-panel-actions">
            <button class="mobile-action" type="button" aria-label="New file" title="New file" onclick={() => appState.openNewFileModal()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
            <button class="mobile-action" type="button" aria-label="Import asset" title="Import asset" onclick={() => void appState.importAssets()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v10M8 10l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M5 18h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <p class="mobile-files-panel-hint">Tap a file to open it in the editor. Runtime output stays in the console (Data filter).</p>
        <div class="mobile-file-list" role="list">
          {#each appState.files as file (file.name)}
            <div class="mobile-file-row" class:mobile-file-row--active={file.name === appState.activeFileName} role="listitem">
              <button
                class="mobile-file-row-main"
                type="button"
                onclick={() => {
                  appState.selectFile(file.name);
                  setActiveTab('editor');
                }}
              >
                <svg class="mobile-file-row-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1" fill="none" />
                  <path d="M10 2v3h3" stroke="currentColor" stroke-width="1" fill="none" />
                </svg>
                <span class="mobile-file-row-name">{file.name}</span>
                {#if file.name === appState.activeFileName && appState.unsaved}
                  <span class="unsaved-dot" aria-hidden="true"></span>
                {/if}
              </button>
              {#if file.name !== 'sketch.q'}
                <div class="mobile-file-row-actions">
                  <button class="mobile-file-action-btn" type="button" title="Rename" aria-label="Rename {file.name}" onclick={() => renameMobileFile(file.name)}>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 13h10M8 3l-4 4v2h2l4-4-2-2zM10 5l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
                    </svg>
                  </button>
                  <button class="mobile-file-action-btn" type="button" title="Delete" aria-label="Delete {file.name}" onclick={() => deleteMobileFile(file.name)}>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" />
                      <path d="M4 4l1 9h6l1-9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" />
                    </svg>
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>
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
          {:else if tab.icon === 'file'}
            <path d="M6 3h6l3 3v12H6zM12 3v3h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
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
  .mobile-empty-panel,
  .mobile-files-panel {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .mobile-canvas {
    display: flex;
    flex-direction: column;
  }

  .mobile-examples,
  .mobile-empty-panel,
  .mobile-files-panel {
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

  .mobile-console {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    max-height: min(42dvh, 360px);
    min-height: 140px;
    margin: 0;
    padding: 8px 12px 12px;
    border-top: 1px solid var(--mobile-border);
    background: var(--bg-console);
    box-shadow: 0 -12px 26px rgba(70, 50, 34, 0.12);
  }

  .mobile-console--collapsed {
    max-height: none;
    min-height: 0;
    padding-top: 6px;
    padding-bottom: 8px;
  }

  .sheet-handle {
    width: 48px;
    height: 5px;
    margin: 0 auto 8px;
    border-radius: 999px;
    background: rgba(120, 104, 84, 0.32);
    flex-shrink: 0;
  }

  .mobile-console-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    min-height: 40px;
    padding: 0 4px 6px;
    background: var(--bg-chrome);
    border-radius: 6px;
    border: 1px solid var(--mobile-border);
  }

  .mobile-console-title {
    flex-shrink: 0;
    padding: 0 4px 0 6px;
    font-size: 12px;
    font-weight: 700;
    color: var(--mobile-ink);
  }

  .mobile-console-filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .mobile-console-filter-btn {
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 6px 10px;
    color: var(--mobile-muted);
    font-size: 11px;
    font-family: var(--font-mono);
    background: transparent;
  }

  .mobile-console-filter-btn--active {
    border-color: var(--mobile-border);
    background: #fff;
    color: var(--mobile-ink);
  }

  .mobile-console-collapse-btn {
    flex-shrink: 0;
  }

  .mobile-console-clear-btn {
    flex-shrink: 0;
    margin-left: auto;
  }

  .mobile-console-output {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    margin-top: 6px;
    padding: 2px 0;
    border-radius: 4px;
    background: color-mix(in srgb, var(--mobile-panel-2), transparent 8%);
  }

  .mobile-console-output :global(.console-line) {
    padding-left: 8px;
    padding-right: 8px;
  }

  .mobile-console-empty {
    margin: 12px 10px;
    color: var(--mobile-muted);
    font-size: 12px;
    line-height: 1.45;
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
    flex: 1 1 auto;
    min-height: 200px;
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

  .mobile-search-row h1,
  .mobile-empty-panel h1 {
    margin: 0 0 18px;
    font-size: 18px;
  }

  .nav-icon {
    width: 26px;
    height: 26px;
  }

  .mobile-files-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px 14px 24px;
    background: var(--mobile-panel);
  }

  .mobile-files-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-files-panel-header h1 {
    margin: 0;
    font-size: 18px;
  }

  .mobile-files-panel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mobile-files-panel-hint {
    margin: 0;
    max-width: 52ch;
    color: var(--mobile-muted);
    font-size: 13px;
    line-height: 1.45;
  }

  .mobile-file-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1 1 auto;
    min-height: 0;
    margin-top: 4px;
  }

  .mobile-file-row {
    display: flex;
    align-items: stretch;
    gap: 0;
    border: 1px solid var(--mobile-border);
    border-radius: 8px;
    background: var(--bg-chrome);
    overflow: hidden;
  }

  .mobile-file-row--active {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent), transparent 55%);
  }

  .mobile-file-row-main {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 12px 14px;
    text-align: left;
    color: var(--mobile-ink);
    font-weight: 600;
    font-size: 14px;
  }

  .mobile-file-row-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    color: var(--mobile-muted);
  }

  .mobile-file-row-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-file-row-actions {
    display: flex;
    align-items: center;
    border-left: 1px solid var(--mobile-border);
    background: color-mix(in srgb, var(--bg-editor), transparent 40%);
  }

  .mobile-file-action-btn {
    display: inline-grid;
    place-items: center;
    width: 48px;
    min-height: 100%;
    padding: 0;
    color: var(--mobile-muted);
  }

  .mobile-file-action-btn:active {
    color: var(--mobile-ink);
    background: var(--surface-hover, rgba(127, 127, 127, 0.12));
  }

  .mobile-file-action-btn svg {
    width: 18px;
    height: 18px;
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
