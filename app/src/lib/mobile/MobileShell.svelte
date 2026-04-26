<script lang="ts">
  import { tick } from 'svelte';
  import CanvasPanel from '$lib/components/CanvasPanel.svelte';
  import FileTabs from '$lib/components/FileTabs.svelte';
  import { formatDisplayValue } from '$lib/formatting/value-format';
  import { getExamplePreviewSrc } from '$lib/example-previews';
  import { appState } from '$lib/state/app-state.svelte';
  import { pretextFit } from '$lib/text/pretext-fit';
  import MobileCodeEditor from './MobileCodeEditor.svelte';

  type MobileTab = 'editor' | 'canvas' | 'examples' | 'settings';
  type MobileConsoleFilter = 'all' | 'stdout' | 'stderr' | 'info';

  let activeTab = $state<MobileTab>('editor');
  let mobileCode = $state(appState.activeEditorValue);

  let bottomTabs = $derived<{ id: MobileTab; label: string; icon: string }[]>([
    { id: 'editor', label: 'Editor', icon: 'code' },
    { id: 'canvas', label: appState.workspaceMode === 'practice' ? 'Output' : 'Canvas', icon: 'palette' },
    { id: 'examples', label: appState.workspaceMode === 'practice' ? 'Lessons' : 'Examples', icon: 'cube' },
    { id: 'settings', label: 'Settings', icon: 'sliders' },
  ]);

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
      appState.setCanvasPanelTab(appState.workspaceMode === 'practice' ? 'compiled' : 'canvas');
    }
  }

  $effect(() => {
    if (appState.workspaceMode !== 'studio' || !appState.running) return;
    if (activeTab !== 'canvas' && !appState.paused) {
      appState.pauseSketch();
    } else if (activeTab === 'canvas' && appState.paused) {
      appState.pauseSketch();
    }
  });

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

  async function chooseWorkspaceMode(mode: 'studio' | 'practice') {
    await appState.setWorkspaceMode(mode);
    if (mode === 'practice') {
      appState.setCanvasPanelTab('compiled');
      setActiveTab('editor');
    }
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
    <button class="mobile-action mobile-info-action" type="button" aria-label="About Qanvas5" onclick={() => (appState.activeModal = 'info')}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
        <path d="M12 11v5M12 8h.01" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
      </svg>
    </button>
  </header>

  <main class="mobile-main">
    {#if activeTab === 'editor'}
      <section class="mobile-editor">
        <div class="mobile-filebar">
          <FileTabs mobile />
        </div>
        <div class="mobile-code">
          <MobileCodeEditor value={mobileCode} onChange={updateCode} />
        </div>
        <div
          class="mobile-console"
          class:mobile-console--collapsed={appState.mobileConsoleCollapsed}
          aria-label="Console output"
        >
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
        <div class="mobile-canvas-stage">
          {#if appState.workspaceMode === 'practice'}
            <div class="mobile-practice-output" aria-label="Practice output">
              <div class="mobile-practice-output-header">
                <div>
                  <p class="mobile-practice-eyebrow">Output</p>
                  <h2>{appState.activePracticeChallenge.title}</h2>
                </div>
                <button class="mobile-practice-check" type="button" onclick={() => void appState.runSketch()}>
                  Check answer
                </button>
              </div>
              {#if appState.practiceVerification}
                <article class="mobile-practice-result mobile-practice-result--{appState.practiceVerification.status}">
                  <div class="mobile-practice-result-heading">
                    <strong>{appState.practiceVerification.status === 'match' ? 'Correct' : appState.practiceVerification.status === 'mismatch' ? 'Not yet' : 'Error'}</strong>
                    <span>{appState.practiceVerification.status}</span>
                  </div>
                  <p>{appState.practiceVerification.message}</p>
                  <div class="mobile-practice-compare">
                    <div>
                      <small>Your output</small>
                      <pre>{formatDisplayValue(appState.practiceVerification.actual)}</pre>
                    </div>
                    <div>
                      <small>{appState.activePracticeChallenge.answerLabel}</small>
                      <pre>{formatDisplayValue(appState.practiceVerification.expected)}</pre>
                    </div>
                  </div>
                </article>
              {:else}
                <div class="mobile-practice-empty">
                  <p>Edit your answer, then tap <strong>Check answer</strong>. The result appears here.</p>
                </div>
              {/if}
              {#if appState.practiceAnswerVisible}
                <article class="mobile-practice-result mobile-practice-answer">
                  <div class="mobile-practice-result-heading">
                    <strong>Working answer</strong>
                    <button type="button" onclick={() => appState.loadPracticeAnswer()}>Use</button>
                  </div>
                  <pre>{appState.activePracticeSolution}</pre>
                </article>
              {/if}
            </div>
          {:else}
            <CanvasPanel />
          {/if}
        </div>
        <div class="mobile-canvas-meta">
          <span>{appState.currentCanvasSize[0] || 800} x {appState.currentCanvasSize[1] || 600}</span>
          <span>t: 359</span>
        </div>
        <div class="mobile-tools-sheet" class:mobile-tools-sheet--collapsed={appState.mobileCanvasControlsCollapsed}>
          <div class="mobile-tools-sheet-header">
            <h2>{appState.workspaceMode === 'practice' ? 'Practice controls' : 'Canvas controls'}</h2>
            <button
              class="btn-icon-only mobile-tools-collapse-btn"
              type="button"
              aria-expanded={!appState.mobileCanvasControlsCollapsed}
              aria-label={appState.mobileCanvasControlsCollapsed ? 'Expand canvas controls' : 'Collapse canvas controls'}
              title={appState.mobileCanvasControlsCollapsed ? 'Expand canvas controls' : 'Collapse canvas controls'}
              onclick={() => appState.toggleMobileCanvasControlsCollapsed()}
            >
              <svg class="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                {#if appState.mobileCanvasControlsCollapsed}
                  <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                {:else}
                  <path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                {/if}
              </svg>
            </button>
          </div>
          {#if !appState.mobileCanvasControlsCollapsed}
          <div class="quick-tools-grid">
            {#if appState.workspaceMode === 'practice'}
              <button class="quick-tool quick-tool--primary" type="button" aria-label="Check answer" onclick={() => void appState.runSketch()}>
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span>Check</span>
              </button>
              <button class="quick-tool" type="button" aria-label="Back to editor" onclick={() => setActiveTab('editor')}>
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 8-4 4 4 4M15 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span>Edit</span>
              </button>
              <button class="quick-tool" type="button" aria-label="Show answer" onclick={() => appState.revealPracticeAnswer()}>
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c5 0 8 7 8 7s-3 7-8 7-8-7-8-7 3-7 8-7Z" fill="none" stroke="currentColor" stroke-width="2" /><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="2" /></svg>
                <span>Answer</span>
              </button>
              <button class="quick-tool" type="button" aria-label="Reset starter" onclick={() => appState.resetPracticeStarter()}>
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5v5h-5M17 10a6 6 0 1 0 1.5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span>Reset</span>
              </button>
            {:else}
              <button class="quick-tool quick-tool--primary" type="button" aria-label={appState.running ? 'Stop sketch' : 'Run sketch'} onclick={runOrStop}>
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true">
                  {#if appState.running}
                    <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor"></rect>
                  {:else}
                    <path d="M8 5v14l11-7z" fill="currentColor"></path>
                  {/if}
                </svg>
                <span>{appState.running ? 'Stop' : 'Run'}</span>
              </button>
              <button class="quick-tool" type="button" aria-label="Reset sketch" onclick={() => void resetSketch()}>
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5v5h-5M17 10a6 6 0 1 0 1.5 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                <span>Reset</span>
              </button>
              <button class="quick-tool" type="button" aria-label="Export PNG" onclick={() => appState.exportPng()}>
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h2l1.5-2h3L15 7h2a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="2" /><circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" stroke-width="2" /></svg>
                <span>PNG</span>
              </button>
              <button class="quick-tool" type="button" aria-label="Export GIF" onclick={() => appState.openGifModal()}>
                <svg class="quick-tool-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2" /><path d="M8 4v3M12 4v3M16 4v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
                <span>GIF</span>
              </button>
            {/if}
          </div>
          {/if}
        </div>
      </section>
    {:else if activeTab === 'examples'}
      <section class="mobile-examples">
        <div class="mobile-search-row">
          <h1>{appState.workspaceMode === 'practice' ? 'Lessons' : 'Examples'}</h1>
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
            {@const previewSrc = getExamplePreviewSrc(example.id)}
            <button
              class="mobile-example-card"
              type="button"
              style={`--example-accent: ${example.accent}`}
              onclick={() => {
                void appState.loadExample(example.id);
                setActiveTab('editor');
              }}
            >
              <span class="example-thumb">
                {#if previewSrc}
                  <img src={previewSrc} alt="" loading="lazy" decoding="async" />
                {/if}
              </span>
              <strong use:pretextFit={{ min: 10, max: 13 }}>{example.name}</strong>
              <small>by qanvas5</small>
            </button>
          {/each}
        </div>
      </section>
    {:else}
      <section class="mobile-settings">
        <h1>Settings</h1>

        <div class="mobile-settings-section">
          <h2>Workspace</h2>
          <div class="mobile-segmented" role="group" aria-label="Workspace mode">
            <button type="button" class:active={appState.workspaceMode === 'studio'} onclick={() => void chooseWorkspaceMode('studio')}>Studio</button>
            <button type="button" class:active={appState.workspaceMode === 'practice'} onclick={() => void chooseWorkspaceMode('practice')}>Practice</button>
          </div>
        </div>

        <div class="mobile-settings-section">
          <h2>Canvas & console</h2>
          <button class="mobile-setting-row" type="button" onclick={() => appState.toggleFps()}>
            <span>
              <strong>FPS overlay</strong>
              <small>Show frame rate on the sketch canvas.</small>
            </span>
            <span class:active={appState.showFps} class="mobile-toggle">{appState.showFps ? 'On' : 'Off'}</span>
          </button>
          <button class="mobile-setting-row" type="button" onclick={() => appState.toggleDebugConsole()}>
            <span>
              <strong>Debug console</strong>
              <small>Emit runtime debug output while queries run.</small>
            </span>
            <span class:active={appState.debugConsole} class="mobile-toggle">{appState.debugConsole ? 'On' : 'Off'}</span>
          </button>
          <button class="mobile-setting-row" type="button" onclick={() => appState.setCanvasPanelTab(appState.canvasPanelTab === 'canvas' ? 'compiled' : 'canvas')}>
            <span>
              <strong>Canvas output</strong>
              <small>Switch between rendered canvas and output.</small>
            </span>
            <span class="mobile-toggle active">{appState.canvasPanelTab === 'compiled' ? 'Output' : 'Canvas'}</span>
          </button>
        </div>
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
        <span use:pretextFit={{ min: 9, max: 11 }}>{tab.label}</span>
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

  .mobile-action {
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

  .mobile-action svg {
    width: 24px;
    height: 24px;
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
  .mobile-settings {
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .mobile-canvas {
    display: flex;
    flex-direction: column;
  }

  .mobile-examples,
  .mobile-empty-panel,
  .mobile-settings {
    height: 100%;
    min-height: 0;
  }

  .mobile-filebar {
    flex: 0 0 auto;
    display: block;
    border-bottom: 1px solid var(--mobile-border);
    background: var(--bg-sidebar);
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
    margin: 0;
    overflow: hidden;
    background: var(--mobile-panel);
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

  .mobile-practice-output {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    padding: 18px 14px;
    overflow: auto;
    background: var(--mobile-panel);
  }

  .mobile-practice-output-header,
  .mobile-practice-result-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mobile-practice-eyebrow {
    margin: 0 0 3px;
    color: var(--mobile-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .mobile-practice-output h2 {
    margin: 0;
    font-size: 18px;
    line-height: 1.2;
  }

  .mobile-practice-check {
    flex: 0 0 auto;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 9px;
    background: var(--mobile-hot);
    color: white;
    font-weight: 800;
  }

  .mobile-practice-empty,
  .mobile-practice-result {
    padding: 14px;
    border: 1px solid var(--mobile-border);
    border-radius: 12px;
    background: #fff;
  }

  .mobile-practice-answer pre {
    margin-top: 10px;
    white-space: pre-wrap;
    word-break: normal;
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.45;
  }

  .mobile-practice-result-heading button {
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid var(--mobile-border);
    border-radius: 7px;
    background: var(--bg-chrome);
    font-weight: 800;
  }

  .mobile-practice-empty p,
  .mobile-practice-result p {
    margin: 0;
    color: var(--mobile-muted);
    line-height: 1.45;
  }

  .mobile-practice-result--match {
    border-color: color-mix(in srgb, var(--green), white 55%);
  }

  .mobile-practice-result--mismatch {
    border-color: color-mix(in srgb, var(--yellow), white 55%);
  }

  .mobile-practice-result--error {
    border-color: color-mix(in srgb, var(--red), white 55%);
  }

  .mobile-practice-result-heading {
    margin-bottom: 10px;
  }

  .mobile-practice-result-heading span {
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--bg-chrome);
    color: var(--mobile-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .mobile-practice-compare {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  .mobile-practice-compare > div {
    min-width: 0;
    padding: 10px;
    border-radius: 8px;
    background: var(--bg-chrome);
  }

  .mobile-practice-compare small {
    display: block;
    margin-bottom: 6px;
    color: var(--mobile-muted);
    font-weight: 800;
  }

  .mobile-practice-compare pre {
    margin: 0;
    overflow-x: auto;
    color: var(--text-code);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.45;
    user-select: text;
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

  .mobile-search-row h1 {
    margin: 0 0 18px;
    font-size: 18px;
  }

  .quick-tools-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .mobile-tools-sheet {
    flex: 0 0 auto;
    padding: 14px;
    background: var(--mobile-panel);
    border-top: 1px solid var(--mobile-border);
  }

  .mobile-tools-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }

  .mobile-tools-sheet-header h2 {
    margin: 0;
  }

  .mobile-tools-sheet--collapsed {
    padding-bottom: 10px;
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

  .quick-tool--primary {
    border-color: color-mix(in srgb, var(--mobile-hot), white 28%);
    background: var(--mobile-hot);
    color: white;
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
    position: relative;
    aspect-ratio: 1;
    border-radius: 5px;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 50%, var(--example-accent), transparent 42%),
      repeating-conic-gradient(from 0deg, var(--example-accent) 0 8deg, transparent 8deg 18deg),
      #171613;
  }

  .example-thumb img {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
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

  .mobile-settings {
    display: grid;
    align-content: start;
    gap: 14px;
    padding: 18px 14px 24px;
    background: var(--mobile-panel);
  }

  .mobile-settings h1 {
    margin: 0 0 4px;
    font-size: 20px;
  }

  .mobile-settings-section {
    display: grid;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--mobile-border);
    border-radius: 12px;
    background: color-mix(in srgb, var(--bg-chrome), white 8%);
  }

  .mobile-settings-section h2 {
    margin: 0;
    font-size: 14px;
  }

  .mobile-segmented,
  .mobile-settings-actions {
    display: grid;
    gap: 8px;
  }

  .mobile-segmented {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mobile-segmented button,
  .mobile-settings-actions button {
    min-height: 44px;
    border: 1px solid var(--mobile-border);
    border-radius: 9px;
    background: var(--bg-editor);
    color: var(--mobile-ink);
  }

  .mobile-segmented button.active {
    border-color: var(--mobile-hot);
    background: var(--mobile-hot);
    color: white;
  }

  .mobile-setting-row small,
  .mobile-settings-current {
    color: var(--mobile-muted);
    font-size: 11px;
  }

  .mobile-settings-label {
    color: var(--mobile-muted);
    font-size: 12px;
    font-weight: 700;
  }

  .mobile-settings-input {
    width: 100%;
    min-height: 44px;
    padding: 0 12px;
    border: 1px solid var(--mobile-border);
    border-radius: 9px;
    background: var(--bg-editor);
    color: var(--mobile-ink);
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .mobile-settings-status {
    margin: 0;
    color: var(--mobile-muted);
    font-size: 12px;
  }

  .mobile-settings-status.ok {
    color: var(--green);
  }

  .mobile-settings-status.error {
    color: var(--red);
  }

  .mobile-settings-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mobile-settings-actions--grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mobile-settings-current {
    margin: 0;
  }

  .mobile-setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 64px;
    padding: 12px;
    border: 1px solid var(--mobile-border);
    border-radius: 9px;
    background: var(--bg-editor);
    color: var(--mobile-ink);
    text-align: left;
  }

  .mobile-setting-row span:first-child {
    display: grid;
    gap: 4px;
  }

  .mobile-toggle {
    flex: 0 0 auto;
    min-width: 54px;
    padding: 6px 9px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--mobile-muted), transparent 72%);
    color: var(--mobile-muted);
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    text-transform: capitalize;
  }

  .mobile-toggle.active {
    background: color-mix(in srgb, var(--green), white 80%);
    color: var(--green);
  }

  .mobile-bottom-nav {
    position: static;
    flex: 0 0 auto;
    z-index: 5;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
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

    .mobile-action {
      height: 44px;
      width: 44px;
    }

    .mobile-brand {
      font-size: 24px;
    }
  }
</style>
