<script lang="ts">
  import { browserGateway } from '$lib/browser';
  import { onDestroy, onMount } from 'svelte';
  import FileTabs from '$lib/components/FileTabs.svelte';
  import CodeMirrorEditor from '$lib/components/CodeMirrorEditor.svelte';
  import { appState } from '$lib/state/app-state.svelte';

  let dragCleanup = () => {};

  function handleGlobalShortcuts() {
    const saveHandler = () => {
      if (appState.workspaceMode === 'studio') void appState.saveProject(false);
    };
    const exampleHandler = () => (appState.activeModal = appState.activeModal === 'examples' ? null : 'examples');
    const projectsHandler = () => {
      if (appState.workspaceMode === 'studio') appState.openProjectsModal();
    };
    const newHandler = () => {
      if (appState.workspaceMode === 'studio') void appState.createNewSketch();
    };

    window.addEventListener('qanvas:save', saveHandler as EventListener);
    window.addEventListener('qanvas:toggle-examples', exampleHandler as EventListener);
    window.addEventListener('qanvas:toggle-projects', projectsHandler as EventListener);
    window.addEventListener('qanvas:new-sketch', newHandler as EventListener);

    return () => {
      window.removeEventListener('qanvas:save', saveHandler as EventListener);
      window.removeEventListener('qanvas:toggle-examples', exampleHandler as EventListener);
      window.removeEventListener('qanvas:toggle-projects', projectsHandler as EventListener);
      window.removeEventListener('qanvas:new-sketch', newHandler as EventListener);
    };
  }

  function startResize(event: PointerEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    const pointerId = event.pointerId;
    target.setPointerCapture(pointerId);

    const startX = event.clientX;
    const startWidth = appState.editorPanelWidth;
    const handleMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      appState.setEditorPanelWidth(startWidth + delta);
    };

    const cleanup = () => {
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      document.body.classList.remove('is-resizing-editor');
      dragCleanup = () => {};
    };

    document.body.classList.add('is-resizing-editor');
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
    dragCleanup = cleanup;
  }

  onMount(() => {
    appState.setEditorPanelWidth(appState.editorPanelWidth);

    const disposeShortcuts = handleGlobalShortcuts();
    const disposeMenuComment = browserGateway.menu.onToggleComment(() => {
      window.dispatchEvent(new CustomEvent('qanvas:toggle-comment'));
    });

    const onResize = () => appState.setEditorPanelWidth(appState.editorPanelWidth);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      disposeShortcuts();
      disposeMenuComment();
    };
  });

  onDestroy(() => {
    dragCleanup();
  });
</script>

<section
  id="editor-panel"
  class:editor-panel--practice={appState.workspaceMode === 'practice'}
  style={`flex: 0 0 ${appState.editorPanelWidth}px; width: ${appState.editorPanelWidth}px;`}
>
  <div class="editor-tabs">
    {#if appState.workspaceMode === 'practice'}
      <FileTabs />
    {:else}
      <FileTabs />
    {/if}
  </div>

  <CodeMirrorEditor
    activeKey={appState.activeEditorKey}
    value={appState.activeEditorValue}
    onChange={(value) => appState.updateActiveEditorContent(value)}
    onInteractiveChange={(value) => appState.updateActiveEditorContent(value, { restartRuntime: true })}
  />

  <button
    class="editor-resize-handle"
    type="button"
    aria-label={appState.workspaceMode === 'practice' ? 'Resize practice and editor' : 'Resize editor and canvas'}
    title="Drag to resize"
    onpointerdown={startResize}
  ></button>
</section>
