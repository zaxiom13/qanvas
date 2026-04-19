<script lang="ts">
  import { onMount } from 'svelte';
  import { appState } from '$lib/state/app-state.svelte';

  let projectNameInput = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (!appState.renamingProject || !projectNameInput) return;
    projectNameInput.focus();
    projectNameInput.select();
  });

  onMount(() => {
    const stop = () => appState.stopStepHold();
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    window.addEventListener('blur', stop);

    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('blur', stop);
    };
  });
</script>

<header id="toolbar">
  <div class="toolbar-left">
    <div class="app-brand">
      <span class="brand-q">Q</span><span class="brand-anvas">anvas</span><span class="brand-5">5</span>
    </div>
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
    <button id="btn-new-sketch" class="btn-icon-only" type="button" title="New sketch (Cmd+N)" onclick={() => void appState.createNewSketch()}>
      <svg class="icon" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1.5" fill="none" />
        <path d="M10 2v3h3" stroke="currentColor" stroke-width="1.5" fill="none" />
        <path d="M7 8v4M5 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
    <button id="btn-projects" class="btn-icon-only" type="button" title="Project library" onclick={() => appState.openProjectsModal()}>
      <svg class="icon" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 4.5h4l1.4 1.5h5.6v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linejoin="round" />
        <path d="M2.5 6h11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      </svg>
    </button>
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

    <button
      id="btn-run"
      class="btn-toolbar btn-run"
      type="button"
      class:running={appState.workspaceMode === 'studio' && appState.running && !appState.paused}
      title={appState.workspaceMode === 'practice' ? 'Run verification' : 'Run sketch'}
      onclick={() => (appState.workspaceMode === 'studio' && appState.running ? void appState.stopSketch() : void appState.runSketch())}
    >
      <svg class="icon btn-run-icon" viewBox="0 0 16 16" fill="none">
        {#if appState.workspaceMode === 'studio' && appState.running && !appState.paused}
          <rect x="4" y="2" width="8" height="12" fill="currentColor"></rect>
        {:else}
          <polygon points="4,2 14,8 4,14" fill="currentColor"></polygon>
        {/if}
      </svg>
      <span class="btn-run-label">{appState.workspaceMode === 'studio' && appState.running && !appState.paused ? 'Stop' : 'Run'}</span>
    </button>

    {#if appState.workspaceMode === 'studio'}
      <button
        id="btn-step"
        class="btn-toolbar btn-step"
        type="button"
        title="Step through setup and frames"
        onclick={() => void appState.stepSketch()}
        onpointerdown={() => appState.startStepHold()}
        onpointerup={() => appState.stopStepHold()}
        onpointerleave={() => appState.stopStepHold()}
      >
        <svg class="icon" viewBox="0 0 16 16" fill="none">
          <path d="M3 2v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          <path d="M6 3l7 5-7 5V3z" fill="currentColor" />
        </svg>
        <span>Step</span>
      </button>

      <button
        id="btn-pause"
        class="btn-toolbar btn-pause"
        type="button"
        class:paused={appState.paused}
        title="Pause sketch"
        disabled={!appState.running}
        onclick={() => appState.pauseSketch()}
      >
        <svg class="icon" viewBox="0 0 16 16" fill="none">
          {#if appState.paused}
            <polygon points="4,2 14,8 4,14" fill="currentColor"></polygon>
          {:else}
            <rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" />
            <rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor" />
          {/if}
        </svg>
        <span class="btn-pause-label">{appState.paused ? 'Resume' : 'Pause'}</span>
      </button>
    {/if}
  </div>

  <div class="toolbar-right">
    <button id="btn-examples" class="btn-icon-only" type="button" title="Browse examples (Cmd+E)" onclick={() => (appState.activeModal = 'examples')}>
      <svg class="icon" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="2" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
        <rect x="9" y="2" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
        <rect x="1" y="9" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
        <rect x="9" y="9" width="6" height="5" rx="1" stroke="currentColor" stroke-width="1.5" fill="none" />
      </svg>
    </button>
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
    <button id="btn-settings" class="btn-icon-only" type="button" title="Settings" onclick={() => (appState.activeModal = 'settings')}>
      <svg class="icon" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l-1.41 1.41M4.46 11.54l-1.41 1.41" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</header>
