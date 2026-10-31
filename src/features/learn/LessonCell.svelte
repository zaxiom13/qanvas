<script lang="ts">
  import { untrack } from "svelte";
  import type { EvalResult } from "../../q/interp";
  import { app } from "../../app/state.svelte";
  import { explainError, type Explained } from "../../presentation/explain";
  import { inline } from "../../q/format";
  import { shapeLabel } from "../../presentation/shape";
  import CodeEditor from "../../ui/CodeEditor.svelte";
  import TweakCode from "../../ui/TweakCode.svelte";
  import ErrorCard from "../../ui/ErrorCard.svelte";
  import ValueView, { hasVisual, isTabular } from "../../ui/ValueView.svelte";
  import { Footprints, Hand, Keyboard, Play, RotateCcw, Sparkles, Terminal } from "../../ui/icons";
  import type { QValue } from "../../q/index";

  interface Props {
    code: string;
    sketch: boolean;
    evaluate: (src: string) => EvalResult | null;
    trace: (src: string) => { steps: { s: number; e: number; value: QValue }[] } | null;
    runSketch: (src: string) => Promise<Explained | null>;
    /** phone: start in tweak mode (tap values) rather than the keyboard editor */
    touch?: boolean;
  }
  let { code: original, sketch, evaluate, trace, runSketch, touch = false }: Props = $props();
  let typing = $state(untrack(() => !touch));
  let tweakTimer: ReturnType<typeof setTimeout> | undefined;
  function tweaked(v: string) {
    code = v;
    clearTimeout(tweakTimer);
    tweakTimer = setTimeout(run, 140);
  }

  let code = $state(untrack(() => original));
  let result = $state<{ text: string; value?: QValue } | null>(null);
  let err = $state<Explained | null>(null);
  let showVisual = $state(true);
  let steps = $state<{ s: number; e: number; value: QValue }[] | null>(null);
  let ran = $state(false);
  let edError = $state<{ from: number; to: number; message: string } | null>(null);

  async function run() {
    ran = true;
    steps = null;
    if (sketch) {
      result = null;
      err = await runSketch(code);
    } else {
      const r = evaluate(code);
      if (!r) return;
      if (r.error) {
        err = explainError(r.error, code);
        result = null;
      } else {
        err = null;
        result = r.silent ? { text: "" } : { text: r.text, value: r.value };
      }
    }
    edError = err?.where ? { ...err.where, message: `'${err.name} ${err.hint ?? ""}` } : null;
  }

  function explain() {
    const t = trace(code.trim());
    steps = t?.steps ?? null;
  }

  function reset() {
    code = original;
    result = null;
    err = null;
    steps = null;
    edError = null;
  }

  const lines = $derived(code.trim().split("\n").length);
  const explainable = $derived(!sketch && lines === 1 && /[+\-*%&|,#_$?@!~^<>=]|\b(til|sum|count|each|where|flip|neg|max|min|avg)\b/.test(code));
</script>

<div class="cell" class:sketch>
  <div class="ed">
    {#if typing}
      <CodeEditor value={code} onChange={(v) => (code = v)} onRun={run} compact error={edError} label={sketch ? "Sketch cell" : "q cell"} />
    {:else}
      <TweakCode {code} onChange={tweaked} hint="" label={sketch ? "Sketch cell" : "q cell"} />
    {/if}
    <div class="actions">
      {#if touch}
        <button class="btn sm ghost icon" onclick={() => (typing = !typing)} aria-label={typing ? "Tap to tweak values" : "Type with the keyboard"} title={typing ? "Tweak" : "Type"}>
          {#if typing}<Hand size={16} />{:else}<Keyboard size={16} />{/if}
        </button>
      {/if}
      {#if code !== original}
        <button class="btn sm ghost icon" onclick={reset} title="Reset to original" aria-label="Reset cell"><RotateCcw size={14} /></button>
      {/if}
      {#if !sketch}
        <button class="btn sm ghost icon" onclick={() => app.tryInConsole(code.trim())} title="Try in the console" aria-label="Try in console"><Terminal size={14} /></button>
      {/if}
      <button class="btn sm {ran ? '' : sketch ? 'go' : 'primary'}" onclick={run} title="Run (Ctrl+Enter)">
        {#if sketch}<Sparkles size={14} />{:else}<Play size={14} />{/if}
        {sketch ? "Draw" : "Run"}
      </button>
    </div>
  </div>
  {#if err}
    <div class="out"><ErrorCard e={err} compact /></div>
  {:else if result && result.text}
    <div class="out">
      {#if !result.value || !isTabular(result.value)}<pre class="text">{result.text}</pre>{/if}
      {#if result.value}
        {#if hasVisual(result.value)}<div class="visual"><ValueView value={result.value} /></div>{/if}
        <div class="tools">
          <span class="shape">{shapeLabel(result.value)}</span>
          {#if explainable}<button class="tool" class:on={!!steps} onclick={explain}><Footprints size={13} /> explain</button>{/if}
        </div>
        {#if steps}
          <div class="trace">
            {#each steps as st, i (i)}
              <div class="step">
                <span class="n">{i + 1}</span>
                <code class="expr">{code.trim().slice(0, st.s)}<mark>{code.trim().slice(st.s, st.e)}</mark>{code.trim().slice(st.e)}</code>
                <span class="arr">→</span>
                <code class="res">{inline(st.value, 7).slice(0, 60)}</code>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  {:else if ran && sketch}
    <div class="note">↗ drawn on the canvas</div>
  {/if}
</div>

<style>
  .cell {
    margin: 18px 0;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--code-bg);
    overflow: hidden;
    box-shadow: 0 1px 0 color-mix(in srgb, var(--line) 60%, transparent);
  }
  .cell.sketch {
    border-left: 3px solid var(--accent);
  }
  .ed {
    position: relative;
  }
  .ed :global(.cm-content),
  .ed :global(.tweak .code) {
    padding-right: 132px !important;
  }
  .actions {
    position: absolute;
    top: 7px;
    right: 7px;
    display: flex;
    gap: 4px;
    z-index: 2;
  }
  .out {
    border-top: 1px dashed var(--line);
    padding: 10px 14px 12px;
    background: var(--surface);
  }
  .text {
    margin: 0;
    font-size: 13px;
    white-space: pre;
    overflow-x: auto;
    color: var(--text);
  }
  .tools {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .tool {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 999px;
    cursor: pointer;
  }
  .tool:hover,
  .tool.on {
    color: var(--accent);
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .visual {
    margin-top: 8px;
  }
  .shape {
    font-size: 11px;
    color: var(--text-3);
    font-weight: 600;
    align-self: center;
  }
  .trace {
    margin-top: 10px;
    border-left: 2px solid var(--accent);
    padding-left: 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .step {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
    font-size: 13px;
    animation: stepIn 360ms var(--ease) both;
  }
  .step:nth-child(2) { animation-delay: 220ms; }
  .step:nth-child(3) { animation-delay: 440ms; }
  .step:nth-child(4) { animation-delay: 660ms; }
  .step:nth-child(n + 5) { animation-delay: 880ms; }
  @keyframes stepIn {
    from { opacity: 0; transform: translateX(-6px); }
  }
  .n {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--accent-text);
    background: var(--accent);
    border-radius: 999px;
    min-width: 18px;
    height: 18px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .expr {
    color: var(--text-3);
  }
  .expr mark {
    background: var(--accent-soft);
    color: var(--text);
    border-radius: 3px;
  }
  .arr {
    color: var(--text-3);
  }
  .res {
    color: var(--syn-number);
  }
  .note {
    border-top: 1px dashed var(--line);
    padding: 6px 14px;
    font-size: 12px;
    color: var(--text-3);
    background: var(--surface);
  }
</style>
