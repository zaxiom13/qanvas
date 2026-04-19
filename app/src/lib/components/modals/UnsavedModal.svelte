<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';
</script>

<div id="modal-unsaved" class="modal" hidden={appState.activeModal !== 'unsaved'}>
  <button class="modal-backdrop" type="button" aria-label="Cancel unsaved changes dialog" onclick={() => appState.resolveUnsaved('cancel')}></button>
  <div class="modal-box modal-box--sm">
    <div class="modal-header">
      <h2 class="modal-title">Unsaved Changes</h2>
    </div>
    <div class="modal-body">
      <p class="modal-message">You have unsaved changes. Do you want to save before continuing?</p>
    </div>
    <div class="modal-footer">
      <button class="btn-danger" id="btn-unsaved-discard" type="button" onclick={() => appState.resolveUnsaved('discard')}>Discard</button>
      <button class="btn-secondary" id="btn-unsaved-cancel" type="button" onclick={() => appState.resolveUnsaved('cancel')}>Cancel</button>
      <button class="btn-primary" id="btn-unsaved-save" type="button" onclick={() => void appState.saveFromUnsavedModal()}>Save</button>
    </div>
  </div>
</div>
