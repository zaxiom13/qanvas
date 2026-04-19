<script lang="ts">
  import { formatDisplayValue } from '$lib/formatting/value-format';
  import { appState } from '$lib/state/app-state.svelte';
  import { GENERAL_PRACTICE_DOCS } from '$lib/practice-challenges';
  import {
    PRACTICE_CHART,
    createPracticePanelViewModel,
    formatPracticeAxisValue,
  } from '$lib/view-models/practice-panel';

  let viewModel = $derived(
    createPracticePanelViewModel(appState.practiceChallenges, appState.activePracticeChallenge)
  );
  let neighbours = $derived(appState.activePracticeNeighbours);
  let completedCount = $derived(appState.practiceCompletedCount);
  let progressPct = $derived(
    neighbours.total > 0 ? Math.round((completedCount / neighbours.total) * 100) : 0
  );
  let challenge = $derived(viewModel.activeChallenge);
  let stepsOpen = $derived(appState.practiceStepsExpanded);
  let docs = $derived(challenge.docs ?? []);
  let steps = $derived(challenge.steps ?? []);

  let menuEl = $state<HTMLDetailsElement | null>(null);
  let referenceOpen = $state(false);
  let refLinkCount = $derived(docs.length + GENERAL_PRACTICE_DOCS.length);
  let datasetExpanded = $state<Record<string, boolean>>({});

  $effect(() => {
    void challenge.id;
    datasetExpanded = {};
  });

  function isDatasetOpen(id: string) {
    return datasetExpanded[id] ?? false;
  }

  function toggleDataset(id: string) {
    datasetExpanded = { ...datasetExpanded, [id]: !isDatasetOpen(id) };
  }

  function datasetKindLabel(kind: string) {
    return kind === 'table' ? 'Table' : 'Chart';
  }

  function closeChallengeMenu() {
    if (menuEl) menuEl.open = false;
  }

  function pickChallenge(id: string) {
    appState.setPracticeChallenge(id);
    closeChallengeMenu();
  }

  function difficultyLabel(d: string) {
    if (d === 'warmup') return 'Warmup';
    if (d === 'core') return 'Core';
    return d;
  }
</script>

