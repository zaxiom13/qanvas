<script lang="ts">
  import { REFERENCE_ROWS, runReferenceRow, type ReferenceRow } from '$lib/reference-catalog';

  type RunState = {
    status: 'pass' | 'fail' | 'error';
    actual: string;
  };

  let query = $state('');
  let kind = $state<'all' | 'primitive' | 'test'>('all');
  let runningAll = $state(false);
  let results = $state<Record<string, RunState>>({});

  let filteredRows = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    return REFERENCE_ROWS.filter((row) => {
      if (kind !== 'all' && row.kind !== kind) return false;
      if (!needle) return true;
      return [row.name, row.expression, row.description, row.group].some((value) =>
        value.toLowerCase().includes(needle)
      );
    });
  });

  let passCount = $derived(Object.values(results).filter((result) => result.status === 'pass').length);
  let failCount = $derived(Object.values(results).filter((result) => result.status !== 'pass').length);
  let primitiveCount = $derived(REFERENCE_ROWS.filter((row) => row.kind === 'primitive').length);
  let testCount = $derived(REFERENCE_ROWS.filter((row) => row.kind === 'test').length);
  let groupCount = $derived(new Set(REFERENCE_ROWS.map((row) => row.group)).size);
  let verifiedPercent = $derived(REFERENCE_ROWS.length === 0 ? 0 : Math.round((passCount / REFERENCE_ROWS.length) * 100));

  function runRow(row: ReferenceRow) {
    const result = runReferenceRow(row);
    results = { ...results, [row.id]: result };
  }

  async function runAll() {
    runningAll = true;
    const next: Record<string, RunState> = { ...results };
    for (const row of filteredRows) {
      await Promise.resolve();
      next[row.id] = runReferenceRow(row);
      results = { ...next };
    }
    runningAll = false;
  }
</script>

