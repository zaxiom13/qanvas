<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';

  type Props = {
    mobile?: boolean;
    onSelect?: () => void;
  };

  let { mobile = false, onSelect }: Props = $props();

  function renameFile(name: string) {
    const next = window.prompt('Rename file', name);
    if (next) {
      appState.renameFile(name, next);
    }
  }

  function deleteFile(name: string) {
    if (window.confirm(`Delete "${name}"?`)) {
      appState.deleteFile(name);
    }
  }

  function selectFile(name: string) {
    appState.selectFile(name);
    onSelect?.();
  }
</script>

<div class="file-tabs" class:file-tabs--mobile={mobile} aria-label="Project files">
  <div class="file-tabs-scroll" role="tablist" aria-label="Open files">
    {#each appState.files as file (file.name)}
      <div class="file-tab-wrap" class:file-tab-wrap--active={file.name === appState.activeFileName}>
        <button
          class="file-tab"
          type="button"
          role="tab"
          aria-selected={file.name === appState.activeFileName}
          title={file.name}
          onclick={() => selectFile(file.name)}
        >
          <svg class="file-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1" fill="none" />
            <path d="M10 2v3h3" stroke="currentColor" stroke-width="1" fill="none" />
          </svg>
          <span class="file-tab-name">{file.name}</span>
          {#if file.name === appState.activeFileName && appState.unsaved}
            <span class="unsaved-dot" aria-hidden="true"></span>
          {/if}
        </button>
        {#if file.name !== 'sketch.q'}
          <button class="file-tab-action" type="button" title="Rename {file.name}" aria-label="Rename {file.name}" onclick={() => renameFile(file.name)}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 13h10M8 3l-4 4v2h2l4-4-2-2zM10 5l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>
          </button>
          <button class="file-tab-action" type="button" title="Delete {file.name}" aria-label="Delete {file.name}" onclick={() => deleteFile(file.name)}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" /><path d="M4 4l1 9h6l1-9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" /></svg>
          </button>
        {/if}
      </div>
    {/each}
  </div>

  <div class="file-tab-actions" aria-label="File actions">
    <button class="file-tab-tool" id={mobile ? 'mobile-btn-new-q-file' : 'btn-new-q-file'} type="button" title="New .q file" aria-label="New .q file" onclick={() => appState.openNewFileModal()}>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1.4" fill="none" />
        <path d="M10 2v3h3M7 8v4M5 10h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button class="file-tab-tool" id={mobile ? 'mobile-btn-import-image' : 'btn-import-image'} type="button" title="Import or upload image" aria-label="Import or upload image" onclick={() => void appState.importAssets()}>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" rx="1.2" stroke="currentColor" stroke-width="1.3" fill="none" />
        <path d="M2 10l3-3 3 3 2-2 4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        <circle cx="5.5" cy="6" r="0.8" fill="currentColor" />
      </svg>
    </button>
  </div>
</div>
