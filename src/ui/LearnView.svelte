<script lang="ts">
  import { onMount, tick } from "svelte";
  import { app } from "../lib/app.svelte";
  import { CHAPTERS, LESSONS, LESSON_BY_ID, type Lesson } from "../content/lessons";
  import { getProgress, markDone } from "../lib/storage";
  import type { Explained } from "../lib/explain";
  import LessonCell from "./LessonCell.svelte";
  import ChallengeCell from "./ChallengeCell.svelte";
  import Stage from "./Stage.svelte";
  import HeroArt from "./HeroArt.svelte";
  import { runHeadless } from "../qanvas/headless";
  import { X, ArrowLeft, ArrowRight, CircleCheck, Compass, Maximize, Minimize, Palette, Sparkles } from "./icons";

  let { mobile }: { mobile: boolean } = $props();

  let done = $state<Record<string, number>>({});
  let stage = $state<Stage>();
  let article = $state<HTMLElement>();
  let stageOpen = $state(false); // mobile: expanded canvas
  let hasDrawn = $state(false);

  const lesson = $derived<Lesson | undefined>(LESSON_BY_ID.get(app.route.parts[0] ?? ""));
  const idx = $derived(lesson ? LESSONS.indexOf(lesson) : -1);
  const prev = $derived(idx > 0 ? LESSONS[idx - 1] : undefined);
  const next = $derived(idx >= 0 && idx < LESSONS.length - 1 ? LESSONS[idx + 1] : undefined);
  const nextUp = $derived(LESSONS.find((l) => !done[l.id]) ?? LESSONS[0]);
  const doneCount = $derived(LESSONS.filter((l) => done[l.id]).length);

  onMount(async () => {
    done = { ...(await getProgress()).done };
  });

  // new lesson: reset canvas + scroll to top
  $effect(() => {
    const l = lesson;
    if (!l) return;
    hasDrawn = false;
    stageOpen = false;
    tick().then(() => {
      article?.scrollTo({ top: 0 });
      stage?.run("background 21 20 29");
    });
  });

  let pipClosed = $state(false);
  let pipPos = $state<[number, number]>([0, 0]);
  function pipDown(e: PointerEvent) {
    const start = [e.clientX, e.clientY], from = [...pipPos];
    let moved = false;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - start[0], dy = ev.clientY - start[1];
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      if (moved) pipPos = [from[0] + dx, from[1] + dy];
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      if (!moved) stageOpen = true;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  async function runSketch(code: string): Promise<Explained | null> {
    if (!stage) return null;
    hasDrawn = true;
    pipClosed = false;
    if (mobile) stageOpen = true;
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
  }

  // inline `code` in prose runs in the console
  function proseClick(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest("code.qi") as HTMLElement | null;
    if (!el) return;
    const q = el.dataset.q;
    if (q && q.length < 120) app.tryInConsole(q);
  }

  const chapterDone = (c: (typeof CHAPTERS)[number]) => c.lessons.filter((l) => done[l.id]).length;
</script>

{#if !lesson}
  <div class="overview scroll">
    <section class="hero">
      <div class="copy">
        <p class="kicker"><Sparkles size={14} /> An array language, one drawing at a time</p>
        <h1>Learn <span class="q">q</span> by drawing.</h1>
        <p class="lede">
          q is the language behind kdb+ — terse, fast, and built on arrays. Here you'll learn it the fun way: circles,
          colours, particles, fractals, a neural network and a ray tracer. Everything runs right here in your browser, even offline.
        </p>
        <div class="cta">
          <button class="btn primary big" onclick={() => app.go(`learn/${nextUp.id}`)}>
            {doneCount ? "Continue" : "Start the journey"} <ArrowRight size={17} />
          </button>
          <button class="btn big" onclick={() => app.go("sketch")}><Palette size={17} /> Open the studio</button>
        </div>
        {#if doneCount}
          <p class="progress-line">{doneCount} of {LESSONS.length} lessons done · next: <b>{nextUp.title}</b></p>
        {/if}
      </div>
      <div class="art"><HeroArt /></div>
    </section>

    <section class="chapters">
      {#each CHAPTERS as c, ci (c.title)}
        <article class="chapter">
          <header>
            <span class="num">{String(ci + 1).padStart(2, "0")}</span>
            <h2>{c.title}</h2>
            <span class="count">{chapterDone(c)}/{c.lessons.length}</span>
          </header>
          <div class="bar"><span style:width="{(100 * chapterDone(c)) / c.lessons.length}%"></span></div>
          <ol>
            {#each c.lessons as l (l.id)}
              <li>
                <button onclick={() => app.go(`learn/${l.id}`)} class:done={!!done[l.id]}>
                  <span class="dot">{#if done[l.id]}<CircleCheck size={15} />{:else}{l.n}{/if}</span>
                  <span class="t">{l.title}<small>{l.blurb}</small></span>
                </button>
              </li>
            {/each}
          </ol>
        </article>
      {/each}
    </section>
  </div>
{:else}
  <div class="lesson" class:mobile>
    {#if !mobile}
      <nav class="side scroll" aria-label="Lessons">
        <button class="back" onclick={() => app.go("learn")}><Compass size={15} /> All lessons</button>
        {#each CHAPTERS as c (c.title)}
          <div class="sc">{c.title}</div>
          {#each c.lessons as l (l.id)}
            <button class="sl" class:on={l.id === lesson.id} class:done={!!done[l.id]} onclick={() => app.go(`learn/${l.id}`)}>
              <span class="dot">{#if done[l.id]}<CircleCheck size={13} />{:else}{l.n}{/if}</span>{l.title}
            </button>
          {/each}
        {/each}
      </nav>
    {/if}

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article class="article scroll" bind:this={article} onclick={proseClick}>
      <div class="inner">
        <p class="crumb">{lesson.chapter} · lesson {lesson.n}</p>
        <h1>{lesson.title}</h1>
        <p class="blurb">{lesson.blurb}</p>
        {#each lesson.blocks as b, i (lesson.id + i)}
          {#if b.kind === "html"}
            <div class="prose">{@html b.html}</div>
          {:else if b.kind === "cell"}
            <LessonCell code={b.code} sketch={b.sketch} evaluate={evaluateAt(i)} trace={traceAt(i)} {runSketch} />
          {:else}
            <ChallengeCell id={b.id} goal={b.goal} starter={b.starter} checks={b.checks} hints={b.hints} solution={b.solution} {runSketch} onSolved={solved} />
          {/if}
        {/each}
        <footer class="pager">
          {#if prev}
            <button class="btn" onclick={() => app.go(`learn/${prev.id}`)}><ArrowLeft size={16} /> {prev.title}</button>
          {:else}<span></span>{/if}
          {#if next}
            <button class="btn primary" onclick={() => app.go(`learn/${next.id}`)}>{next.title} <ArrowRight size={16} /></button>
          {:else}
            <button class="btn primary" onclick={() => app.go("sketch")}>Go make something <Palette size={16} /></button>
          {/if}
        </footer>
      </div>
    </article>

    <aside class="stage" class:pip={mobile && !stageOpen} class:open={mobile && stageOpen} class:hide={mobile && (!hasDrawn || pipClosed)} style:translate={mobile && !stageOpen ? `${pipPos[0]}px ${pipPos[1]}px` : null}>
      {#if mobile && !stageOpen}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="drag" onpointerdown={pipDown}></div>
        <button class="pipx" aria-label="Hide the mini canvas" onclick={() => (pipClosed = true)}><X size={14} /></button>
      {/if}
      {#if mobile}
        <button class="grow btn sm icon" onclick={() => (stageOpen = !stageOpen)} aria-label={stageOpen ? "Shrink canvas" : "Expand canvas"}>
          {#if stageOpen}<Minimize size={15} />{:else}<Maximize size={15} />{/if}
        </button>
      {/if}
      <Stage bind:this={stage} name={lesson?.title ?? "lesson"} compact={!mobile || !stageOpen} hideToolbar={mobile && !stageOpen} />
    </aside>
  </div>
{/if}

<style>
  /* ---------- overview ---------- */
  .overview {
    height: 100%;
    padding: 0 24px 60px;
  }
  .hero {
    max-width: 1120px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 40px;
    align-items: center;
    padding: 48px 0 36px;
  }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 650;
    color: var(--coral);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 14px;
  }
  h1 {
    font-size: clamp(38px, 6vw, 68px);
    line-height: 1.02;
    letter-spacing: -0.035em;
    margin: 0 0 18px;
    font-weight: 780;
  }
  h1 .q {
    background: linear-gradient(135deg, var(--coral), #b86bff 55%, var(--accent));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-family: var(--font-code);
    font-weight: 700;
  }
  .lede {
    font-size: 17.5px;
    line-height: 1.6;
    color: var(--text-2);
    max-width: 56ch;
    margin: 0 0 26px;
  }
  .cta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .btn.big {
    height: 46px;
    padding: 0 20px;
    font-size: 15.5px;
    border-radius: 13px;
  }
  .progress-line {
    color: var(--text-3);
    font-size: 13.5px;
    margin-top: 14px;
  }
  .art {
    aspect-ratio: 1;
    border-radius: 28px;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    background: var(--stage);
  }
  .chapters {
    max-width: 1120px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
  }
  .chapter {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 16px 16px 10px;
  }
  .chapter header {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .num {
    font-family: var(--font-code);
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
  }
  .chapter h2 {
    font-size: 17px;
    margin: 0;
    letter-spacing: -0.01em;
  }
  .count {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
  .bar {
    height: 3px;
    border-radius: 3px;
    background: var(--surface-3);
    margin: 10px 0 8px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, var(--good), var(--accent));
    transition: width 500ms var(--ease);
  }
  .chapter ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .chapter li button {
    width: 100%;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    border: none;
    background: none;
    text-align: left;
    padding: 8px 6px;
    border-radius: 10px;
    cursor: pointer;
  }
  .chapter li button:hover {
    background: var(--surface-2);
  }
  .dot {
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-2);
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .done .dot {
    color: var(--good);
    background: var(--good-soft);
    border-color: transparent;
  }
  .t {
    display: flex;
    flex-direction: column;
    font-weight: 600;
    font-size: 14.5px;
  }
  .t small {
    font-weight: 400;
    color: var(--text-2);
    font-size: 13px;
    line-height: 1.4;
    margin-top: 2px;
  }

  /* ---------- lesson ---------- */
  .lesson {
    height: 100%;
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) minmax(320px, 440px);
    min-height: 0;
  }
  .lesson.mobile {
    grid-template-columns: 1fr;
  }
  .side {
    border-right: 1px solid var(--line);
    padding: 14px 10px 30px;
    background: var(--surface);
  }
  .back {
    display: flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: none;
    color: var(--text-2);
    font-weight: 600;
    font-size: 13px;
    padding: 6px 8px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 8px;
  }
  .back:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .sc {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-3);
    margin: 14px 8px 6px;
  }
  .sl {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: none;
    text-align: left;
    padding: 6px 8px;
    border-radius: 8px;
    font-size: 13.5px;
    color: var(--text-2);
    cursor: pointer;
  }
  .sl .dot {
    width: 20px;
    height: 20px;
    font-size: 10.5px;
  }
  .sl:hover {
    background: var(--surface-2);
    color: var(--text);
  }
  .sl.on {
    background: var(--accent-soft);
    color: var(--text);
    font-weight: 600;
  }
  .article {
    min-height: 0;
    height: 100%;
  }
  .inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 36px 28px 80px;
  }
  .mobile .inner {
    padding: 22px 16px 120px;
  }
  .crumb {
    font-size: 12.5px;
    font-weight: 650;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin: 0 0 6px;
  }
  .inner h1 {
    font-size: clamp(30px, 4vw, 42px);
    margin: 0 0 8px;
  }
  .blurb {
    font-size: 17px;
    color: var(--text-2);
    margin: 0 0 20px;
    line-height: 1.5;
  }
  .prose :global(p),
  .prose :global(li) {
    font-size: 16px;
    line-height: 1.7;
  }
  .prose :global(h2) {
    font-size: 23px;
    letter-spacing: -0.015em;
    margin: 36px 0 8px;
  }
  .prose :global(h3) {
    font-size: 18px;
    margin: 26px 0 6px;
  }
  .prose :global(code.qi) {
    font-size: 0.9em;
    padding: 1px 5px;
    border-radius: 5px;
    background: var(--surface-2);
    border: 1px solid var(--line);
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
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-3);
  }
  .prose :global(.callout) {
    margin: 18px 0;
    padding: 12px 16px;
    border-radius: 12px;
    background: var(--surface-2);
    border-left: 3px solid var(--accent);
  }
  .prose :global(.callout p) {
    margin: 0;
    font-size: 15px;
  }
  .prose :global(.callout.headsup) {
    border-left-color: var(--warn);
  }
  .prose :global(.callout.tryit) {
    border-left-color: var(--coral);
  }
  .pager {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .stage {
    border-left: 1px solid var(--line);
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 14px;
    background: var(--bg);
    position: relative;
  }
  .stage :global(.stage) {
    background: transparent;
  }
  .mobile .stage {
    position: fixed;
    z-index: 30;
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow-lg);
    padding: 0;
    overflow: hidden;
    transition: all 260ms var(--ease);
  }
  .mobile .stage.pip {
    right: 12px;
    bottom: calc(var(--bottomnav-h) + 14px);
    width: 132px;
    height: 132px;
    border-radius: 16px;
  }
  .mobile .stage.open {
    left: 8px;
    right: 8px;
    bottom: calc(var(--bottomnav-h) + 10px);
    height: min(70dvh, 560px);
    border-radius: 18px;
  }
  .mobile .stage.hide {
    transform: translateY(20px);
    opacity: 0;
    pointer-events: none;
  }
  .drag {
    position: absolute;
    inset: 0;
    z-index: 2;
    touch-action: none;
  }
  .pipx {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 4;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, #000 55%, transparent);
    color: #fff;
  }
  .grow {
    z-index: 4 !important;
    position: absolute;
    top: 6px;
    right: 6px;
    z-index: 3;
    background: color-mix(in srgb, var(--surface) 80%, transparent);
  }

  @media (max-width: 1180px) and (min-width: 761px) {
    .lesson {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
    }
    .side {
      display: none;
    }
  }
  @media (max-width: 760px) {
    .overview {
      padding: 0 16px 40px;
    }
    .hero {
      grid-template-columns: 1fr;
      padding: 26px 0 20px;
      gap: 20px;
    }
    .art {
      order: -1;
      max-height: 260px;
      aspect-ratio: auto;
      height: 260px;
      border-radius: 20px;
    }
    .lede {
      font-size: 16px;
    }
    .chapters {
      grid-template-columns: 1fr;
    }
  }
</style>
