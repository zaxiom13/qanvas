<script lang="ts">
  import { onMount, tick, type Component } from 'svelte';
  import DesktopShell from './lib/components/DesktopShell.svelte';
  import MobileShell from './lib/mobile/MobileShell.svelte';
  import { appState } from './lib/state/app-state.svelte';

  type ModalName = Exclude<typeof appState.activeModal, null>;

  const modalLoaders = {
    settings: () => import('./lib/components/modals/SettingsModal.svelte'),
    'new-file': () => import('./lib/components/modals/NewFileModal.svelte'),
    unsaved: () => import('./lib/components/modals/UnsavedModal.svelte'),
    examples: () => import('./lib/components/modals/ExamplesModal.svelte'),
    projects: () => import('./lib/components/modals/ProjectsModal.svelte'),
    'export-gif': () => import('./lib/components/modals/ExportGifModal.svelte'),
    info: () => import('./lib/components/modals/InfoModal.svelte'),
  } satisfies Record<ModalName, () => Promise<{ default: Component }>>;

  const layoutQuery = '(max-width: 760px), (pointer: coarse) and (max-width: 1024px)';

  let isMobileLayout = $state(
    typeof window !== 'undefined' && window.matchMedia(layoutQuery).matches,
  );

  let LayoutComponent = $derived(isMobileLayout ? MobileShell : DesktopShell);

  let ModalComponent = $state<Component | null>(null);
  let UxTourComponent = $state<Component | null>(null);
  let modalLoadToken = 0;
  let bootFallbackRemoved = false;

  async function loadModal(modal: ModalName | null) {
    const token = ++modalLoadToken;
    if (!modal) {
      ModalComponent = null;
      return;
    }

    const module = await modalLoaders[modal]();
    if (token === modalLoadToken && appState.activeModal === modal) ModalComponent = module.default;
  }

  onMount(() => {
    const media = window.matchMedia(layoutQuery);
    const update = () => {
      isMobileLayout = media.matches;
    };

    media.addEventListener('change', update);

    void tick().then(() => {
      if (!bootFallbackRemoved) {
        bootFallbackRemoved = true;
        window.dispatchEvent(new CustomEvent('qanvas:app-ready'));
      }
    });

    return () => {
      media.removeEventListener('change', update);
    };
  });

  $effect(() => {
    void loadModal(appState.activeModal);
  });

  $effect(() => {
    if (appState.isOnTour || appState.uxTourActive) {
      void import('./lib/components/UxTour.svelte').then((module) => {
        UxTourComponent = module.default;
      });
    }
  });

  $effect(() => {
    const base = 'Qanvas5';
    if (appState.workspaceMode === 'practice') {
      document.title = `${appState.activePracticeChallenge.title} · Practice · ${base}`;
      return;
    }
    const dirty = appState.unsaved ? ' (unsaved)' : '';
    document.title = `${appState.projectName}${dirty} · ${base}`;
  });
</script>

<LayoutComponent />

{#if ModalComponent}
  <ModalComponent />
{/if}

{#if UxTourComponent}
  <UxTourComponent mobile={isMobileLayout} />
{/if}
