import './app.css';
import { mount } from 'svelte';
import { installQanvasAPI, switchBackend } from '$lib/runtime/install';
import { loadBackendSettings, settingsToConfig } from '$lib/runtime/backend';

installQanvasAPI();
switchBackend(settingsToConfig(loadBackendSettings()));

void import('./lib/components/modals/ExamplesModal.svelte');
void import('./lib/components/modals/ProjectsModal.svelte');
void import('./lib/components/modals/SettingsModal.svelte');

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
