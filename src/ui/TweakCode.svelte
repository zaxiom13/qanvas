<script lang="ts">
  // Code you change by tapping: numbers, colours and palettes become keys. No keyboard, no
  // precise dragging, so it works one-handed on a bumpy train.
  import { NAMED, PALETTES } from "../drawing/color";
  import { COLOR_NAMES, PALETTE_NAMES, applyTweak, formatNum, scan, stepFor, type Tweak } from "../drawing/tweak";
  import { API_NAMES, Q_KEYWORDS } from "../editor/qlang";
  import { buzz } from "./haptics";
  import { Minus, Plus, Undo2, X } from "./icons";

  interface Props {
    code: string;
    onChange: (code: string) => void;
    /** hide comment lines, for short toy snippets */
    hideComments?: boolean;
    /** show a hint until the first tap */
    hint?: string;
    label?: string;
  }
  let { code, onChange, hideComments = false, hint = "Tap a number or a colour to change it", label = "Tweakable code" }: Props = $props();

  let selected = $state<number | null>(null);
  let history = $state<string[]>([]);
  const scanned = $derived(scan(code));
  const tweak = $derived<Tweak | null>(selected === null ? null : (scanned.tweaks[selected] ?? null));

  function commit(next: string) {
    if (next === code) return;
    history = [...history.slice(-49), code];
    onChange(next);
  }

  function undo() {
    const prev = history.at(-1);
    if (prev === undefined) return;
    history = history.slice(0, -1);
    onChange(prev);
    buzz(8);
  }

  function step(mult: number) {
    const t = scanned.tweaks[selected ?? -1];
    if (!t || t.kind !== "num") return;
    commit(applyTweak(code, t, formatNum(t, t.value + stepFor(t) * mult)));
    buzz(6);
  }

  function pick(name: string) {
    const t = tweak;
    if (!t || t.kind === "num") return;
    commit(applyTweak(code, t, "`" + name));
    buzz(10);
  }

  // hold a key to keep stepping
  let timer: ReturnType<typeof setTimeout> | undefined;
  function hold(e: PointerEvent, mult: number) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    step(mult);
    let delay = 380;
    const again = () => {
      step(mult);
      delay = Math.max(45, delay * 0.8);
      timer = setTimeout(again, delay);
    };
    timer = setTimeout(again, delay);
  }
  function release() {
    clearTimeout(timer);
    timer = undefined;
  }
  // keyboard users press keys one at a time
  const keyStep = (e: MouseEvent, mult: number) => {
    if (e.detail === 0) step(mult);
  };

  function choose(i: number) {
    selected = selected === i ? null : i;
    buzz(5);
  }

  const wordClass = (w: string) => (API_NAMES.has(w) ? "api" : Q_KEYWORDS.has(w) ? "kw" : "name");
  const swatch = (name: string) => NAMED[name] ?? name;
  const gradient = (name: string) => `linear-gradient(90deg, ${PALETTES[name].join(", ")})`;
  const numLabel = (t: Extract<Tweak, { kind: "num" }>) => {
    const s = stepFor(t);
    return s >= 1 ? String(s) : s.toFixed(t.decimals);
  };
</script>

