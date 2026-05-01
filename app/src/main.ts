import './app.css';
import { mount } from 'svelte';
import { installQanvasAPI, switchBackend } from '$lib/runtime/install';
import { loadBackendSettings, settingsToConfig } from '$lib/runtime/backend';

installQanvasAPI();
switchBackend(settingsToConfig(loadBackendSettings()));

function warmInitialLayout() {
  const isMobile = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 1024px)').matches;
  if (isMobile) {
    void import('./lib/mobile/MobileShell.svelte');
    return;
  }

  void import('./lib/components/DesktopShell.svelte');
}

warmInitialLayout();

window.addEventListener(
  'qanvas:app-ready',
  () => {
    document.body.classList.add('qanvas-app-ready');
    document.getElementById('qanvas-boot-fallback')?.remove();
  },
  { once: true },
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

void (async () => {
  const [{ default: App }, { appState }] = await Promise.all([
    import('./App.svelte'),
    import('$lib/state/app-state.svelte'),
  ]);

  appState.initialize();

  mount(App, {
    target: document.getElementById('app')!,
  });
})();
