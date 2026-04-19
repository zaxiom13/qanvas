<script lang="ts">
  import { browserGateway } from '$lib/browser';
  import { onDestroy, onMount } from 'svelte';
  import MonacoEditor from '$lib/components/MonacoEditor.svelte';
  import { appState } from '$lib/state/app-state.svelte';

  let dragCleanup = () => {};

  function handleGlobalShortcuts() {
    const saveHandler = () => void appState.saveProject(false);
    const sidebarHandler = () => appState.toggleSidebar();
    const exampleHandler = () => (appState.activeModal = appState.activeModal === 'examples' ? null : 'examples');
    const projectsHandler = () => appState.openProjectsModal();
    const newHandler = () => void appState.createNewSketch();

    window.addEventListener('qanvas:save', saveHandler as EventListener);
    window.addEventListener('qanvas:toggle-sidebar', sidebarHandler as EventListener);
    window.addEventListener('qanvas:toggle-examples', exampleHandler as EventListener);
    window.addEventListener('qanvas:toggle-projects', projectsHandler as EventListener);
    window.addEventListener('qanvas:new-sketch', newHandler as EventListener);

    return () => {
      window.removeEventListener('qanvas:save', saveHandler as EventListener);
      window.removeEventListener('qanvas:toggle-sidebar', sidebarHandler as EventListener);
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
    const practice = appState.workspaceMode === 'practice';

    const handleMove = (moveEvent: PointerEvent) => {
      const delta = practice ? startX - moveEvent.clientX : moveEvent.clientX - startX;
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
    <div class="editor-tab editor-tab--active" id="active-tab">
      <svg class="file-icon" viewBox="0 0 16 16" fill="none">
        <path d="M4 2h6l3 3v9H4V2z" stroke="currentColor" stroke-width="1" fill="none" />
        <path d="M10 2v3h3" stroke="currentColor" stroke-width="1" fill="none" />
      </svg>
      <span id="active-tab-name">{appState.workspaceMode === 'practice' ? 'Practice Editor' : appState.activeFileName}</span>
    </div>
  </div>

  <MonacoEditor
    activeKey={appState.activeEditorKey}
    value={appState.activeEditorValue}
    onChange={(value) => appState.updateActiveEditorContent(value)}
    onInteractiveChange={(value) => appState.updateActiveEditorContent(value, { restartRuntime: true })}
  />

  <button
    class="editor-resize-handle"
    class:editor-resize-handle--left={appState.workspaceMode === 'practice'}
    type="button"
    aria-label={appState.workspaceMode === 'practice' ? 'Resize practice and editor' : 'Resize editor and canvas'}
    title="Drag to resize"
    onpointerdown={startResize}
  ></button>
</section>
