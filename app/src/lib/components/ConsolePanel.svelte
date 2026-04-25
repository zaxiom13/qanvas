<script lang="ts">
  import { onDestroy } from 'svelte';
  import { appState } from '$lib/state/app-state.svelte';

  let dragCleanup = () => {};

  function formatTimestamp(ts: number) {
    const date = new Date(ts);
    const pad = (value: number, width = 2) => String(value).padStart(width, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
  }

  function startResize(event: PointerEvent) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = appState.consoleHeight;

    const handleMove = (moveEvent: PointerEvent) => {
      const nextHeight = startHeight - (moveEvent.clientY - startY);
      appState.setConsoleHeight(nextHeight);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.classList.remove('is-resizing-console');
      dragCleanup = () => {};
    };

    document.body.classList.add('is-resizing-console');
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    dragCleanup = handleUp;
  }

  onDestroy(() => {
    dragCleanup();
  });
</script>

<footer
  id="console-panel"
  class:console-panel--collapsed={appState.consoleCollapsed}
  style={appState.consoleCollapsed
    ? 'height:auto;min-height:calc(var(--tab-h) + 1px);'
    : `height: ${appState.consoleHeight}px; min-height: ${appState.consoleHeight}px;`}
>
  {#if !appState.consoleCollapsed}
    <button
      id="console-resize-handle"
      class="console-resize-handle"
      type="button"
      aria-label="Resize console"
      title="Drag to resize console"
      onpointerdown={startResize}
    >
      <span></span>
    </button>
  {/if}
  <div class="console-toolbar">
    <span class="console-title">Console</span>
    <div class="console-filters">
      <button class="console-filter-btn" type="button" class:console-filter-btn--active={appState.consoleFilter === 'all'} data-filter="all" onclick={() => (appState.consoleFilter = 'all')}>All</button>
      <button class="console-filter-btn" type="button" class:console-filter-btn--active={appState.consoleFilter === 'stdout'} data-filter="stdout" onclick={() => (appState.consoleFilter = 'stdout')}>stdout</button>
      <button class="console-filter-btn" type="button" class:console-filter-btn--active={appState.consoleFilter === 'stderr'} data-filter="stderr" onclick={() => (appState.consoleFilter = 'stderr')}>stderr</button>
      <button class="console-filter-btn" type="button" class:console-filter-btn--active={appState.consoleFilter === 'info'} data-filter="info" onclick={() => (appState.consoleFilter = 'info')}>info</button>
    </div>
    <button
      id="btn-console-collapse"
      class="btn-icon-only console-collapse-btn"
      type="button"
      aria-expanded={!appState.consoleCollapsed}
      aria-controls="console-output"
      title={appState.consoleCollapsed ? 'Expand console' : 'Collapse console'}
      aria-label={appState.consoleCollapsed ? 'Expand console' : 'Collapse console'}
      onclick={() => appState.toggleConsoleCollapsed()}
    >
      <svg class="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {#if appState.consoleCollapsed}
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        {:else}
          <path d="M4 10l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        {/if}
      </svg>
    </button>
    <button id="btn-clear-console" class="btn-icon-only console-clear-btn" type="button" title="Clear console" onclick={() => appState.clearConsole(false)}>
      <svg class="icon" viewBox="0 0 16 16" fill="none">
        <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M4 4l1 9h6l1-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    </button>
  </div>
  {#if !appState.consoleCollapsed}
    <div id="console-output" class="console-output">
      {#each appState.filteredConsole as entry (entry.id)}
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
      {/each}
    </div>
  {/if}
</footer>
