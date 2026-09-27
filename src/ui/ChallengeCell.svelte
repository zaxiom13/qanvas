<script lang="ts">
  import { onMount } from "svelte";
  import { checkCode, offscreenCtx, type CheckOutcome } from "../lib/checker";
  import type { Explained } from "../lib/explain";
  import { getProgress, markDone, saveAnswer } from "../lib/storage";
  import CodeEditor from "./CodeEditor.svelte";
  import ErrorCard from "./ErrorCard.svelte";
  import { Check, CircleCheck, CircleX, Eye, Lightbulb, RotateCcw, Target } from "./icons";

  interface Props {
    id: string;
    goal: string;
    starter: string;
    checks: { expr: string; msg: string }[];
    hints: string[];
    solution: string;
    runSketch: (src: string) => Promise<Explained | null>;
    onSolved?: () => void;
  }
  let { id, goal, starter, checks, hints, solution, runSketch, onSolved }: Props = $props();

  let code = $state(starter);
  let outcome = $state<CheckOutcome | null>(null);
  let shownHints = $state(0);
  let showSolution = $state(false);
  let solved = $state(false);
  let checking = $state(false);
  let saveTimer: ReturnType<typeof setTimeout>;

  onMount(async () => {
    const p = await getProgress();
    if (p.code[id]) code = p.code[id];
    if (p.done[id]) solved = true;
  });

  function edit(v: string) {
    code = v;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveAnswer(id, v), 600);
  }

  async function check() {
    checking = true;
    const visErr = await runSketch(code);
    outcome = visErr ? { ok: false, runError: visErr, results: [] } : checkCode(code, checks, offscreenCtx());
    checking = false;
    if (outcome.ok) {
      const first = !solved;
      solved = true;
      await markDone(id);
      if (first) onSolved?.();
    }
  }

  function reset() {
    code = starter;
    outcome = null;
    saveAnswer(id, starter);
  }
</script>

<section class="challenge" class:solved aria-label="Challenge">
  <header>
    <span class="badge"><Target size={15} /> Your turn</span>
    {#if solved}<span class="done"><CircleCheck size={15} /> solved</span>{/if}
  </header>
  <p class="goal">{goal}</p>
  <div class="ed">
    <CodeEditor value={code} onChange={edit} onRun={check} compact label="Challenge code" />
  </div>
  <div class="bar">
    <button class="btn primary" onclick={check} disabled={checking}><Check size={16} /> {checking ? "Checking…" : "Check"}</button>
    {#if hints.length && shownHints < hints.length}
      <button class="btn ghost" onclick={() => shownHints++}><Lightbulb size={15} /> {shownHints ? "Another hint" : "Hint"}</button>
    {/if}
    <button class="btn ghost" onclick={() => (showSolution = !showSolution)}><Eye size={15} /> {showSolution ? "Hide" : "Show"} solution</button>
    <button class="btn ghost icon" onclick={reset} title="Start over" aria-label="Reset challenge"><RotateCcw size={15} /></button>
  </div>

  {#if shownHints}
    <ul class="hints">
      {#each hints.slice(0, shownHints) as h, i (i)}<li><Lightbulb size={14} /> {h}</li>{/each}
    </ul>
  {/if}

  {#if outcome}
    <div class="result" class:ok={outcome.ok}>
      {#if outcome.runError}
        <ErrorCard e={outcome.runError} compact />
      {:else if outcome.ok}
        <div class="win">
          <span class="burst" aria-hidden="true">{#each Array(10) as _, i (i)}<i style:--i={i}></i>{/each}</span>
          <CircleCheck size={20} /> <strong>Nailed it.</strong> Every check passes.
        </div>
      {:else}
        <ul class="checks">
          {#each outcome.results as r, i (i)}
            <li class:pass={r.pass}>
              {#if r.pass}<CircleCheck size={15} />{:else}<CircleX size={15} />{/if}
              <span>{r.pass ? r.msg.replace(/^(Draw|Make|Give|Put|Use)\b/, "✓ $1") : r.msg}{#if r.error}<small> ({r.error})</small>{/if}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}

  {#if showSolution}
    <div class="solution">
      <div class="label">One way to do it</div>
      <CodeEditor value={solution} compact readOnly label="Solution" />
      <button class="btn sm" onclick={() => edit(solution)}>Use this</button>
    </div>
  {/if}
</section>

<style>
  .challenge {
    margin: 28px 0 8px;
    border: 1.5px solid color-mix(in srgb, var(--accent) 45%, var(--line));
    border-radius: 18px;
    padding: 16px;
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface));
    position: relative;
  }
  .challenge.solved {
    border-color: color-mix(in srgb, var(--good) 55%, var(--line));
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    font-size: 12.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
  }
  .done {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--good);
    font-weight: 650;
    font-size: 13px;
  }
  .goal {
    font-size: 16px;
    font-weight: 550;
    margin: 8px 0 12px;
    line-height: 1.45;
  }
  .ed {
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: var(--code-bg);
  }
  .bar {
    display: flex;
    gap: 6px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .hints {
    list-style: none;
    padding: 0;
    margin: 12px 0 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .hints li {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 14px;
    color: var(--text-2);
    animation: fadeIn 260ms var(--ease);
  }
  .hints :global(svg) {
    flex: none;
    margin-top: 3px;
    color: var(--warn);
  }
  .result {
    margin-top: 12px;
  }
  .checks {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .checks li {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 14px;
    color: var(--bad);
  }
  .checks li.pass {
    color: var(--good);
  }
  .checks :global(svg) {
    flex: none;
    margin-top: 3px;
  }
  .checks small {
    color: var(--text-3);
  }
  .win {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--good-soft);
    color: var(--good);
    font-size: 15px;
    animation: pop 420ms var(--ease-spring);
  }
  .win strong {
    color: var(--text);
  }
  .burst {
    position: absolute;
    left: 24px;
    top: 50%;
    pointer-events: none;
  }
  .burst i {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: hsl(calc(var(--i) * 36), 85%, 60%);
    animation: burst 700ms var(--ease) forwards;
    transform: rotate(calc(var(--i) * 36deg)) translateX(0);
  }
  @keyframes burst {
    to { transform: rotate(calc(var(--i) * 36deg)) translateX(46px); opacity: 0; }
  }
  @keyframes pop {
    from { transform: scale(0.96); opacity: 0; }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-3px); }
  }
  .solution {
    margin-top: 12px;
    border-top: 1px dashed var(--line);
    padding-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  .solution :global(.editor) {
    width: 100%;
    border: 1px solid var(--line);
    border-radius: 10px;
    overflow: hidden;
  }
  .label {
    font-size: 12px;
    font-weight: 650;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
</style>
