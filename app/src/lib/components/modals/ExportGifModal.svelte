<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';
</script>

<div id="modal-export-gif" class="modal" hidden={appState.activeModal !== 'export-gif'}>
  <button class="modal-backdrop" type="button" aria-label="Close GIF export" onclick={() => appState.closeModal('export-gif')}></button>
  <div class="modal-box modal-box--sm">
    <div class="modal-header">
      <h2 class="modal-title">Export GIF</h2>
      <button class="modal-close" id="btn-export-gif-close" type="button" aria-label="Close GIF export" onclick={() => appState.closeModal('export-gif')}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
    </div>
    <div class="modal-body">
      <label class="settings-label" for="gif-duration-input">Duration (seconds)</label>
      <input type="number" id="gif-duration-input" class="settings-input" min="1" max="30" bind:value={appState.gifDuration} />
      <p class="settings-description">Recording flow stays in place while the new encoder pipeline is being finished.</p>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="btn-export-gif-cancel" type="button" onclick={() => appState.closeModal('export-gif')}>Cancel</button>
      <button class="btn-primary" id="btn-export-gif-start" type="button" onclick={() => appState.startGifExport()}>Start Recording</button>
    </div>
  </div>
</div>
