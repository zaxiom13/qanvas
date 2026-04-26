<script lang="ts">
  import { getExamplePreviewSrc } from '$lib/example-previews';
  import { appState } from '$lib/state/app-state.svelte';
  import { pretextFit } from '$lib/text/pretext-fit';

  function pickPracticeChallenge(id: string) {
    appState.setPracticeChallenge(id);
    appState.closeModal('examples');
  }
</script>

<div id="modal-examples" class="modal" hidden={appState.activeModal !== 'examples'}>
  <button class="modal-backdrop" type="button" aria-label="Close examples" onclick={() => appState.closeModal('examples')}></button>
  <div class="modal-box modal-box--examples">
    <div class="modal-header">
      <h2 class="modal-title">{appState.workspaceMode === 'practice' ? 'Lessons' : 'Examples'}</h2>
      {#if appState.workspaceMode === 'studio'}
        <div class="examples-category-filters" id="examples-filters">
          {#each appState.exampleCategories as category}
            <button type="button" class="examples-filter-pill" class:examples-filter-pill--active={appState.exampleCategory === category} onclick={() => (appState.exampleCategory = category)}>
              {category}
            </button>
          {/each}
        </div>
      {/if}
      <button class="modal-close" id="btn-examples-close" type="button" aria-label="Close examples" onclick={() => appState.closeModal('examples')}>
        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
      </button>
    </div>
    <div class="modal-body examples-body">
      {#if appState.workspaceMode === 'practice'}
        <div class="practice-lessons-grid">
          {#each appState.practiceChallenges as challenge (challenge.id)}
            <button
              type="button"
              class="practice-lesson-card"
              class:is-active={challenge.id === appState.practiceChallengeId}
              onclick={() => pickPracticeChallenge(challenge.id)}
            >
              <span class="practice-lesson-kicker">{challenge.difficulty}{#if challenge.topic} · {challenge.topic}{/if}</span>
              <strong>{challenge.title}</strong>
              <p>{challenge.prompt}</p>
            </button>
          {/each}
        </div>
      {:else}
        <div id="examples-grid" class="examples-grid">
          {#each appState.filteredExamples as example (example.id)}
            {@const previewSrc = getExamplePreviewSrc(example.id)}
            <button type="button" class="example-card" style={`--example-accent:${example.accent}`} onclick={() => void appState.loadExample(example.id)}>
              <div class="example-card-thumb">
                {#if previewSrc}
                  <img class="example-card-preview" src={previewSrc} alt="" loading="lazy" decoding="async" />
                {/if}
                <div class="example-card-thumb-grid"></div>
                <span class="example-card-category">{example.category}</span>
              </div>
              <div class="example-card-body">
                <div class="example-card-header">
                  <h3 class="example-card-title" use:pretextFit={{ min: 12, max: 15 }}>{example.name}</h3>
                  <div class="example-difficulty" aria-label={`Difficulty ${example.difficulty} of 3`}>
                    {#each [1, 2, 3] as index}
                      <span class="example-difficulty-dot" class:is-active={index <= example.difficulty}></span>
                    {/each}
                  </div>
                </div>
                <p class="example-card-description">{example.description}</p>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .example-card-preview {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .practice-lessons-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }

  .practice-lesson-card {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-height: 140px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--bg-editor);
    color: var(--text-primary);
    text-align: left;
  }

  .practice-lesson-card.is-active {
    border-color: var(--accent);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .practice-lesson-kicker {
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 10.5px;
    text-transform: capitalize;
  }

  .practice-lesson-card strong {
    font-size: 15px;
    line-height: 1.2;
  }

  .practice-lesson-card p {
    margin: 0;
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.35;
  }
</style>
