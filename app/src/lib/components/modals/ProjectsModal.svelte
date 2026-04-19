<script lang="ts">
  import { appState } from '$lib/state/app-state.svelte';

  function formatDate(value: number) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }
</script>

<div id="modal-projects" class="modal" hidden={appState.activeModal !== 'projects'}>
  <button class="modal-backdrop" type="button" aria-label="Close projects" onclick={() => appState.closeModal('projects')}></button>
  <div class="modal-box modal-box--projects">
    <div class="modal-header">
      <div class="projects-header-copy">
        <h2 class="modal-title">Projects</h2>
        <p class="projects-root-copy">All sketches save to <code>{appState.projectsRoot}</code></p>
      </div>
      <button class="modal-close" id="btn-projects-close" type="button" aria-label="Close projects" onclick={() => appState.closeModal('projects')}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
    </div>

    <div class="modal-body projects-body">
      {#if appState.projectLibraryLoading}
        <div class="projects-empty">Loading projects…</div>
      {:else if appState.projectLibrary.length}
        <div class="projects-list">
          {#each appState.projectLibrary as project (project.projectPath)}
            <button
              type="button"
              class="project-card"
              class:project-card--active={project.projectPath === appState.projectPath}
              onclick={() => void appState.openProject(project.projectPath)}
            >
              <div class="project-card-main">
                <div class="project-card-title-row">
                  <span class="project-card-title">{project.projectName}</span>
                  <span class="project-card-date">{formatDate(project.updatedAt)}</span>
                </div>
                <div class="project-card-path">{project.projectPath}</div>
              </div>
              <div class="project-card-meta">
                <span>{project.fileCount} file{project.fileCount === 1 ? '' : 's'}</span>
                <span>{project.assetCount} asset{project.assetCount === 1 ? '' : 's'}</span>
              </div>
            </button>
          {/each}
        </div>
      {:else}
        <div class="projects-empty">
          <p>No saved projects yet.</p>
          <p>Your first save will create a folder in this library automatically.</p>
        </div>
      {/if}
    </div>
  </div>
</div>
