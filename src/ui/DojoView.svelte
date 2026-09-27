<script lang="ts">
  import { onMount, tick } from "svelte";
  import { app } from "../lib/app.svelte";
  import { DOJO, PROBLEMS, PROBLEM_BY_ID } from "../content/dojo";
  import { getProgress } from "../lib/storage";
  import type { Explained } from "../lib/explain";
  import ChallengeCell from "./ChallengeCell.svelte";
  import Stage from "./Stage.svelte";
  import { ArrowLeft, ArrowRight, CircleCheck, Target } from "./icons";

  let { mobile }: { mobile: boolean } = $props();

  let done = $state<Record<string, number>>({});
  let stage = $state<Stage>();
  let pane = $state<HTMLElement>();

  const problem = $derived(PROBLEM_BY_ID.get(decodeURIComponent(app.route.parts.join("/"))));
  const idx = $derived(problem ? PROBLEMS.indexOf(problem) : -1);
  const next = $derived(idx >= 0 && idx < PROBLEMS.length - 1 ? PROBLEMS[idx + 1] : undefined);
  const prev = $derived(idx > 0 ? PROBLEMS[idx - 1] : undefined);
  const visual = $derived(problem?.set === "drawing");
  const solvedCount = $derived(PROBLEMS.filter((p) => done[p.id]).length);

  onMount(async () => {
    done = { ...(await getProgress()).done };
  });

  $effect(() => {
    if (!problem) return;
    tick().then(() => {
      pane?.scrollTo({ top: 0 });
      if (visual) stage?.run("background 21 20 29");
    });
  });

  async function runSketch(code: string): Promise<Explained | null> {
    if (visual && stage) return stage.run(code);
    return null;
  }

  function open(id: string) {
    app.go(`dojo/${id}`);
  }

  const levelLabel = (l: string) => (l === "warmup" ? "warm-up" : l || "core");
</script>

<div class="dojo" class:mobile class:has-problem={!!problem}>
  {#if !mobile || !problem}
    <nav class="list scroll" aria-label="Problems">
      <header>
        <h1><Target size={22} /> Dojo</h1>
        <p>Short, sharp problems. Each one checks your answer the moment you press Check.</p>
        <div class="meter"><span style:width="{(100 * solvedCount) / PROBLEMS.length}%"></span></div>
        <p class="count">{solvedCount} of {PROBLEMS.length} solved</p>
      </header>
      {#each DOJO as set (set.id)}
        <h2>{set.title}</h2>
        {#each set.problems as p (p.id)}
          <button class="item" class:on={problem?.id === p.id} class:done={!!done[p.id]} onclick={() => open(p.id)}>
            <span class="dot">{#if done[p.id]}<CircleCheck size={15} />{:else}{p.n}{/if}</span>
            <span class="t">{p.title}</span>
            <span class="lvl lvl-{p.level || 'core'}">{levelLabel(p.level)}</span>
          </button>
        {/each}
      {/each}
    </nav>
  {/if}

  {#if problem}
    <section class="work scroll" bind:this={pane}>
      <div class="inner">
        {#if mobile}<button class="back btn ghost sm" onclick={() => app.go("dojo")}><ArrowLeft size={15} /> All problems</button>{/if}
        <p class="crumb">{DOJO.find((s) => s.id === problem.set)?.title} · {levelLabel(problem.level)}</p>
        <h1>{problem.title}</h1>
        {#key problem.id}
          <ChallengeCell
            id={problem.id}
            goal={problem.goal}
            starter={problem.starter}
            checks={problem.checks}
            hints={problem.hints}
            solution={problem.solution}
            show={problem.show}
            badge="Problem"
            {runSketch}
            onSolved={() => (done = { ...done, [problem.id]: Date.now() })}
          />
        {/key}
        <footer>
          {#if prev}<button class="btn" onclick={() => open(prev.id)}><ArrowLeft size={15} /> {prev.title}</button>{:else}<span></span>{/if}
          {#if next}<button class="btn primary" onclick={() => open(next.id)}>{next.title} <ArrowRight size={15} /></button>{/if}
        </footer>
      </div>
    </section>
    {#if visual}
      <aside class="stagewrap">
        <Stage bind:this={stage} name={problem.title} compact />
      </aside>
    {/if}
  {:else if !mobile}
    <section class="empty">
      <div>
        <Target size={40} />
        <h2>Pick a problem</h2>
        <p>Start with a warm-up, or jump to the drawing puzzles.</p>
        <button class="btn primary" onclick={() => open((PROBLEMS.find((p) => !done[p.id]) ?? PROBLEMS[0]).id)}>
          Next unsolved <ArrowRight size={15} />
        </button>
      </div>
    </section>
  {/if}
</div>

<style>
  .dojo {
    height: 100%;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    min-height: 0;
  }
  .dojo:has(.stagewrap) {
    grid-template-columns: 300px minmax(0, 1fr) minmax(300px, 420px);
  }
  .dojo.mobile {
    grid-template-columns: 1fr;
  }
  .dojo.mobile:has(.stagewrap) {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) 42vh;
  }
  .list {
    border-right: 1px solid var(--line);
    background: var(--surface);
    padding: 18px 12px 40px;
    min-height: 0;
  }
  .mobile .list {
    border: none;
  }
  header {
    padding: 0 6px 6px;
  }
  header h1 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 24px;
    margin: 0 0 6px;
  }
  header p {
    color: var(--text-2);
    font-size: 13.5px;
    margin: 0 0 10px;
    line-height: 1.45;
  }
  .meter {
    height: 4px;
    border-radius: 4px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .meter span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--good), var(--accent));
  }
  .count {
    font-size: 12px !important;
    color: var(--text-3) !important;
    margin-top: 6px !important;
  }
  h2 {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    margin: 18px 8px 6px;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    border: none;
    background: none;
    padding: 7px 8px;
    border-radius: 9px;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
  }
  .item:hover {
    background: var(--surface-2);
  }
  .item.on {
    background: var(--accent-soft);
  }
  .dot {
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10.5px;
    font-weight: 700;
    background: var(--surface-2);
    border: 1px solid var(--line);
    color: var(--text-2);
  }
  .done .dot {
    color: var(--good);
    background: var(--good-soft);
    border-color: transparent;
  }
  .t {
    flex: 1;
    font-weight: 550;
  }
  .lvl {
    font-size: 10.5px;
    font-weight: 650;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text-3);
  }
  .lvl-warmup {
    color: var(--good);
  }
  .lvl-core {
    color: var(--accent);
  }
  .work {
    min-height: 0;
  }
  .inner {
    max-width: 760px;
    margin: 0 auto;
    padding: 28px 26px 60px;
  }
  .mobile .inner {
    padding: 14px 14px 40px;
  }
  .back {
    margin-bottom: 8px;
  }
  .crumb {
    font-size: 12px;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--accent);
    margin: 0 0 4px;
  }
  .inner h1 {
    margin: 0 0 4px;
    font-size: 30px;
    letter-spacing: -0.02em;
  }
  footer {
    display: flex;
    justify-content: space-between;
    margin-top: 28px;
    gap: 8px;
    flex-wrap: wrap;
  }
  .stagewrap {
    border-left: 1px solid var(--line);
    padding: 12px;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .mobile .stagewrap {
    border-left: none;
    border-top: 1px solid var(--line);
  }
  .empty {
    display: grid;
    place-items: center;
    text-align: center;
    color: var(--text-2);
  }
  .empty h2 {
    all: unset;
    display: block;
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    margin: 10px 0 4px;
  }
  .empty p {
    margin: 0 0 16px;
  }
</style>
