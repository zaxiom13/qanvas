<script lang="ts">
  import { onMount, tick, type Component } from 'svelte';
  import { appState } from './lib/state/app-state.svelte';

  type LayoutName = 'mobile' | 'desktop';
  type ModalName = Exclude<typeof appState.activeModal, null>;

  const layoutLoaders = {
    mobile: () => import('./lib/mobile/MobileShell.svelte'),
    desktop: () => import('./lib/components/DesktopShell.svelte'),
  } satisfies Record<LayoutName, () => Promise<{ default: Component }>>;

  const modalLoaders = {
    settings: () => import('./lib/components/modals/SettingsModal.svelte'),
    'new-file': () => import('./lib/components/modals/NewFileModal.svelte'),
    unsaved: () => import('./lib/components/modals/UnsavedModal.svelte'),
    examples: () => import('./lib/components/modals/ExamplesModal.svelte'),
    projects: () => import('./lib/components/modals/ProjectsModal.svelte'),
    'export-gif': () => import('./lib/components/modals/ExportGifModal.svelte'),
    info: () => import('./lib/components/modals/InfoModal.svelte'),
  } satisfies Record<ModalName, () => Promise<{ default: Component }>>;

  let isMobileLayout = $state(false);
  let activeLayout = $state<LayoutName | null>(null);
  let LayoutComponent = $state<Component | null>(null);
  let ModalComponent = $state<Component | null>(null);
  let UxTourComponent = $state<Component | null>(null);
  let layoutLoadToken = 0;
  let modalLoadToken = 0;
  let bootFallbackRemoved = false;

  async function loadLayout(layout: LayoutName) {
    const token = ++layoutLoadToken;
    activeLayout = layout;
    LayoutComponent = null;
    const module = await layoutLoaders[layout]();
    if (token === layoutLoadToken) LayoutComponent = module.default;
  }

  async function loadModal(modal: ModalName | null) {
    const token = ++modalLoadToken;
    if (!modal) {
      ModalComponent = null;
      return;
    }

    const module = await modalLoaders[modal]();
    if (token === modalLoadToken && appState.activeModal === modal) ModalComponent = module.default;
  }

  async function signalBootReady() {
    if (bootFallbackRemoved || !LayoutComponent) return;
    bootFallbackRemoved = true;
    await tick();
    window.dispatchEvent(new CustomEvent('qanvas:app-ready'));
  }

  onMount(() => {
    const media = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 1024px)');
    const update = () => {
      const nextMobile = media.matches;
      const nextLayout: LayoutName = nextMobile ? 'mobile' : 'desktop';
      isMobileLayout = nextMobile;
      if (activeLayout !== nextLayout) void loadLayout(nextLayout);
    };

    update();
    media.addEventListener('change', update);

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
    void signalBootReady();
  });
</script>

{#if LayoutComponent}
  <LayoutComponent />
{/if}

{#if ModalComponent}
  <ModalComponent />
{/if}

{#if UxTourComponent}
  <UxTourComponent mobile={isMobileLayout} />
{/if}
