<script lang="ts">
  import ProjectLibraryList from '$lib/components/ProjectLibraryList.svelte';
  import { projectsLibraryBlurb } from '$lib/projects-display';
  import { appState } from '$lib/state/app-state.svelte';

  let libraryCopy = $derived(projectsLibraryBlurb(appState.projectsRoot, appState.projectLibraryLoading));
</script>

<div id="modal-projects" class="modal" hidden={appState.activeModal !== 'projects'}>
  <button class="modal-backdrop" type="button" aria-label="Close projects" onclick={() => appState.closeModal('projects')}></button>
  <div class="modal-box modal-box--projects">
    <div class="modal-header">
      <div class="projects-header-copy">
        <h2 class="modal-title">Projects</h2>
        <p class="projects-root-copy">
          {libraryCopy.primary}
          {#if libraryCopy.code}
            <code title={libraryCopy.code}>{libraryCopy.code}</code>
          {/if}
        </p>
      </div>
      <button class="modal-close" id="btn-projects-close" type="button" aria-label="Close projects" onclick={() => appState.closeModal('projects')}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
    </div>

    <div class="modal-body projects-body">
      <ProjectLibraryList />
    </div>
  </div>
</div>
