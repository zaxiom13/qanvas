<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';

  let projectNameInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!appState.renamingProject || !projectNameInput) return;
    projectNameInput.focus();
    projectNameInput.select();
  });
</script>

<header id="toolbar">
  <div class="toolbar-left">
    <div class="app-brand">
      <span class="brand-q">Q</span><span class="brand-anvas">anvas</span><span class="brand-5">5</span>
    </div>
    <button id="btn-info" class="btn-icon-only" type="button" title="About Qanvas5" aria-label="About Qanvas5" onclick={() => (appState.activeModal = 'info')}>
      <svg class="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" />
        <path d="M8 7.2v4.2M8 4.8h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      </svg>
    </button>
    {#if appState.workspaceMode === 'studio'}
      <div class="toolbar-divider"></div>
      <div class="project-info">
        {#if appState.renamingProject}
          <input
            bind:this={projectNameInput}
            id="project-name-input"
            class="project-name-input"
            spellcheck="false"
            bind:value={appState.projectNameDraft}
            onblur={() => appState.finishProjectRename(true)}
            onkeydown={(event) => {
              if (event.key === 'Enter') appState.finishProjectRename(true);
              if (event.key === 'Escape') appState.finishProjectRename(false);
            }}
          />
        {:else}
          <button id="project-name" class="project-name-display" type="button" title="Rename project" onclick={() => appState.startProjectRename()}>
            {appState.projectName}
          </button>
          <button class="project-rename-btn" id="btn-project-rename" type="button" title="Rename project" onclick={() => appState.startProjectRename()}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M3 13h10M8 3l-4 4v2h2l4-4-2-2z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>
          </button>
        {/if}
        <span id="unsaved-dot" class="unsaved-dot" hidden={!appState.unsaved}></span>
      </div>
      <div class="toolbar-divider"></div>
      <button id="btn-projects" class="btn-icon-only" type="button" title="Project library" onclick={() => appState.openProjectsModal()}>
        <svg class="icon" viewBox="0 0 16 16" fill="none">
          <path d="M2.5 4.5h4l1.4 1.5h5.6v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" />
          <path d="M2.5 6h11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </button>
    {/if}
  </div>

  <div class="toolbar-center">
    <div class="workspace-switch" role="tablist" aria-label="Workspace mode">
      <button
        class="workspace-switch-btn"
        type="button"
        class:is-active={appState.workspaceMode === 'studio'}
        onclick={() => appState.setWorkspaceMode('studio')}
      >
        Studio
      </button>
      <button
        class="workspace-switch-btn"
        type="button"
        class:is-active={appState.workspaceMode === 'practice'}
        onclick={() => appState.setWorkspaceMode('practice')}
      >
        Practice
      </button>
    </div>
  </div>

  <div class="toolbar-right">
    <button id="btn-examples" class="btn-icon-only" type="button" title={appState.workspaceMode === 'practice' ? 'Browse lessons (Cmd+E)' : 'Browse examples (Cmd+E)'} aria-label={appState.workspaceMode === 'practice' ? 'Browse lessons' : 'Browse examples'} onclick={() => (appState.activeModal = 'examples')}>
      <svg class="icon" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="2" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
        <rect x="9" y="2" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
        <rect x="1" y="9" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
        <rect x="9" y="9" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
      </svg>
    </button>
    {#if appState.workspaceMode === 'studio'}
      <button
        id="btn-debug-console"
        class="btn-icon-only"
        type="button"
        class:is-active={appState.debugConsole}
        title="Toggle debug console"
        onclick={() => appState.toggleDebugConsole()}
      >
        <svg class="icon" viewBox="0 0 16 16" fill="none">
          <rect x="2.5" y="3.5" width="11" height="7" rx="1" stroke="currentColor" stroke-width="1.3" fill="none" />
          <path d="M5 12.5h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <path d="M5.2 6.1l1.8 1.4-1.8 1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M8.8 8.9h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
      </button>
      <div class="toolbar-divider"></div>
    {/if}
    <button id="btn-settings" class="btn-icon-only" type="button" title="Settings" onclick={() => (appState.activeModal = 'settings')}>
      <svg class="icon" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l-1.41 1.41M4.46 11.54l-1.41 1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</header>
