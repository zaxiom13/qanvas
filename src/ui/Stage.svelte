<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { QanvasRuntime, type RunState } from "../qanvas/runtime";
  import { consoleHub, type ConsoleTarget } from "../lib/app.svelte";
  import { explainError, type Explained } from "../lib/explain";
  import type { QError } from "../q/errors";
  import ErrorCard from "./ErrorCard.svelte";
  import { Camera, Maximize, Minimize, Pause, Play, RotateCcw, StepForward } from "./icons";

  interface Props {
    name?: string;
    compact?: boolean;
    /** called with an explained error (or null when a run succeeds) */
    onError?: (e: Explained | null) => void;
    onState?: (s: RunState) => void;
    /** make this stage's session the console target */
    connectConsole?: boolean;
    hideToolbar?: boolean;
    onRunRequest?: () => void;
    showError?: boolean;
  }
  let { name = "sketch", compact = false, onError, onState, connectConsole = true, hideToolbar = false, onRunRequest, showError = true }: Props = $props();

  let host: HTMLDivElement;
  let frame: HTMLDivElement;
  let rt: QanvasRuntime | null = null;
  let runState = $state<RunState>("idle");
  let fps = $state(0);
  let err = $state<Explained | null>(null);
  let size = $state([600, 600]);
  let scale = $state(1);
  let full = $state(false);
  let lastSrc = "";
  let ro: ResizeObserver;

  const target: ConsoleTarget = {
    get name() {
      try {
        return name;
      } catch {
        return "sketch";
      }
    },
    evaluate: (src) => {
      const r = rt?.evalInSketch(src) ?? null;
      if (rt && runState !== "running") rt.p.redraw?.();
      return r;
    },
    trace: (src) => rt?.session?.trace(src) ?? null,
  };

  onMount(() => {
    rt = new QanvasRuntime(host, {
      output: (kind, text) => consoleHub.push({ kind: kind === "out" ? "out" : kind === "err" ? "err" : "info", text, err: kind === "err" ? { name: "stderr", hint: text } : undefined }),
      error: (e: QError, src: string) => {
        err = explainError(e, src);
        onError?.(err);
      },
      state: (s) => {
        runState = s;
        onState?.(s);
      },
      fps: (f) => (fps = f),
    });
    ro = new ResizeObserver(fit);
    ro.observe(frame);
    if (connectConsole) consoleHub.use(target);
  });

  onDestroy(() => {
    ro?.disconnect();
    rt?.destroy();
    if (consoleHub.target === target) consoleHub.use(null);
  });

  function fit() {
    if (!rt || !frame) return;
    const w = rt.width, h = rt.height;
    size = [w, h];
    const pad = compact ? 0 : 24;
    const bw = frame.clientWidth - pad, bh = frame.clientHeight - pad;
    scale = Math.max(0.05, Math.min(bw / w, bh / h, full ? 4 : 2));
  }

  export async function run(src: string): Promise<Explained | null> {
    if (!rt) return null;
    lastSrc = src;
    err = null;
    onError?.(null);
    if (connectConsole) consoleHub.use(target);
    await rt.run(src);
    fit();
    return err;
  }

  export function evaluate(src: string) {
    return target.evaluate(src);
  }

  export function trace(src: string) {
    return target.trace(src);
  }

  export function hasSession() {
    return !!rt?.session;
  }

  export function stop() {
    rt?.stop();
  }

  export function pause() {
    if (runState === "running") rt?.pause();
  }

  export function resume() {
    if (runState === "paused") rt?.resume();
  }

  export function focusConsole() {
    consoleHub.use(target);
  }

  export function snapshot(): string | null {
    return rt?.snapshot() ?? null;
  }

  function toggle() {
    if (!rt) return;
    if (runState === "running") rt.pause();
    else if (runState === "paused") rt.resume();
    else if (onRunRequest) onRunRequest();
    else run(lastSrc);
  }

  function download() {
    const url = rt?.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w-]+/g, "-") || "sketch"}.png`;
    a.click();
  }

  async function toggleFull() {
    full = !full;
    requestAnimationFrame(fit);
  }

  $effect(() => {
    void full;
    requestAnimationFrame(fit);
  });
</script>

<div class="stage" class:compact class:full>
  {#if !hideToolbar}
    <div class="bar">
      <button class="btn sm primary" onclick={() => (onRunRequest ? onRunRequest() : run(lastSrc))} title="Run (Ctrl+Enter)">
        <RotateCcw size={14} /> {runState === "idle" ? "Run" : "Restart"}
      </button>
      <button class="btn sm icon ghost" onclick={toggle} disabled={runState !== "running" && runState !== "paused"} title={runState === "running" ? "Pause" : "Resume"} aria-label={runState === "running" ? "Pause" : "Resume"}>
        {#if runState === "running"}<Pause size={15} />{:else}<Play size={15} />{/if}
      </button>
      <button class="btn sm icon ghost" onclick={() => rt?.step()} disabled={runState !== "running" && runState !== "paused"} title="Draw one frame" aria-label="Step one frame">
        <StepForward size={15} />
      </button>
      <span class="meta">
        {#if runState === "running"}<span class="live"></span>{Math.round(fps)} fps{:else if runState === "paused"}paused{:else if runState === "error"}stopped{:else if runState === "done"}drawn{/if}
        <span class="dim">{size[0]}×{size[1]}</span>
      </span>
      <button class="btn sm icon ghost" onclick={download} title="Save as PNG" aria-label="Save as PNG"><Camera size={15} /></button>
      <button class="btn sm icon ghost" onclick={toggleFull} title={full ? "Exit full view" : "Full view"} aria-label="Toggle full view">
        {#if full}<Minimize size={15} />{:else}<Maximize size={15} />{/if}
      </button>
    </div>
  {/if}
  <div class="frame" bind:this={frame}>
    <div class="canvas-host" bind:this={host} style:--w="{size[0] * scale}px" style:--h="{size[1] * scale}px"></div>
    {#if err && showError}
      <div class="errwrap"><ErrorCard e={err} compact /></div>
    {/if}
  </div>
</div>

<style>
  .stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--bg);
  }
  .stage.full {
    position: fixed;
    inset: 0;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    z-index: 60;
    background: #09080e;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
    min-height: 42px;
  }
  .meta {
    margin: 0 auto 0 8px;
    font-size: 12px;
    color: var(--text-2);
    display: flex;
    align-items: center;
    gap: 8px;
    font-variant-numeric: tabular-nums;
  }
  .dim {
    color: var(--text-3);
  }
  .live {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--good);
    box-shadow: 0 0 0 3px var(--good-soft);
    margin-right: 2px;
  }
  .frame {
    position: relative;
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 60%),
      var(--bg);
  }
  .compact .frame {
    background: transparent;
  }
  .canvas-host {
    width: var(--w);
    height: var(--h);
    border-radius: 10px;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    background: var(--stage);
    line-height: 0;
  }
  .compact .canvas-host {
    border-radius: 12px;
  }
  .canvas-host :global(canvas) {
    width: var(--w) !important;
    height: var(--h) !important;
    display: block;
    outline: none;
    cursor: crosshair;
  }
  .errwrap {
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 12px;
    max-height: 45%;
    overflow: auto;
    background: var(--surface);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    animation: rise 220ms var(--ease);
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(8px); }
  }
</style>
