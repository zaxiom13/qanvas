import './app.css';
import { mount } from 'svelte';
import { installQanvasAPI, switchBackend } from '$lib/runtime/install';
import { loadBackendSettings, settingsToConfig } from '$lib/runtime/backend';

installQanvasAPI();
switchBackend(settingsToConfig(loadBackendSettings()));

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
