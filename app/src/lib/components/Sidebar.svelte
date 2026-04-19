<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';

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
</script>

<aside id="sidebar" class:collapsed={appState.sidebarCollapsed}>
  <div class="sidebar-header">
    <span class="sidebar-title">Files</span>
    <div class="sidebar-actions">
      <button class="sidebar-icon-btn" id="btn-new-file" type="button" title="New file" onclick={() => appState.openNewFileModal()}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
      <button class="sidebar-icon-btn" id="btn-import-asset" type="button" title="Import asset" onclick={() => void appState.importAssets()}>
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M8 2v8M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
      <button class="sidebar-icon-btn" id="btn-sidebar-toggle" type="button" title="Collapse sidebar (Cmd+B)" onclick={() => appState.toggleSidebar()}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    </div>
  </div>

  <div id="file-tree" class="file-tree">
    {#each appState.files as file (file.name)}
      <div class="file-item" class:file-item--active={file.name === appState.activeFileName} data-file={file.name}>
        <button class="file-button" type="button" onclick={() => appState.selectFile(file.name)}>
          <svg class="file-icon" viewBox="0 0 16 16" fill="none">
            <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1" fill="none" />
            <path d="M10 2v3h3" stroke="currentColor" stroke-width="1" fill="none" />
          </svg>
          <span class="file-name">{file.name}</span>
        </button>
        {#if file.name !== 'sketch.q'}
          <div class="file-item-actions">
            <button class="file-action-btn" type="button" title="Rename" onclick={() => renameFile(file.name)}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 13h10M8 3l-4 4v2h2l4-4-2-2zM10 5l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none" /></svg>
            </button>
            <button class="file-action-btn" type="button" title="Delete" onclick={() => deleteFile(file.name)}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" /><path d="M4 4l1 9h6l1-9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" /></svg>
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="sidebar-section-label">Assets</div>
  <div id="asset-tree" class="file-tree asset-tree">
    <div class="file-item file-item--folder">
      <svg class="file-icon" viewBox="0 0 16 16" fill="none">
        <path d="M2.5 4.5h4l1.4 1.5h5.6v5.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linejoin="round" />
        <path d="M2.5 6h11" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" />
      </svg>
      <span class="file-name">/assets/</span>
    </div>
    <div class="asset-folder-contents">
      {#if appState.assets.length}
        {#each appState.assets as asset (asset.name)}
          <div class="file-item file-item--nested">
            <svg class="file-icon" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" stroke-width="1" fill="none" />
              <path d="M2 9l3-3 3 3 2-2 4 4" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" fill="none" />
              <circle cx="5.5" cy="6" r="0.8" fill="currentColor" />
            </svg>
            <span class="file-name">{asset.name}</span>
          </div>
        {/each}
      {:else}
        <div class="asset-folder-empty">Empty</div>
      {/if}
      <div class="asset-drop-zone" id="asset-drop-zone">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 16V8M9 11l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        <span>Drop files here</span>
      </div>
    </div>
  </div>

  <div class="sidebar-footer">
    <div id="runtime-status" class="runtime-status" class:runtime-status--ok={appState.runtimeOk} class:runtime-status--missing={!appState.runtimeOk}>
      <div class="runtime-dot"></div>
      <span id="runtime-status-label">{appState.runtimeOk ? `q: ${appState.runtimePath.split('/').pop() || appState.runtimePath}` : 'q runtime not found'}</span>
    </div>
  </div>
</aside>