<div class="tweak" aria-label={label}>
  <pre class="code">{#each scanned.pieces as p, i (i)}{#if p.kind === "num" || p.kind === "color" || p.kind === "palette"}<button
          type="button"
          class="tk {p.kind}"
          class:on={selected === p.tweak}
          style:--sw={p.kind === "color" ? swatch(p.text.slice(1)) : undefined}
          aria-pressed={selected === p.tweak}
          aria-label={`Change ${p.text}`}
          onclick={() => choose(p.tweak)}>{p.text}</button>{:else if p.kind === "comment"}{#if !hideComments}<span class="c">{p.text}</span>{/if}{:else if p.kind === "string"}<span class="s">{p.text}</span>{:else if p.kind === "symbol"}<span class="y">{p.text}</span>{:else if p.kind === "word"}<span class={wordClass(p.text)}>{p.text}</span>{:else}{hideComments ? p.text.replace(/\n{2,}/g, "\n") : p.text}{/if}{/each}</pre>

  {#if tweak || hint}
  <div class="dock" class:open={!!tweak}>
    {#if !tweak}
      <p class="hint">{hint}</p>
    {:else if tweak.kind === "num"}
      <div class="row top">
        <span class="label">number</span>
        <output class="val">{code.slice(tweak.from, tweak.to)}</output>
        <span class="by">steps of {numLabel(tweak)}</span>
        <button class="btn sm ghost icon" onclick={undo} disabled={!history.length} aria-label="Undo"><Undo2 size={17} /></button>
        <button class="btn sm ghost icon" onclick={() => (selected = null)} aria-label="Done"><X size={18} /></button>
      </div>
      <div class="row keys">
        <button class="btn key" onpointerdown={(e) => hold(e, -10)} onpointerup={release} onpointercancel={release} onlostpointercapture={release} onclick={(e) => keyStep(e, -10)} aria-label="Decrease a lot"><Minus size={16} /><Minus size={16} /></button>
        <button class="btn key" onpointerdown={(e) => hold(e, -1)} onpointerup={release} onpointercancel={release} onlostpointercapture={release} onclick={(e) => keyStep(e, -1)} aria-label="Decrease"><Minus size={22} /></button>
        <button class="btn key primary" onpointerdown={(e) => hold(e, 1)} onpointerup={release} onpointercancel={release} onlostpointercapture={release} onclick={(e) => keyStep(e, 1)} aria-label="Increase"><Plus size={22} /></button>
        <button class="btn key primary" onpointerdown={(e) => hold(e, 10)} onpointerup={release} onpointercancel={release} onlostpointercapture={release} onclick={(e) => keyStep(e, 10)} aria-label="Increase a lot"><Plus size={16} /><Plus size={16} /></button>
      </div>
    {:else}
      <div class="row top">
        <span class="label">{tweak.kind === "color" ? "colour" : "palette"}</span>
        <output class="val">`{tweak.name}</output>
        <span class="by"></span>
        <button class="btn sm ghost icon" onclick={undo} disabled={!history.length} aria-label="Undo"><Undo2 size={17} /></button>
        <button class="btn sm ghost icon" onclick={() => (selected = null)} aria-label="Done"><X size={18} /></button>
      </div>
      {#if tweak.kind === "color"}
        <div class="swatches" role="listbox" aria-label="Colours">
          {#each COLOR_NAMES as c (c)}
            <button class="sw" class:on={tweak.name === c} style:--sw={swatch(c)} role="option" aria-selected={tweak.name === c} aria-label={c} onclick={() => pick(c)}></button>
          {/each}
        </div>
      {:else}
        <div class="pals" role="listbox" aria-label="Palettes">
          {#each PALETTE_NAMES as pn (pn)}
            <button class="pal" class:on={tweak.name === pn} role="option" aria-selected={tweak.name === pn} onclick={() => pick(pn)}>
              <span class="bar" style:background={gradient(pn)}></span>{pn}
            </button>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
  {/if}
</div>

<style>
  .tweak {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .code {
    margin: 0;
    padding: 14px 16px;
    font-family: var(--font-code);
    font-size: 15px;
    line-height: 2.05;
    color: var(--syn-op);
    white-space: pre-wrap;
    word-break: break-word;
    overflow: auto;
    flex: 1;
    min-height: 0;
  }
  .c { color: var(--syn-comment); font-style: italic; }
  .s { color: var(--syn-string); }
  .y { color: var(--syn-symbol); }
  .api { color: var(--syn-api); font-weight: 600; }
  .kw { color: var(--syn-keyword); }
  .name { color: var(--syn-name); }
  .tk {
    font: inherit;
    font-weight: 700;
    padding: 3px 7px;
    margin: 0 1px;
    border-radius: 8px;
    border: 1.5px solid color-mix(in srgb, currentColor 38%, transparent);
    background: color-mix(in srgb, currentColor 10%, transparent);
    cursor: pointer;
    touch-action: manipulation;
    transition: transform 80ms var(--ease), background var(--dur);
  }
  .tk.num { color: var(--syn-number); }
  .tk.color, .tk.palette { color: var(--syn-symbol); }
  .tk.color::before {
    content: "";
    display: inline-block;
    width: 0.8em;
    height: 0.8em;
    margin-right: 5px;
    border-radius: 50%;
    background: var(--sw);
    box-shadow: 0 0 0 1.5px #0005;
    vertical-align: -0.05em;
  }
  .tk:active { transform: scale(0.92); }
  .tk.on {
    color: var(--accent-text);
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-soft);
  }
  .dock {
    flex: none;
    border-top: 1px solid var(--line);
    background: var(--surface);
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px) * 0);
  }
  .hint {
    margin: 0;
    padding: 6px 4px;
    text-align: center;
    font-size: 14px;
    color: var(--text-2);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .top {
    margin-bottom: 10px;
  }
  .val {
    font-family: var(--font-code);
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .by {
    flex: 1;
    font-size: 12px;
    color: var(--text-3);
  }
  .keys {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }
  .key {
    height: 58px !important;
    border-radius: 16px;
    --key-depth: 4px;
    gap: 0;
  }
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 10px;
  }
  .sw {
    aspect-ratio: 1;
    min-height: 44px;
    border-radius: 50%;
    border: 2px solid var(--key-line);
    background: var(--sw);
    box-shadow: 0 3px 0 var(--key-edge);
    cursor: pointer;
    transition: transform 80ms var(--ease);
  }
  .sw:active { transform: translateY(3px); box-shadow: none; }
  .sw.on { outline: 3px solid var(--accent); outline-offset: 3px; }
  .pals {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .pal {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    min-width: 92px;
    border-radius: 12px;
    border: 1px solid var(--key-line);
    background: var(--key);
    box-shadow: 0 3px 0 var(--key-edge);
    font-family: var(--font-code);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .pal .bar { height: 14px; border-radius: 6px; }
  .pal.on { outline: 3px solid var(--accent); outline-offset: 2px; }
</style>
