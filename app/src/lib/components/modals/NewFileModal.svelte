<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';
</script>

<div id="modal-new-file" class="modal" hidden={appState.activeModal !== 'new-file'}>
  <button class="modal-backdrop" type="button" aria-label="Close new file" onclick={() => appState.closeModal('new-file')}></button>
  <div class="modal-box modal-box--sm">
    <div class="modal-header">
      <h2 class="modal-title">New File</h2>
      <button class="modal-close" id="btn-new-file-close" type="button" aria-label="Close new file" onclick={() => appState.closeModal('new-file')}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
    </div>
    <div class="modal-body">
      <label class="settings-label" for="new-file-input">Filename</label>
      <input type="text" id="new-file-input" class="settings-input" placeholder="helpers.q" spellcheck="false" bind:value={appState.newFileName} onkeydown={(event) => event.key === 'Enter' && appState.createFile()} />
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="btn-new-file-cancel" type="button" onclick={() => appState.closeModal('new-file')}>Cancel</button>
      <button class="btn-primary" id="btn-new-file-confirm" type="button" onclick={() => appState.createFile()}>Create</button>
    </div>
  </div>
</div>
