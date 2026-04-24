<script lang="ts">
  import Toolbar from './lib/components/Toolbar.svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import EditorPanel from './lib/components/EditorPanel.svelte';
  import CanvasPanel from './lib/components/CanvasPanel.svelte';
  import PracticePanel from './lib/components/PracticePanel.svelte';
  import ConsolePanel from './lib/components/ConsolePanel.svelte';
  import SettingsModal from './lib/components/modals/SettingsModal.svelte';
  import NewFileModal from './lib/components/modals/NewFileModal.svelte';
  import UnsavedModal from './lib/components/modals/UnsavedModal.svelte';
  import ExamplesModal from './lib/components/modals/ExamplesModal.svelte';
  import ProjectsModal from './lib/components/modals/ProjectsModal.svelte';
  import ExportGifModal from './lib/components/modals/ExportGifModal.svelte';
  import MobileShell from './lib/mobile/MobileShell.svelte';
  import { appState } from './lib/state/app-state.svelte';

  let isMobileLayout = $state(false);

  $effect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 1024px)');
    const update = () => {
      isMobileLayout = media.matches;
    };

    update();
    media.addEventListener('change', update);

    return () => {
      media.removeEventListener('change', update);
    };
  });
</script>

{#if isMobileLayout}
  <MobileShell />

  <SettingsModal />
  <NewFileModal />
  <UnsavedModal />
  <ExamplesModal />
  <ProjectsModal />
  <ExportGifModal />
{:else}
  <div class="app-root">
    <Toolbar />

    <main id="workspace" class:sidebar-collapsed={appState.sidebarCollapsed}>
      {#if appState.workspaceMode !== 'practice'}
        <Sidebar />

        <button
          class="sidebar-expand-btn"
          id="btn-sidebar-expand"
          type="button"
          title="Expand sidebar (Cmd+B)"
          onclick={() => appState.toggleSidebar()}
        >
          <svg viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      {/if}

      {#if appState.workspaceMode === 'practice'}
        <PracticePanel />
        <EditorPanel />
      {:else}
        <EditorPanel />
        <CanvasPanel />
      {/if}
    </main>

    <ConsolePanel />

    <SettingsModal />
    <NewFileModal />
    <UnsavedModal />
    <ExamplesModal />
    <ProjectsModal />
    <ExportGifModal />
  </div>
{/if}