<section id="practice-panel">
  <div class="practice-toolbar">
    <div class="practice-toolbar-row">
      <div class="practice-title-stack">
        <details class="practice-challenge-menu" bind:this={menuEl}>
          <summary class="practice-menu-summary">
            Practice · {neighbours.index + 1} / {neighbours.total}
            <svg class="practice-menu-chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </summary>
          <nav class="practice-picker-popover" aria-label="Choose challenge">
            {#each viewModel.challengeGroups as group}
              <div class="practice-picker-group">
                <span class="practice-picker-label">{difficultyLabel(group.difficulty)}</span>
                {#each group.challenges as pickerChallenge (pickerChallenge.id)}
                  <button
                    class="practice-picker-item"
                    class:is-active={pickerChallenge.id === appState.practiceChallengeId}
                    class:is-complete={appState.isPracticeCompleted(pickerChallenge.id)}
                    type="button"
                    onclick={() => pickChallenge(pickerChallenge.id)}
                    title={pickerChallenge.title}
                  >
                    {#if appState.isPracticeCompleted(pickerChallenge.id)}
                      <span class="practice-picker-dot" aria-hidden="true"></span>
                    {/if}
                    {pickerChallenge.title}
                  </button>
                {/each}
              </div>
            {/each}
          </nav>
        </details>
        <h2 class="practice-title">{challenge.title}</h2>
        <p class="practice-meta">
          {difficultyLabel(challenge.difficulty)}{#if challenge.topic}<span class="practice-meta-sep"> · </span>{challenge.topic}{/if}
          {#if appState.isPracticeCompleted(challenge.id)}
            <span class="practice-meta-sep"> · </span>
            <button
              type="button"
              class="practice-reset-done"
              title="Clear completion for this challenge"
              onclick={() => appState.clearPracticeComplete(challenge.id)}
            >
              Mark incomplete
            </button>
          {/if}
        </p>
      </div>
      <div class="practice-toolbar-nav">
        <button
          class="practice-nav-btn"
          type="button"
          disabled={!neighbours.previous}
          onclick={() => appState.gotoPreviousPractice()}
          title={neighbours.previous ? `Back · ${neighbours.previous.title}` : 'Beginning'}
        >
          <svg viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
          <span>Back</span>
        </button>
        <button
          class="practice-nav-btn"
          type="button"
          disabled={!neighbours.next}
          onclick={() => appState.gotoNextPractice()}
          title={neighbours.next ? `Next · ${neighbours.next.title}` : 'You are at the last challenge'}
        >
          <span>Next</span>
          <svg viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    </div>
    <div
      class="practice-progress-wide"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progressPct}
      aria-label={`Practice progress: ${completedCount} of ${neighbours.total} challenges completed`}
    >
      <div class="practice-progress-track">
        <div class="practice-progress-bar" style={`width: ${progressPct}%`}></div>
      </div>
    </div>
  </div>

  <div class="practice-scroll">
    <article class="practice-card practice-card--prompt">
      <p class="practice-define-note">Define <code>answer</code> in your script for this challenge.</p>
      <p class="practice-prompt">{challenge.prompt}</p>
      <p class="practice-hint"><span class="practice-hint-lead">Hint</span> — {challenge.hint}</p>
      <div class="practice-actions">
        {#if appState.practiceAnswerVisible}
          <button class="btn-secondary" id="btn-practice-hide-answer" type="button" onclick={() => appState.hidePracticeAnswer()}>
            Hide answer
          </button>
          <button class="btn-secondary" id="btn-practice-load-answer" type="button" onclick={() => appState.loadPracticeAnswer()}>
            Use answer
          </button>
          <button class="btn-secondary" id="btn-practice-reset" type="button" onclick={() => appState.resetPracticeStarter()}>
            Reset starter
          </button>
        {:else}
          <button class="btn-secondary" id="btn-practice-show-answer" type="button" onclick={() => appState.revealPracticeAnswer()}>
            Show answer
          </button>
          <button class="btn-secondary" type="button" onclick={() => appState.resetPracticeStarter()}>
            Reset starter
          </button>
        {/if}
      </div>
    </article>

    {#if appState.practiceAnswerVisible}
      <article class="practice-card practice-card--answer">
        <div class="practice-card-header">
          <h3>Working answer</h3>
        </div>

        <div class="practice-answer-body">
          <p class="practice-answer-copy">If you’re stuck, this is a runnable answer for the current practice. You can inspect it here or load it into the editor and verify it.</p>
          <pre class="practice-code-block">{appState.activePracticeSolution}</pre>
        </div>
      </article>
    {/if}

    {#if steps.length > 0}
      <article class="practice-card practice-card--steps">
        <button class="practice-steps-toggle" type="button" onclick={() => appState.togglePracticeSteps()} aria-expanded={stepsOpen}>
          <div>
            <h3>Think it through</h3>
            <span class="practice-steps-sub">{steps.length} steps</span>
          </div>
          <svg class="practice-chevron" class:is-open={stepsOpen} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        {#if stepsOpen}
          <ol class="practice-steps">
            {#each steps as step, index (index)}
              <li class="practice-step">
                <div class="practice-step-title">{step.title}</div>
                <p class="practice-step-body">{step.body}</p>
                {#if step.code}
                  <pre class="practice-code-block">{step.code}</pre>
                {/if}
              </li>
            {/each}
          </ol>
        {/if}
      </article>
    {/if}

    {#if docs.length > 0 || GENERAL_PRACTICE_DOCS.length > 0}
      <article class="practice-card practice-card--docs">
        <button
          class="practice-docs-toggle"
          type="button"
          onclick={() => (referenceOpen = !referenceOpen)}
          aria-expanded={referenceOpen}
        >
          <div>
            <h3>Reference</h3>
            <span class="practice-steps-sub">{refLinkCount} links · code.kx.com</span>
          </div>
          <svg class="practice-chevron" class:is-open={referenceOpen} viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        {#if referenceOpen}
          <div class="practice-docs-body">
            {#if docs.length > 0}
              <ul class="practice-docs-list">
                {#each docs as doc}
                  <li>
                    <a class="practice-doc-item" href={doc.url} target="_blank" rel="noopener noreferrer" title={doc.hint ?? doc.label}>
                      <span class="practice-doc-item-label">{doc.label}</span>
                      {#if doc.hint}
                        <span class="practice-doc-item-hint">{doc.hint}</span>
                      {/if}
                    </a>
                  </li>
                {/each}
              </ul>
            {/if}
            {#if GENERAL_PRACTICE_DOCS.length > 0}
              <ul class="practice-docs-list" class:practice-docs-list--extra={docs.length > 0}>
                {#each GENERAL_PRACTICE_DOCS as doc}
                  <li>
                    <a class="practice-doc-item" href={doc.url} target="_blank" rel="noopener noreferrer" title={doc.hint ?? doc.label}>
                      <span class="practice-doc-item-label">{doc.label}</span>
                      {#if doc.hint}
                        <span class="practice-doc-item-hint">{doc.hint}</span>
                      {/if}
                    </a>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </article>
    {/if}

    {#if viewModel.datasets.length > 0}
      <div class="practice-dataset-stack">
        {#each viewModel.datasets as dataset (dataset.id)}
          <article class="practice-card practice-card--dataset">
            <button
              class="practice-dataset-toggle"
              type="button"
              onclick={() => toggleDataset(dataset.id)}
              aria-expanded={isDatasetOpen(dataset.id)}
            >
              <div>
                <h3>{dataset.label}</h3>
                <span class="practice-steps-sub">{datasetKindLabel(dataset.kind)}</span>
              </div>
              <svg class="practice-chevron" class:is-open={isDatasetOpen(dataset.id)} viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            {#if isDatasetOpen(dataset.id)}
              {#if dataset.kind === 'table'}
                <div class="practice-table-wrap">
                  <table class="practice-table">
                    <thead>
                      <tr>
                        {#each dataset.columns as column}
                          <th>{column}</th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody>
                      {#each dataset.rows as row}
                        <tr>
                          {#each dataset.columns as column}
                            <td>{row[column]}</td>
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <div class="practice-chart-wrap">
                  <svg viewBox="0 0 320 160" class="practice-chart" aria-label={dataset.label}>
                    <text class="practice-chart-axis-label" x={PRACTICE_CHART.left - 4} y={PRACTICE_CHART.top + 4} text-anchor="end">{formatPracticeAxisValue(dataset.chart.yMax)}</text>
                    <text class="practice-chart-axis-label" x={PRACTICE_CHART.left - 4} y={(PRACTICE_CHART.top + PRACTICE_CHART.bottom) / 2 + 4} text-anchor="end">{formatPracticeAxisValue(dataset.chart.yMid)}</text>
                    <text class="practice-chart-axis-label" x={PRACTICE_CHART.left - 4} y={PRACTICE_CHART.bottom + 4} text-anchor="end">{formatPracticeAxisValue(dataset.chart.yMin)}</text>

                    <path
                      class="practice-chart-grid"
                      d={dataset.chart.gridPath}
                    />

                    <path
                      class="practice-chart-grid"
                      d={`M ${PRACTICE_CHART.left} ${PRACTICE_CHART.top} V ${PRACTICE_CHART.bottom}`}
                      stroke-dasharray="none"
                    />

                    {#if dataset.chartType === 'bar'}
                      {#each dataset.chart.bars as bar}
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={dataset.chart.barWidth}
                          height={bar.height}
                          class="practice-chart-bar"
                        />
                      {/each}
                    {:else}
                      <path class="practice-chart-line" d={dataset.chart.linePath} />
                      {#each dataset.chart.dots as dot}
                        <circle cx={dot.cx} cy={dot.cy} r="4" class="practice-chart-dot" />
                      {/each}
                    {/if}

                    {#each dataset.chart.labels as label}
                      <text
                        class="practice-chart-axis-label"
                        x={label.x}
                        y="150"
                        text-anchor="middle"
                      >{label.value}</text>
                    {/each}
                  </svg>
                </div>
              {/if}
            {/if}
          </article>
        {/each}
      </div>
    {/if}

    {#if appState.practiceVerification}
      <article class="practice-card practice-card--verification practice-card--verification--{appState.practiceVerification.status}">
        <div class="practice-card-header">
          <h3>Verification</h3>
          <span class={`practice-status practice-status--${appState.practiceVerification.status}`}>
            {appState.practiceVerification.status}
          </span>
        </div>

        <p class="practice-verification-copy">{appState.practiceVerification.message}</p>

        <div class="practice-compare-grid">
          <div class="practice-compare-card">
            <div class="practice-compare-label">Your output</div>
            <pre>{formatDisplayValue(appState.practiceVerification.actual)}</pre>
          </div>
          <div class="practice-compare-card">
            <div class="practice-compare-label">{challenge.answerLabel}</div>
            <pre>{formatDisplayValue(appState.practiceVerification.expected)}</pre>
          </div>
        </div>

        {#if appState.practiceVerification.status === 'match' && neighbours.next}
          <p class="practice-verification-continue">
            Nice work. Use <strong>Next</strong> above when you’re ready for <strong>{neighbours.next.title}</strong>.
          </p>
        {/if}
      </article>
    {/if}
  </div>
</section>
