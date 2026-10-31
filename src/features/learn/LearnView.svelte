<script lang="ts">
  import { onMount, tick } from "svelte";
  import { app } from "../../app/state.svelte";
  import { CHAPTERS, LESSONS, LESSON_BY_ID, type Lesson } from "../../content/lessons";
  import { getProgress, markDone } from "../../adapters/browser/persistence";
  import type { Explained } from "../../presentation/explain";
  import LessonCell from "./LessonCell.svelte";
  import ChallengeCell from "./ChallengeCell.svelte";
  import Stage from "../../ui/Stage.svelte";
  import { runHeadless } from "../../runtime/headless";
  import { buzz } from "../../ui/haptics";
  import { ArrowLeft, ArrowRight, Check, ChevronDown, Palette, Route, Sparkles, X } from "../../ui/icons";

  let { mobile }: { mobile: boolean } = $props();

  // Each chapter is a line on the map, in its own colour.
  const LINE_COLOURS = ["#ff5a1f", "#ffce00", "#00b25d", "#0098d8", "#c4127a", "#f49ac1", "#9aa0a6", "#4f6bff", "#c07a14", "#00b3a1"];
  const lineOf = (chapter: string) => LINE_COLOURS[Math.max(0, CHAPTERS.findIndex((c) => c.title === chapter)) % LINE_COLOURS.length];

  let done = $state<Record<string, number>>({});
  let stage = $state<Stage>();
  let article = $state<HTMLElement>();
  let canvasOpen = $state(false); // phone: the canvas strip at the top
  let hasDrawn = $state(false);

  const lesson = $derived<Lesson | undefined>(LESSON_BY_ID.get(app.route.parts[0] ?? ""));
  const idx = $derived(lesson ? LESSONS.indexOf(lesson) : -1);
  const prev = $derived(idx > 0 ? LESSONS[idx - 1] : undefined);
  const next = $derived(idx >= 0 && idx < LESSONS.length - 1 ? LESSONS[idx + 1] : undefined);
  const nextUp = $derived(LESSONS.find((l) => !done[l.id]) ?? LESSONS[0]);
  const doneCount = $derived(LESSONS.filter((l) => done[l.id]).length);
  const colour = $derived(lesson ? lineOf(lesson.chapter) : LINE_COLOURS[0]);

  // ---------- bites: on a phone a lesson is a short run of steps, each ending in something to run ----------
  const steps = $derived.by(() => {
    if (!lesson) return [] as number[][];
    const out: number[][] = [];
    let cur: number[] = [];
    lesson.blocks.forEach((b, i) => {
      cur.push(i);
      if (b.kind !== "html") {
        out.push(cur);
        cur = [];
      }
    });
    if (cur.length) {
      if (out.length) out[out.length - 1].push(...cur);
      else out.push(cur);
    }
    return out;
  });
  let step = $state(0);
  const stepOf = $derived.by(() => {
    const m = new Map<number, number>();
    steps.forEach((s, si) => s.forEach((b) => m.set(b, si)));
    return m;
  });
  const stepKey = (id: string) => `qanvas:step:${id}`;
  function goStep(n: number) {
    if (!lesson) return;
    step = Math.max(0, Math.min(steps.length - 1, n));
    try { localStorage.setItem(stepKey(lesson.id), String(step)); } catch { /* storage unavailable */ }
    void tick().then(() => article?.scrollTo({ top: 0 }));
  }
  function nextStep() {
    buzz(8);
    if (step < steps.length - 1) goStep(step + 1);
    else if (next) app.go(`learn/${next.id}`);
    else app.go("sketch");
  }

  onMount(async () => {
    done = { ...(await getProgress()).done };
  });

  // new lesson: reset canvas, scroll to top, resume where this lesson was left
  $effect(() => {
    const l = lesson;
    if (!l) return;
    hasDrawn = false;
    canvasOpen = false;
    let saved = 0;
    try { saved = Number(localStorage.getItem(stepKey(l.id)) ?? 0) || 0; } catch { /* storage unavailable */ }
    step = saved;
    tick().then(() => {
      article?.scrollTo({ top: 0 });
      stage?.run("background 21 20 29");
    });
  });

  async function runSketch(code: string): Promise<Explained | null> {
    if (!stage) return null;
    hasDrawn = true;
    if (mobile) canvasOpen = true;
    return stage.run(code);
  }

  // Each q cell is stateless: a fresh session that silently replays the cells above it.
  function sessionFor(i: number) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 60;
    const s = runHeadless("", { ctx: canvas.getContext("2d")!, scale: 0.1 }).session;
    for (const b of lesson!.blocks.slice(0, i)) if (b.kind === "cell" && !b.sketch) s.evaluate(b.code);
    return s;
  }
  const evaluateAt = (i: number) => (src: string) => sessionFor(i).evaluate(src);
  const traceAt = (i: number) => (src: string) => sessionFor(i).trace(src);

  async function solved() {
    if (!lesson) return;
    await markDone(lesson.id);
    done = { ...done, [lesson.id]: Date.now() };
    buzz(30);
  }

  // inline `code` in prose runs in the console
  function proseClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest("code.qi") as HTMLElement | null;
    if (!el) return;
    const q = el.dataset.q;
    if (q && q.length < 120) app.tryInConsole(q);
  }

  const chapterDone = (c: (typeof CHAPTERS)[number]) => c.lessons.filter((l) => done[l.id]).length;
  const visible = (i: number) => !mobile || stepOf.get(i) === step;
