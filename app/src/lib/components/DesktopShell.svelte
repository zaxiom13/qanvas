<script lang="ts">
  import Toolbar from './Toolbar.svelte';
  import EditorPanel from './EditorPanel.svelte';
  import CanvasPanel from './CanvasPanel.svelte';
  import PracticePanel from './PracticePanel.svelte';
  import ReferencePanel from './ReferencePanel.svelte';
  import ConsolePanel from './ConsolePanel.svelte';
  import { appState } from '$lib/state/app-state.svelte';
</script>

<div class="app-root">
  <Toolbar />

  <main id="workspace">
    {#if appState.workspaceMode === 'practice'}
      <EditorPanel />
      <PracticePanel />
    {:else if appState.workspaceMode === 'reference'}
      <ReferencePanel />
    {:else}
      <EditorPanel />
      <CanvasPanel />
    {/if}
  </main>

  <ConsolePanel />
</div>
