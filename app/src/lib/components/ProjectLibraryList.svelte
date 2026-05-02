<script lang="ts">
  import { projectCardSubtitle } from '$lib/projects-display';
  import { appState } from '$lib/state/app-state.svelte';

  type Props = {
    /** e.g. switch mobile tab after opening a sketch */
    afterOpen?: () => void;
    emptyDetail?: string;
  };

  let { afterOpen, emptyDetail = 'Your first save adds a sketch here automatically.' }: Props = $props();

  function formatDate(value: number) {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  async function open(projectPath: string) {
    await appState.openProject(projectPath);
    afterOpen?.();
  }
</script>

{#if appState.projectLibraryLoading}
  <div class="projects-empty">Loading projects…</div>
{:else if appState.projectLibrary.length}
  <div class="projects-list">
    {#each appState.projectLibrary as project (project.projectPath)}
      <button
        type="button"
        class="project-card"
        class:project-card--active={project.projectPath === appState.projectPath}
        onclick={() => void open(project.projectPath)}
      >
        <div class="project-card-main">
          <div class="project-card-title-row">
            <span class="project-card-title">{project.projectName}</span>
            <span class="project-card-date">{formatDate(project.updatedAt)}</span>
          </div>
          {#if projectCardSubtitle(project.projectPath)}
            <div class="project-card-path">{projectCardSubtitle(project.projectPath)}</div>
          {/if}
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
    <p>No saved sketches yet.</p>
    <p>{emptyDetail}</p>
  </div>
{/if}
