<script lang="ts">
  // The first page anyone sees: a live sketch, and its code with the numbers turned into keys.
  import { onDestroy, onMount, tick } from "svelte";
  import { app } from "../../app/state.svelte";
  import { TOYS } from "../../content/toys";
  import Stage from "../../ui/Stage.svelte";
  import TweakCode from "../../ui/TweakCode.svelte";
  import { hapticsOn, setHaptics, buzz } from "../../ui/haptics";
  import { enableMotion, motionNeedsPermission, usesMotion } from "../../adapters/browser/motion";
  import { ArrowRight, ChevronLeft, ChevronRight, Monitor, Moon, Palette, Route, Shuffle, Smartphone, Sun, Vibrate } from "../../ui/icons";

  let { mobile, onTheme }: { mobile: boolean; onTheme: () => void } = $props();

  const KEY = "qanvas:toy";
  const startAt = () => {
    const fromRoute = TOYS.findIndex((t) => t.example.id === app.route.parts[0]);
    if (fromRoute >= 0) return fromRoute;
    try {
      const n = Number(localStorage.getItem(KEY));
      return Number.isInteger(n) && n >= 0 && n < TOYS.length ? n : 0;
    } catch {
      return 0;
    }
  };

  let index = $state(startAt());
  const toy = $derived(TOYS[index]);
  let code = $state(TOYS[startAt()].example.code);
  let stage = $state<Stage>();
  let haptics = $state(hapticsOn());
  let needsMotion = $state(false);
  let errorText = $state("");
  let runTimer: ReturnType<typeof setTimeout> | undefined;

  async function runNow() {
    if (!stage) return;
    const err = await stage.run(code);
    errorText = err ? `'${err.name}${err.hint ? " " + err.hint : ""}` : "";
    needsMotion = usesMotion(code) && motionNeedsPermission();
  }

  function edited(next: string) {
    code = next;
    clearTimeout(runTimer);
    runTimer = setTimeout(runNow, 140);
  }

  function show(i: number) {
    index = (i + TOYS.length) % TOYS.length;
    code = TOYS[index].example.code;
    try { localStorage.setItem(KEY, String(index)); } catch { /* storage unavailable */ }
    void tick().then(runNow);
  }
  function shuffle() {
    let next = index;
    while (TOYS.length > 1 && next === index) next = Math.floor(Math.random() * TOYS.length);
    show(next);
  }

  $effect(() => {
    if (stage) void untrackRun();
  });
  let started = false;
  async function untrackRun() {
    if (started) return;
    started = true;
    await runNow();
  }

  onDestroy(() => clearTimeout(runTimer));

  function toggleHaptics() {
    haptics = !haptics;
    setHaptics(haptics);
    buzz(20);
  }

  async function motion() {
    if (await enableMotion()) {
      needsMotion = false;
      buzz(20);
    }
  }

  const changed = $derived(code !== toy.example.code);
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("input, textarea, .cm-editor, canvas")) return;
      if (e.key === "ArrowRight") show(index + 1);
      if (e.key === "ArrowLeft") show(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div class="play" class:mobile>
  <section class="canvas">
    {#if mobile}
      <header class="mtop">
        <span class="brand"><img src="./icon.svg" alt="" width="26" height="26" /><b>qanvas</b></span>
        <button class="btn sm ghost icon" onclick={toggleHaptics} aria-pressed={haptics} aria-label={haptics ? "Turn key clicks off" : "Turn key clicks on"} class:dim={!haptics}><Vibrate size={18} /></button>
        <button class="btn sm ghost icon" onclick={onTheme} aria-label="Change theme">
          {#if app.theme === "system"}<Monitor size={18} />{:else if app.theme === "dark"}<Moon size={18} />{:else}<Sun size={18} />{/if}
        </button>
      </header>
    {/if}
    <div class="frame">
      <Stage bind:this={stage} name={toy.example.title} compact hideToolbar showError={false} connectConsole={false} />
      {#if needsMotion}
        <button class="btn sm go motion" onclick={motion}><Smartphone size={16} /> Use tilt</button>
      {/if}
      {#if errorText}<p class="err" role="status">{errorText}</p>{/if}
    </div>
  </section>

  <section class="side">
    {#if !mobile}
      <div class="hello">
        <p class="label">q · live · in your browser</p>
        <h1>Draw with <span class="q">q</span>.<br />Tap the numbers.</h1>
      </div>
    {/if}

    <div class="deck">
      <button class="btn icon" onclick={() => show(index - 1)} aria-label="Previous sketch"><ChevronLeft size={22} /></button>
      <div class="title">
        <span class="label">{String(index + 1).padStart(2, "0")} / {String(TOYS.length).padStart(2, "0")}</span>
        <h2>{toy.example.title}</h2>
        {#if mobile}<p class="nudge">{toy.nudge}</p>{/if}
      </div>
      <button class="btn icon" onclick={shuffle} aria-label="Surprise me"><Shuffle size={19} /></button>
      <button class="btn icon" onclick={() => show(index + 1)} aria-label="Next sketch"><ChevronRight size={22} /></button>
    </div>

    <div class="card">
      {#key index}
        <TweakCode {code} onChange={edited} hideComments hint={mobile ? "" : toy.nudge} label={`Code for ${toy.example.title}`} />
      {/key}
    </div>

    <div class="actions">
      <button class="btn primary big" onclick={() => app.remix(toy.example.title, code, toy.example.id)}>
        <Palette size={19} /> {changed ? "Keep my version" : "Make it mine"}
      </button>
      <button class="btn go big" onclick={() => app.go(toy.lesson ? `learn/${toy.lesson}` : "learn")}>
        <Route size={19} /> {mobile ? "Learn" : "Learn how"} <ArrowRight size={17} />
      </button>
    </div>
  </section>
</div>

<style>
  .play {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.85fr);
    gap: 28px;
    padding: 28px 32px;
    overflow: hidden;
  }
  .canvas {
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .frame {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: var(--r-xl);
    background: var(--stage);
    box-shadow: var(--shadow-lg), inset 0 0 0 1px #ffffff10;
    overflow: hidden;
  }
  .frame :global(.stage) {
    background: transparent;
  }
  .frame :global(.canvas-host) {
    box-shadow: 0 0 120px -30px var(--accent-soft);
  }
  .motion {
    position: absolute;
    top: 12px;
    right: 12px;
  }
  .err {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    margin: 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--bad-soft);
    color: var(--bad);
    backdrop-filter: blur(8px);
    font-family: var(--font-code);
    font-size: 13px;
  }
  .side {
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .hello h1 {
    margin: 6px 0 0;
    font-size: clamp(34px, 3.6vw, 54px);
    font-weight: 700;
  }
  .q {
    color: var(--accent);
    font-family: var(--font-code);
  }
  .deck {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .title {
    flex: 1;
    min-width: 0;
  }
  .title h2 {
    margin: 2px 0 0;
    font-size: 24px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .card {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    border-radius: var(--r-lg);
    background: var(--code-bg);
    border: 1px solid var(--line);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  .card > :global(.tweak) {
    flex: 1;
  }
  .actions {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 12px;
  }

  /* ---------- phone ---------- */
  .play.mobile {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 0 12px 12px;
  }
  .mtop {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 52px;
  }
  .brand {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 19px;
    letter-spacing: -0.03em;
  }
  .dim {
    opacity: 0.45;
  }
  .mobile .canvas {
    flex: none;
  }
  .mobile .frame {
    flex: none;
    height: min(calc(100vw - 24px), 40dvh);
    border-radius: 22px;
  }
  .mobile .side {
    flex: 1;
    gap: 10px;
  }
  .mobile .title h2 {
    font-size: 20px;
  }
  .nudge {
    margin: 1px 0 0;
    font-size: 13px;
    line-height: 1.3;
    color: var(--text-2);
  }
  .mobile .actions {
    grid-template-columns: 1.4fr 1fr;
    gap: 10px;
  }
  .mobile .actions .btn {
    height: 52px;
    font-size: 15px;
  }
  .mobile .card :global(.code) {
    font-size: 14.5px;
  }
</style>