</script>

{#if !lesson}
  <div class="map scroll">
    <header class="head">
      <p class="label">the q line · {doneCount} of {LESSONS.length} stops</p>
      <h1>Learn q,<br />one stop at a time.</h1>
      <p class="lede">Thirty short lessons, from your first circle to a ray tracer. Each one ends with something to draw. Pick up wherever you left off, even offline.</p>
      <button class="btn go big" onclick={() => app.go(`learn/${nextUp.id}`)}>
        <Route size={19} /> {doneCount ? "Next stop" : "Start"}: {nextUp.title} <ArrowRight size={18} />
      </button>
    </header>

    <div class="lines">
      {#each CHAPTERS as c, ci (c.title)}
        <section class="line" style:--track={LINE_COLOURS[ci % LINE_COLOURS.length]}>
          <header>
            <span class="roundel">{ci + 1}</span>
            <h2>{c.title}</h2>
            <span class="count">{chapterDone(c)}/{c.lessons.length}</span>
          </header>
          <ol>
            {#each c.lessons as l (l.id)}
              <li>
                <button class="stop" class:done={!!done[l.id]} class:here={l.id === nextUp.id} onclick={() => app.go(`learn/${l.id}`)}>
                  <span class="station">{#if done[l.id]}<Check size={13} strokeWidth={3.5} />{/if}</span>
                  <span class="t"><b>{l.title}</b><small>{l.blurb}</small></span>
                  {#if l.id === nextUp.id}<span class="you">next stop</span>{/if}
                </button>
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  </div>
{:else}
  <div class="lesson" class:mobile style:--track={colour}>
    {#if !mobile}
      <nav class="side scroll" aria-label="Lessons">
        <button class="back" onclick={() => app.go("learn")}><Route size={15} /> Line map</button>
        {#each CHAPTERS as c, ci (c.title)}
          <div class="sc" style:--track={LINE_COLOURS[ci % LINE_COLOURS.length]}>{c.title}</div>
          <div class="sline" style:--track={LINE_COLOURS[ci % LINE_COLOURS.length]}>
            {#each c.lessons as l (l.id)}
              <button class="sl" class:on={l.id === lesson.id} class:done={!!done[l.id]} onclick={() => app.go(`learn/${l.id}`)}>
                <span class="station sm">{#if done[l.id]}<Check size={10} strokeWidth={4} />{/if}</span>{l.title}
              </button>
            {/each}
          </div>
        {/each}
      </nav>
    {/if}

    {#if mobile}
      <header class="mhead">
        <button class="btn sm ghost icon" onclick={() => app.go("learn")} aria-label="Back to the line map"><X size={20} /></button>
        <div class="mt">
          <span class="label">stop {lesson.n} · {lesson.chapter}</span>
          <b>{lesson.title}</b>
        </div>
        {#if hasDrawn}
          <button class="btn sm icon" class:on={canvasOpen} onclick={() => (canvasOpen = !canvasOpen)} aria-label={canvasOpen ? "Fold the canvas away" : "Show the canvas"}>
            {#if canvasOpen}<ChevronDown size={18} />{:else}<Sparkles size={18} />{/if}
          </button>
        {/if}
      </header>
      <div class="progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
        {#each steps as _, si (si)}<button class:past={si < step} class:now={si === step} onclick={() => goStep(si)} aria-label={`Step ${si + 1}`}></button>{/each}
      </div>
    {/if}

    <aside class="stage" class:open={!mobile || canvasOpen}>
      <Stage bind:this={stage} name={lesson?.title ?? "lesson"} compact hideToolbar={mobile} />
    </aside>

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article class="article scroll" bind:this={article} onclick={proseClick}>
      <div class="inner">
        {#if !mobile || step === 0}
          <p class="crumb label">{lesson.chapter} · stop {lesson.n}</p>
          <h1>{lesson.title}</h1>
          <p class="blurb">{lesson.blurb}</p>
        {/if}
        {#each lesson.blocks as b, i (lesson.id + i)}
          <div class="block" class:hidden={!visible(i)}>
            {#if b.kind === "html"}
              <div class="prose">{@html b.html}</div>
            {:else if b.kind === "cell"}
              <LessonCell code={b.code} sketch={b.sketch} evaluate={evaluateAt(i)} trace={traceAt(i)} {runSketch} touch={mobile} />
            {:else}
              <ChallengeCell id={b.id} goal={b.goal} starter={b.starter} checks={b.checks} hints={b.hints} solution={b.solution} {runSketch} onSolved={solved} touch={mobile} />
            {/if}
          </div>
        {/each}
        {#if !mobile}
          <footer class="pager">
            {#if prev}
              <button class="btn" onclick={() => app.go(`learn/${prev.id}`)}><ArrowLeft size={16} /> {prev.title}</button>
            {:else}<span></span>{/if}
            {#if next}
              <button class="btn go" onclick={() => app.go(`learn/${next.id}`)}>Next stop: {next.title} <ArrowRight size={16} /></button>
            {:else}
              <button class="btn primary" onclick={() => app.go("sketch")}>Go make something <Palette size={16} /></button>
            {/if}
          </footer>
        {/if}
      </div>
    </article>

    {#if mobile}
      <footer class="mnav">
        <button class="btn big" onclick={() => (step > 0 ? goStep(step - 1) : prev ? app.go(`learn/${prev.id}`) : app.go("learn"))} aria-label="Back">
          <ArrowLeft size={22} />
        </button>
        <button class="btn go big grow" onclick={nextStep}>
          {#if step < steps.length - 1}Next <span class="faintish">{step + 1}/{steps.length}</span>{:else if next}Next stop <span class="faintish">{next.title}</span>{:else}Go make something{/if}
          <ArrowRight size={20} />
        </button>
      </footer>
    {/if}
  </div>
{/if}

<style>
  /* ---------- the line map ---------- */
  .map {
    height: 100%;
    padding: 40px 40px 80px;
  }
  .head {
    max-width: 1180px;
    margin: 0 auto 34px;
  }
  .head h1 {
    font-size: clamp(38px, 5.4vw, 68px);
    margin: 8px 0 14px;
    font-weight: 700;
  }
  .lede {
    font-size: 17px;
    line-height: 1.55;
    color: var(--text-2);
    max-width: 58ch;
    margin: 0 0 22px;
  }
  .lines {
    max-width: 1180px;
    margin: 0 auto;
    columns: 3 320px;
    column-gap: 22px;
  }
  .line {
    break-inside: avoid;
    margin: 0 0 22px;
    padding: 16px 14px 10px;
    border-radius: var(--r-lg);
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .line header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .roundel {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: var(--font-code);
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    background: var(--track);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--track) 25%, transparent);
    text-shadow: 0 1px 2px #0006;
  }
  .line h2 {
    margin: 0;
    font-size: 18px;
  }
  .count {
    margin-left: auto;
    font-family: var(--font-code);
    font-size: 12px;
    color: var(--text-3);
  }
  .line ol {
    list-style: none;
    margin: 0;
    padding: 0;
    position: relative;
  }
  /* the coloured track runs through every station */
  .line ol::before {
    content: "";
    position: absolute;
    left: 15px;
    top: 18px;
    bottom: 18px;
    width: 8px;
    border-radius: 4px;
    background: var(--track);
  }
  .stop {
    position: relative;
    width: 100%;
    display: flex;
    gap: 14px;
    align-items: center;
    border: none;
    background: none;
    text-align: left;
    padding: 9px 6px 9px 6px;
    border-radius: 12px;
    cursor: pointer;
    color: var(--text);
    touch-action: manipulation;
  }
  .stop:hover {
    background: var(--surface-2);
  }
  .station {
    flex: none;
    position: relative;
    z-index: 1;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--surface);
    border: 5px solid var(--track);
    color: #fff;
  }
  .station.sm {
    width: 18px;
    height: 18px;
    border-width: 4px;
  }
  .done .station {
    background: var(--track);
    border-color: color-mix(in srgb, var(--track) 70%, #fff);
  }
  .here .station {
    animation: pulse 1.6s var(--ease) infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--track) 60%, transparent); }
    50% { box-shadow: 0 0 0 8px transparent; }
  }
  .t {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .t b {
    font-size: 15px;
    font-weight: 650;
  }
  .t small {
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.35;
    margin-top: 1px;
  }
  .you {
    flex: none;
    font-family: var(--font-code);
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 4px 8px;
    border-radius: 999px;
    background: var(--go);
    color: var(--go-text);
  }

  /* ---------- a lesson ---------- */
  .lesson {
    height: 100%;
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) minmax(340px, 460px);
    grid-template-areas: "side article stage";
    min-height: 0;
  }
  .side {
    grid-area: side;
    border-right: 1px solid var(--line);
    padding: 16px 12px 30px;
    background: var(--surface);
  }
  .back {
    display: flex;
    align-items: center;
    gap: 7px;
    border: none;
    background: none;
    color: var(--text-2);
    font-weight: 600;
    font-size: 13.5px;
    padding: 7px 8px;
    border-radius: 10px;
    cursor: pointer;
    margin-bottom: 6px;
  }
  .back:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .sc {
    font-family: var(--font-code);
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--track);
    margin: 16px 8px 4px;
  }
  .sline {
    position: relative;
  }
  .sline::before {
    content: "";
    position: absolute;
    left: 15px;
    top: 12px;
    bottom: 12px;
    width: 4px;
    border-radius: 2px;
    background: var(--track);
    opacity: 0.85;
  }
  .sl {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    border: none;
    background: none;
    text-align: left;
    padding: 5px 8px;
    border-radius: 9px;
    font-size: 13.5px;
    color: var(--text-2);
    cursor: pointer;
  }
  .sl:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .sl.on {
    background: color-mix(in srgb, var(--track) 16%, transparent);
    color: var(--text);
    font-weight: 650;
  }
  .article {
    grid-area: article;
    min-height: 0;
    height: 100%;
  }
  .inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 30px 90px;
  }
  .crumb {
    color: var(--track);
    margin: 0 0 8px;
  }
  .inner h1 {
    font-size: clamp(32px, 4vw, 46px);
    margin: 0 0 10px;
  }
  .blurb {
    font-size: 17px;
    color: var(--text-2);
    margin: 0 0 22px;
    line-height: 1.5;
  }
  .block.hidden {
    display: none;
  }
  .prose :global(p),
  .prose :global(li) {
    font-size: 16.5px;
    line-height: 1.7;
  }
  .prose :global(h2) {
    font-size: 25px;
    margin: 38px 0 8px;
  }
  .prose :global(h3) {
    font-size: 19px;
    margin: 26px 0 6px;
  }
  .prose :global(strong) {
    color: var(--text);
  }
  .prose :global(code.qi) {
    font-size: 0.88em;
    padding: 2px 6px;
    border-radius: 7px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-bottom-width: 2px;
    cursor: pointer;
    white-space: nowrap;
  }
  .prose :global(code.qi:hover) {
    border-color: var(--accent);
  }
  .prose :global(kbd) {
    font-family: var(--font-code);
    font-size: 12px;
    padding: 1px 6px;
    border-radius: 5px;
    border: 1px solid var(--line-strong);
    border-bottom-width: 2px;
    background: var(--surface);
  }
  .prose :global(table) {
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 14.5px;
    width: 100%;
  }
  .prose :global(th),
  .prose :global(td) {
    text-align: left;
    padding: 7px 10px;
    border-bottom: 1px solid var(--line);
  }
  .prose :global(th) {
    font-family: var(--font-code);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-3);
  }
  .prose :global(.callout) {
    margin: 18px 0;
    padding: 14px 16px;
    border-radius: 14px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-left: 5px solid var(--accent);
  }
  .prose :global(.callout p) {
    margin: 0;
    font-size: 15.5px;
  }
  .prose :global(.callout.headsup) {
    border-left-color: var(--warn);
  }
  .prose :global(.callout.tryit) {
    border-left-color: var(--go);
  }
  .pager {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 48px;
    padding-top: 22px;
    border-top: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .stage {
    grid-area: stage;
    border-left: 1px solid var(--line);
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: color-mix(in srgb, var(--bg) 70%, #000);
  }
  .stage :global(.stage) {
    background: transparent;
  }

  /* ---------- a lesson on a phone: canvas strip, one step, big keys ---------- */
  .lesson.mobile {
    display: flex;
    flex-direction: column;
  }
  .mhead {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px 4px;
  }
  .mt {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .mt .label {
    color: var(--track);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mt b {
    font-size: 17px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mhead .on {
    background: var(--track);
    color: #fff;
  }
  .progress {
    flex: none;
    display: flex;
    gap: 4px;
    padding: 4px 12px 8px;
  }
  .progress button {
    flex: 1;
    height: 8px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: var(--surface-3);
    touch-action: manipulation;
  }
  .progress button.past {
    background: color-mix(in srgb, var(--track) 55%, var(--surface-3));
  }
  .progress button.now {
    background: var(--track);
  }
  .mobile .stage {
    flex: none;
    height: 0;
    padding: 0 12px;
    border: none;
    background: transparent;
    overflow: hidden;
    transition: height 260ms var(--ease);
  }
  .mobile .stage.open {
    height: min(38dvh, 340px);
    padding-bottom: 8px;
  }
  .mobile .article {
    flex: 1;
  }
  .mobile .inner {
    padding: 8px 16px 28px;
  }
  .mobile .inner h1 {
    font-size: 30px;
  }
  .mobile .prose :global(p),
  .mobile .prose :global(li) {
    font-size: 17px;
    line-height: 1.6;
  }
  .mnav {
    flex: none;
    display: flex;
    gap: 10px;
    padding: 10px 12px 12px;
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  .mnav .grow {
    flex: 1;
    min-width: 0;
    justify-content: space-between;
  }
  .faintish {
    opacity: 0.6;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  @media (max-width: 1180px) and (min-width: 761px) {
    .lesson {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 400px);
      grid-template-areas: "article stage";
    }
    .side {
      display: none;
    }
  }
  @media (max-width: 760px) {
    .map {
      padding: 20px 14px 40px;
    }
    .head h1 {
      font-size: 36px;
    }
    .lede {
      font-size: 16px;
    }
    .head .btn {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
