<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';
</script>

{#if appState.activeModal === 'info'}
  <div class="modal info-modal" role="dialog" aria-modal="true" aria-labelledby="info-modal-title">
    <button class="modal-backdrop" type="button" aria-label="Close info" onclick={() => appState.closeModal('info')}></button>
    <section class="modal-box modal-box--info">
      <div class="modal-header">
        <h2 id="info-modal-title" class="modal-title">About Qanvas5</h2>
        <button class="modal-close" type="button" aria-label="Close info" onclick={() => appState.closeModal('info')}>
          <svg class="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div class="modal-body info-modal-body">
        <p>Qanvas5 is a creative coding sketchbook for kdb+/q. Write q in the editor, run it, and draw frames with commands like <code>background</code>, <code>circle</code>, <code>rect</code>, <code>line</code>, <code>text</code>, and <code>image</code>.</p>
        <p>Use Studio for open-ended sketches. Use Practice for small q exercises: edit the answer, run it from the editor tab, and compare the output.</p>
        <p>Type slash snippets in the editor for fast scaffolds: <code>/sketch</code>, <code>/setup</code>, <code>/draw</code>, <code>/function</code>, <code>/circle</code>, <code>/rect</code>, <code>/text</code>, and <code>/image</code>.</p>
        <p>Images can be uploaded from the file tabs and referenced as <code>"assets/your-file.png"</code> in an <code>image[]</code> table. Projects autosave when they have a saved location.</p>
      </div>
    </section>
  </div>
{/if}
