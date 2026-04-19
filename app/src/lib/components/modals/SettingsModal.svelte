<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';
  import { backendState } from '$lib/state/backend-state.svelte';

  function choose(kind: 'browser' | 'local-q' | 'cloud-q') {
    backendState.setDraftKind(kind);
  }

  async function test() {
    await backendState.testConnection();
  }

  function apply() {
    if (backendState.apply()) {
      appState.closeModal('settings');
    }
  }

  function close() {
    backendState.resetDraft();
    appState.closeModal('settings');
  }
</script>

<div id="modal-settings" class="modal" hidden={appState.activeModal !== 'settings'}>
  <button class="modal-backdrop" type="button" aria-label="Close settings" onclick={close}></button>
  <div class="modal-box" style="max-width: 640px;">
    <div class="modal-header">
      <h2 class="modal-title">Runtime Backend</h2>
      <button class="modal-close" type="button" aria-label="Close settings" onclick={close}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
    </div>
    <div class="modal-body">
      <p class="settings-description">
        Qanvas sketches can run in three places. All backends speak the same wire protocol,
        so you can switch at any time without changing your code.
      </p>

      <div class="settings-section">
        <div class="backend-grid">
          <button type="button" class="backend-card" class:selected={backendState.draft.kind === 'browser'} onclick={() => choose('browser')}>
            <div class="backend-title">Browser</div>
            <div class="backend-sub">jqport · zero install · fully offline</div>
            <div class="backend-desc">Runs a TypeScript port of q in a Web Worker. Great for sharing sketches as a static page.</div>
          </button>

          <button type="button" class="backend-card" class:selected={backendState.draft.kind === 'local-q'} onclick={() => choose('local-q')}>
            <div class="backend-title">Local q</div>
            <div class="backend-sub">real kdb+ · needs your license</div>
            <div class="backend-desc">Connect over WebSocket to a q process on this machine. Unlocks full q semantics and speed.</div>
          </button>

          <button type="button" class="backend-card" class:selected={backendState.draft.kind === 'cloud-q'} onclick={() => choose('cloud-q')}>
            <div class="backend-title">Cloud q</div>
            <div class="backend-sub">real kdb+ · hosted somewhere</div>
            <div class="backend-desc">Point at a remote q WebSocket. Share one backend across many clients, or use ours.</div>
          </button>
        </div>

        {#if backendState.draft.kind === 'local-q'}
          <div class="settings-input-row" style="margin-top: 1rem;">
            <label class="settings-label" for="local-q-url">Local q WebSocket</label>
            <input
              type="text"
              id="local-q-url"
              class="settings-input"
              placeholder="ws://127.0.0.1:5042"
              spellcheck="false"
              value={backendState.draft.localUrl}
              oninput={(e) => backendState.setDraftLocal((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <p class="settings-description" style="margin-top:0.25rem;">
            Start a q listener on that port. See the <code>README</code> for a ready-made boot file.
            Tip: <code>npm run q:direct</code> starts a q on port 5042 with the Qanvas protocol loaded.
          </p>
        {/if}

        {#if backendState.draft.kind === 'cloud-q'}
          <div class="settings-input-row" style="margin-top: 1rem;">
            <label class="settings-label" for="cloud-q-url">Cloud q WebSocket URL</label>
            <input
              type="text"
              id="cloud-q-url"
              class="settings-input"
              placeholder="wss://qanvas.example.com/ws"
              spellcheck="false"
              value={backendState.draft.cloudUrl}
              oninput={(e) => backendState.setDraftCloud((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          <p class="settings-description" style="margin-top:0.25rem;">
            We recommend <code>wss://</code> for any non-loopback URL. See <code>deploy/docker-cloud-q/</code> for a turnkey recipe.
          </p>
        {/if}

        {#if backendState.statusMessage}
          <div class="runtime-detect-status"
            class:ok={backendState.status === 'ok'}
            class:error={backendState.status === 'error'}
            style="margin-top: 0.75rem;">
            {backendState.statusMessage}
          </div>
        {/if}

        <div style="margin-top:0.75rem; font-size:0.8rem; opacity:0.7;">
          Current: <strong>{backendState.activeLabel}</strong>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      {#if backendState.draft.kind !== 'browser'}
        <button class="btn-secondary" type="button" onclick={test} disabled={backendState.status === 'testing'}>
          Test connection
        </button>
      {/if}
      <button class="btn-secondary" type="button" onclick={close}>Cancel</button>
      <button class="btn-primary" type="button" onclick={apply}>Apply</button>
    </div>
  </div>
</div>

<style>
  .backend-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.75rem;
  }
  .backend-card {
    text-align: left;
    background: #fff;
    border: 1px solid #E5E5E5;
    border-radius: 10px;
    padding: 0.875rem 1rem;
    cursor: pointer;
    transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  }
  .backend-card:hover {
    border-color: #c0c0c0;
  }
  .backend-card.selected {
    border-color: #4F7FFF;
    box-shadow: 0 0 0 2px rgba(79, 127, 255, 0.2);
  }
  .backend-title {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 2px;
  }
  .backend-sub {
    font-size: 0.75rem;
    opacity: 0.65;
    margin-bottom: 0.5rem;
  }
  .backend-desc {
    font-size: 0.8rem;
    line-height: 1.35;
    opacity: 0.85;
  }
</style>