<section id="reference-panel">
  <header class="reference-header">
    <div class="reference-heading">
      <p class="reference-kicker">q-engine reference</p>
      <h2>Primitives and parity checks</h2>
      <p class="reference-subtitle">
        A runnable map of the interpreter surface, wired through the same engine the canvas uses.
      </p>
    </div>
    <div class="reference-summary" aria-label="Reference run summary">
      <span><strong>{REFERENCE_ROWS.length}</strong> rows</span>
      <span><strong>{primitiveCount}</strong> primitives</span>
      <span><strong>{testCount}</strong> tests</span>
      <span><strong>{groupCount}</strong> groups</span>
      <span class:reference-summary--pass={passCount > 0}><strong>{verifiedPercent}%</strong> verified</span>
      <span class:reference-summary--warn={failCount > 0}><strong>{failCount}</strong> attention</span>
    </div>
  </header>

  <div class="reference-controls">
    <label class="reference-search">
      <span>Search</span>
      <input bind:value={query} placeholder="mavg, deltas, qsql, cast..." />
    </label>
    <div class="reference-segments" role="group" aria-label="Reference filter">
      <button type="button" class:is-active={kind === 'all'} onclick={() => (kind = 'all')}>All</button>
      <button type="button" class:is-active={kind === 'primitive'} onclick={() => (kind = 'primitive')}>Primitives</button>
      <button type="button" class:is-active={kind === 'test'} onclick={() => (kind = 'test')}>Tests</button>
    </div>
    <button class="reference-run-all" type="button" disabled={runningAll || filteredRows.length === 0} onclick={() => void runAll()}>
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M5.5 3.5v9l7-4.5-7-4.5z" fill="currentColor" />
      </svg>
      Run visible
    </button>
  </div>

  <div class="reference-meter" aria-label="Reference filter and verification status">
    <div>
      <strong>{filteredRows.length}</strong>
      <span>visible {kind === 'all' ? 'rows' : kind}</span>
    </div>
    <div>
      <strong>{passCount}</strong>
      <span>verified this session</span>
    </div>
    <div>
      <strong>{query.trim() ? 'filtered' : 'complete'}</strong>
      <span>{query.trim() || 'catalog ready'}</span>
    </div>
    <div class="reference-meter-bar" aria-hidden="true">
      <span style={`width:${verifiedPercent}%`}></span>
    </div>
  </div>

  <div class="reference-list" aria-live="polite">
    {#if filteredRows.length === 0}
      <div class="reference-empty">
        <span aria-hidden="true">?</span>
        <h3>No reference rows match</h3>
        <p>Try a primitive name, output shape, or group like table, cast, temporal, adverb, or qsql.</p>
      </div>
    {/if}
    {#each filteredRows as row, index (row.id)}
      {@const result = results[row.id]}
      <article
        class="reference-row"
        class:reference-row--test={row.kind === 'test'}
        class:reference-row--pass={result?.status === 'pass'}
        class:reference-row--fail={result && result.status !== 'pass'}
        style={`--row-index:${index % 7}`}
      >
        <div class="reference-row-main">
          <div class="reference-row-title">
            <span class="reference-kind">{row.kind}</span>
            <h3>{row.name}</h3>
            <span class="reference-group">{row.group}</span>
          </div>
          <p>{row.description}</p>
          <pre class="reference-code">{row.expression}</pre>
        </div>
        <div class="reference-row-side">
          <button type="button" class="reference-run" onclick={() => runRow(row)}>
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5.5 3.5v9l7-4.5-7-4.5z" fill="currentColor" />
            </svg>
            Run
          </button>
          <div class="reference-output">
            <small>Expected</small>
            <pre>{row.expected}</pre>
          </div>
          {#if result}
            <div class="reference-output reference-output--{result.status}">
              <small>{result.status === 'pass' ? 'Verified' : 'Actual'}</small>
              <pre>{result.actual}</pre>
            </div>
          {/if}
        </div>
      </article>
    {/each}
  </div>
</section>

<style>
  #reference-panel {
    --reference-ink: #211c18;
    --reference-copper: #a45f38;
    --reference-moss: #4f7f55;
    --reference-rose: #c24f69;
    --reference-indigo: var(--accent);
    --reference-paper: #fffaf0;
    --reference-veil: rgba(255, 250, 240, 0.74);
    display: flex;
    min-width: 0;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    border-left: 1px solid var(--border);
    background:
      linear-gradient(90deg, rgba(76, 99, 214, 0.08) 1px, transparent 1px) 0 0 / 32px 32px,
      linear-gradient(0deg, rgba(164, 95, 56, 0.07) 1px, transparent 1px) 0 0 / 32px 32px,
      radial-gradient(circle at 20% -10%, rgba(76, 99, 214, 0.16), transparent 34%),
      radial-gradient(circle at 88% 8%, rgba(194, 79, 105, 0.12), transparent 30%),
      linear-gradient(135deg, #fffaf0 0%, #f2eadc 52%, #f8f0e2 100%);
    color: var(--text-primary);
  }

  .reference-header {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    padding: 24px 26px 20px;
    border-bottom: 1px solid var(--border);
    background:
      linear-gradient(120deg, rgba(35, 32, 28, 0.92), rgba(50, 69, 159, 0.76)),
      repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.09) 0 1px, transparent 1px 14px);
    color: #fffaf0;
  }

  .reference-header::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(135deg, transparent 0 42%, rgba(255, 250, 240, 0.14) 42% 43%, transparent 43% 100%),
      repeating-linear-gradient(135deg, transparent 0 13px, rgba(255, 250, 240, 0.08) 13px 14px);
    opacity: 0.8;
    pointer-events: none;
  }

  .reference-heading,
  .reference-summary {
    position: relative;
    z-index: 1;
  }

  .reference-heading {
    max-width: 620px;
  }

  .reference-kicker,
  .reference-row p,
  .reference-output small,
  .reference-search span,
  .reference-group,
  .reference-summary {
    color: var(--text-secondary);
  }

  .reference-kicker {
    margin: 0 0 7px;
    color: #f7c672;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .reference-header h2 {
    margin: 0;
    color: #fffaf0;
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 680;
    letter-spacing: 0;
    line-height: 1;
  }

  .reference-subtitle {
    max-width: 560px;
    margin: 10px 0 0;
    color: rgba(255, 250, 240, 0.82);
    font-size: 13px;
    line-height: 1.45;
  }

  .reference-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(98px, max-content));
    justify-content: flex-end;
    gap: 8px;
    color: rgba(255, 250, 240, 0.78);
    font-size: 12px;
  }

  .reference-summary span {
    display: grid;
    gap: 1px;
    min-height: 48px;
    border: 1px solid rgba(255, 250, 240, 0.24);
    border-radius: 8px;
    padding: 7px 9px;
    background: rgba(255, 250, 240, 0.08);
    box-shadow: inset 0 1px 0 rgba(255, 250, 240, 0.12);
  }

  .reference-summary strong {
    color: #fffaf0;
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1;
  }

  .reference-summary span.reference-summary--pass {
    border-color: rgba(111, 191, 127, 0.56);
  }

  .reference-summary span.reference-summary--warn {
    border-color: rgba(247, 198, 114, 0.64);
  }

  .reference-controls {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) auto auto;
    gap: 10px;
    align-items: end;
    padding: 14px 26px;
    border-bottom: 1px solid var(--border);
    background:
      linear-gradient(90deg, rgba(255, 250, 240, 0.88), rgba(241, 236, 227, 0.92)),
      repeating-linear-gradient(90deg, rgba(76, 99, 214, 0.08) 0 1px, transparent 1px 18px);
  }

  .reference-search {
    display: grid;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .reference-search input {
    min-width: 0;
    height: 38px;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0 12px;
    background: var(--reference-paper);
    color: var(--text-primary);
    font: inherit;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45), var(--shadow-sm);
    transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
  }

  .reference-search input:focus {
    border-color: var(--reference-indigo);
    outline: none;
    background: #fffdf7;
    box-shadow: 0 0 0 3px rgba(76, 99, 214, 0.13), inset 0 0 0 1px #fff;
  }

  .reference-segments {
    display: flex;
    gap: 5px;
    padding: 4px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(255, 250, 240, 0.82);
    box-shadow: var(--shadow-sm);
  }

  .reference-segments button,
  .reference-run,
  .reference-run-all {
    height: 36px;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 0 11px;
    color: var(--text-primary);
    background: transparent;
    font: inherit;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
  }

  .reference-segments button.is-active {
    border-color: rgba(76, 99, 214, 0.28);
    background: #22203a;
    color: #fffaf0;
    box-shadow: inset 0 -2px 0 #f7c672;
  }

  .reference-run,
  .reference-run-all {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-color: rgba(35, 32, 28, 0.18);
    background:
      linear-gradient(135deg, #4c63d6, #32459f 68%, #a45f38);
    color: #fffaf0;
    box-shadow: 0 8px 18px rgba(50, 69, 159, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.18);
    white-space: nowrap;
    transition: transform var(--transition), box-shadow var(--transition), filter var(--transition);
  }

  .reference-run:hover,
  .reference-run-all:hover:not(:disabled) {
    filter: saturate(1.08);
    transform: translateY(-1px);
    box-shadow: 0 12px 22px rgba(50, 69, 159, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  }

  .reference-run svg,
  .reference-run-all svg {
    width: 14px;
    height: 14px;
  }

  .reference-run-all:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .reference-meter {
    display: grid;
    grid-template-columns: minmax(90px, 0.8fr) minmax(120px, 1fr) minmax(160px, 1.4fr) minmax(160px, 2fr);
    gap: 1px;
    border-bottom: 1px solid var(--border);
    background: var(--border);
  }

  .reference-meter > div {
    display: grid;
    align-content: center;
    min-height: 50px;
    padding: 8px 26px;
    background: rgba(255, 250, 240, 0.72);
  }

  .reference-meter strong {
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1;
    color: var(--reference-ink);
  }

  .reference-meter span {
    overflow: hidden;
    color: var(--text-secondary);
    font-size: 11px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .reference-meter .reference-meter-bar {
    position: relative;
    display: block;
    padding: 0;
    background:
      repeating-linear-gradient(90deg, rgba(35, 32, 28, 0.08) 0 1px, transparent 1px 12px),
      rgba(255, 250, 240, 0.74);
  }

  .reference-meter-bar span {
    position: absolute;
    inset: 0 auto 0 0;
    min-width: 2px;
    background:
      linear-gradient(90deg, rgba(79, 127, 85, 0.86), rgba(76, 99, 214, 0.76)),
      repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.18) 0 4px, transparent 4px 8px);
  }

  .reference-list {
    display: grid;
    gap: 12px;
    overflow: auto;
    padding: 18px 26px 28px;
  }

  .reference-row {
    --stripe: color-mix(in srgb, var(--reference-indigo) calc(12% + var(--row-index) * 1%), transparent);
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 34%);
    gap: 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 15px;
    background:
      linear-gradient(90deg, var(--stripe), transparent 18%),
      linear-gradient(180deg, rgba(255, 250, 240, 0.92), rgba(246, 242, 235, 0.86));
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition), border-color var(--transition), box-shadow var(--transition);
  }

  .reference-row::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 5px;
    background: linear-gradient(180deg, var(--reference-indigo), var(--reference-copper));
  }

  .reference-row:hover {
    border-color: var(--border-hard);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  .reference-row--test {
    background:
      linear-gradient(90deg, rgba(164, 95, 56, 0.14), transparent 20%),
      linear-gradient(180deg, rgba(255, 250, 240, 0.94), rgba(246, 242, 235, 0.88));
  }

  .reference-row--pass::before {
    background: linear-gradient(180deg, var(--reference-moss), var(--reference-indigo));
  }

  .reference-row--fail::before {
    background: linear-gradient(180deg, var(--reference-rose), var(--reference-copper));
  }

  .reference-row-title {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .reference-row-title h3 {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 17px;
    line-height: 1.15;
  }

  .reference-kind {
    border: 1px solid rgba(76, 99, 214, 0.28);
    border-radius: 6px;
    padding: 3px 7px;
    color: var(--reference-indigo);
    background: rgba(76, 99, 214, 0.08);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .reference-group {
    border-bottom: 1px solid color-mix(in srgb, var(--reference-copper), transparent 52%);
    color: var(--reference-copper);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .reference-row p {
    margin: 8px 0 10px;
    max-width: 72ch;
    line-height: 1.45;
  }

  .reference-code,
  .reference-output pre {
    overflow: auto;
    margin: 0;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
  }

  .reference-code {
    position: relative;
    border: 1px solid color-mix(in srgb, var(--border), #23201c 10%);
    padding: 10px 11px;
    background:
      linear-gradient(90deg, rgba(76, 99, 214, 0.11), transparent 14%),
      #27231f;
    color: #f8ead3;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .reference-row-side {
    display: grid;
    align-content: start;
    gap: 8px;
  }

  .reference-output {
    border: 1px solid color-mix(in srgb, var(--border), #23201c 8%);
    border-radius: 7px;
    padding: 9px;
    background: rgba(255, 250, 240, 0.78);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.44);
  }

  .reference-output--pass {
    border-color: color-mix(in srgb, #3aa66a, var(--border) 35%);
    background: color-mix(in srgb, #e8f5df, var(--reference-paper) 65%);
  }

  .reference-output--fail,
  .reference-output--error {
    border-color: color-mix(in srgb, #d14f4f, var(--border) 25%);
    background: color-mix(in srgb, #f9e0df, var(--reference-paper) 58%);
  }

  .reference-output small {
    display: block;
    margin-bottom: 5px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .reference-output pre {
    max-height: 162px;
  }

  .reference-empty {
    display: grid;
    justify-items: center;
    gap: 8px;
    min-height: 220px;
    align-content: center;
    border: 1px dashed color-mix(in srgb, var(--reference-indigo), var(--border) 44%);
    border-radius: 8px;
    background: rgba(255, 250, 240, 0.68);
    color: var(--text-secondary);
    text-align: center;
  }

  .reference-empty span {
    display: grid;
    width: 44px;
    height: 44px;
    place-items: center;
    border: 1px solid rgba(76, 99, 214, 0.28);
    border-radius: 8px;
    color: var(--reference-indigo);
    font-family: var(--font-display);
    font-size: 28px;
    background: rgba(76, 99, 214, 0.08);
  }

  .reference-empty h3 {
    margin: 0;
    color: var(--text-primary);
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 650;
  }

  .reference-empty p {
    max-width: 420px;
    margin: 0;
    line-height: 1.45;
  }

  @media (max-width: 980px) {
    .reference-controls,
    .reference-row,
    .reference-meter {
      grid-template-columns: 1fr;
    }

    .reference-header {
      display: grid;
    }

    .reference-summary {
      justify-content: stretch;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .reference-segments,
    .reference-run-all {
      width: 100%;
    }

    .reference-meter > div {
      padding: 8px 20px;
    }
  }
</style>
