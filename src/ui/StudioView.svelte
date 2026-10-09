<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { Pane, PaneGroup, PaneResizer } from "paneforge";
  import { app } from "../lib/app.svelte";
  import { DEFAULT_SKETCH, EXAMPLE_BY_ID, type Example } from "../content/examples";
  import { decodeShare, encodeShare, getSketch, newId, saveSketch, type Sketch } from "../lib/storage";
  import type { Explained } from "../lib/explain";
  import { parse } from "../q/parser";
  import type { RunState } from "../qanvas/runtime";
  import CodeEditor from "./CodeEditor.svelte";
  import Console from "./Console.svelte";
  import Stage from "./Stage.svelte";
  import Gallery from "./Gallery.svelte";
  import SymbolBar from "./SymbolBar.svelte";
  import type { EditorView } from "@codemirror/view";
  import { X, Check, Code, FolderOpen, Play, Plus, Share, Sparkles, Terminal, Wand } from "./icons";

  interface Props {
    active: boolean;
    mobile: boolean;
  }
  let { active, mobile }: Props = $props();

  let sketch = $state<Sketch>({ id: newId(), name: "Untitled sketch", code: DEFAULT_SKETCH, created: Date.now(), updated: Date.now() });
  let code = $state(DEFAULT_SKETCH);
  let stage = $state<Stage>();
  let view = $state<EditorView | null>(null);
  let edError = $state<{ from: number; to: number; message: string } | null>(null);
  let saved = $state(true);
  let galleryOpen = $state(false);
  let galleryTab = $state<"examples" | "mine">("examples");
  let mtab = $state<"code" | "canvas" | "console">("code");
  let runState = $state<RunState>("idle");
  let toast = $state("");
  let loadedKey: string | null = null;
  let saveTimer: ReturnType<typeof setTimeout>;
  let runTimer: ReturnType<typeof setTimeout>;

  let pendingRun = $state(false);
  $effect(() => {
    if (stage && pendingRun) {
      pendingRun = false;
      run();
    }
  });

  // mobile picture-in-picture: drag to move, tap to open the canvas, × to hide until the next run
  let pipClosed = $state(false);
  let pipPos = $state<[number, number]>([0, 0]);
  const pip = $derived(mtab === "code" && runState !== "idle" && runState !== "error" && !pipClosed);
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
      if (!moved) mtab = "canvas";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  function run() {
    pipClosed = false;
    if (!stage) {
      pendingRun = true;
      return;
    }
    stage.run(code);
    if (mobile && mtab === "code" && runState === "idle") mtab = "canvas";
  }

  function onError(e: Explained | null) {
    edError = e?.where ? { ...e.where, message: [`'${e.name}`, e.hint ?? e.help, e.tip].filter(Boolean).join(" — ") } : null;
  }

  function codeChanged(v: string) {
    code = v;
    saved = false;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 700);
    if (app.autoRun) {
      clearTimeout(runTimer);
      runTimer = setTimeout(() => {
        try {
          parse(code);
        } catch {
          return; // wait until the code parses
        }
        run();
      }, 650);
    }
  }


  async function persist() {
    sketch = { ...sketch, code, updated: Date.now() };
    await saveSketch($state.snapshot(sketch) as Sketch);
    saved = true;
    localStorage.setItem("qanvas:lastSketch", sketch.id);
  }

  function open(s: Sketch, runNow = true) {
    sketch = s;
    code = s.code;
    saved = true;
    edError = null;
    if (runNow) queueMicrotask(run);
  }

  function openExample(ex: Example) {
    galleryOpen = false;
    const s: Sketch = { id: newId(), name: ex.title, code: ex.code, created: Date.now(), updated: Date.now(), from: ex.id };
    open(s);
    app.go(`sketch/${s.id}`);
    persist();
  }

  function newSketch() {
    const s: Sketch = { id: newId(), name: "Untitled sketch", code: "background 20\ncircle[center;100;`coral]\n", created: Date.now(), updated: Date.now() };
    open(s);
    app.go(`sketch/${s.id}`);
    persist();
  }

  async function share() {
    const url = `${location.origin}${location.pathname}#/s/${encodeShare(sketch.name, code)}`;
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied — the whole sketch is inside it.");
    } catch {
      prompt("Copy this link:", url);
    }
  }

  function flash(t: string) {
    toast = t;
    setTimeout(() => (toast = ""), 2600);
  }

  async function loadRoute() {
    const parts = app.route.parts;
    const key = parts.join("/");
    if (key === loadedKey) return;
    loadedKey = key;
    if (parts[0] === "example" && parts[1]) {
      const ex = EXAMPLE_BY_ID.get(parts[1]);
      if (ex) return openExample(ex);
    }
    if (parts[0] === "shared" && parts[1]) {
      const d = decodeShare(parts[1]);
      if (d) {
        const s: Sketch = { id: newId(), name: d.name, code: d.code, created: Date.now(), updated: Date.now() };
        open(s);
        persist();
        history.replaceState(null, "", `#/sketch/${s.id}`);
        // replaceState fires no hashchange, so update the route ourselves
        loadedKey = s.id;
        app.route = { tab: "sketch", parts: [s.id] };
        return;
      }
    }
    if (parts[0] === "new") return newSketch();
    const id = parts[0] || localStorage.getItem("qanvas:lastSketch") || "";
    const s = id ? await getSketch(id) : undefined;
    if (s) open(s, active);
    else open(sketch, active);
  }

  onMount(loadRoute);
  $effect(() => {
    if (app.route.tab === "sketch" && app.route.parts) untrack(() => void loadRoute());
  });

  // pause when hidden
  $effect(() => {
    if (!active) stage?.stop?.();
  });

  $effect(() => {
    if (active) stage?.focusConsole();
  });

  function insert(text: string) {
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }
</script>

{#snippet editorHeader()}
  <div class="edhead">
    <input
      class="name"
      value={sketch.name}
      aria-label="Sketch name"
      onchange={(e) => {
        sketch.name = (e.currentTarget as HTMLInputElement).value || "Untitled sketch";
        persist();
      }}
    />
    <span class="saved" title={saved ? "Saved on this device" : "Saving…"}>{#if saved}<Check size={13} /> saved{:else}saving…{/if}</span>
    <div class="spacer"></div>
    <button class="btn sm ghost" onclick={() => { galleryTab = "examples"; galleryOpen = true; }} title="Examples"><Sparkles size={15} />{#if !mobile}<span class="lbl">Examples</span>{/if}</button>
    <button class="btn sm ghost" onclick={() => { galleryTab = "mine"; galleryOpen = true; }} title="My sketches"><FolderOpen size={15} />{#if !mobile}<span class="lbl">Mine</span>{/if}</button>
    <button class="btn sm ghost icon" onclick={newSketch} title="New sketch" aria-label="New sketch"><Plus size={16} /></button>
    <button class="btn sm ghost icon" onclick={share} title="Copy a share link" aria-label="Share"><Share size={15} /></button>
  </div>
  <div class="edsub">
    <label class="toggle" title="Re-run automatically as you type">
      <input type="checkbox" checked={app.autoRun} onchange={(e) => app.setAutoRun((e.currentTarget as HTMLInputElement).checked)} />
      <Wand size={13} /> live
    </label>
    <div class="spacer"></div>
    <button class="btn sm primary" onclick={run} title="Run (Ctrl+Enter)"><Play size={14} /> Run</button>
  </div>
{/snippet}

{#snippet editor()}
  <div class="edbody">
    <CodeEditor value={code} onChange={codeChanged} onRun={run} error={edError} bind:view label="Sketch code" />
  </div>
{/snippet}

<div class="studio" class:hidden={!active}>
  {#if mobile}
    <div class="mtabs" role="tablist">
      <button role="tab" aria-selected={mtab === "code"} class:on={mtab === "code"} onclick={() => (mtab = "code")}><Code size={15} /> Code</button>
      <button role="tab" aria-selected={mtab === "canvas"} class:on={mtab === "canvas"} onclick={() => (mtab = "canvas")}><Sparkles size={15} /> Canvas</button>
      <button role="tab" aria-selected={mtab === "console"} class:on={mtab === "console"} onclick={() => (mtab = "console")}><Terminal size={15} /> Console</button>
    </div>
    <div class="mbody">
      <div class="mpane" class:show={mtab === "code"}>
        {@render editorHeader()}
        {@render editor()}
        <SymbolBar onInsert={insert} />
      </div>
      <div class="mstage" class:pip class:show={mtab === "canvas" || pip} style:translate={pip ? `${pipPos[0]}px ${pipPos[1]}px` : null}>
        {#if pip}<button class="pipx" aria-label="Hide the mini canvas" onclick={() => (pipClosed = true)}><X size={14} /></button>{/if}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="pipclick" onpointerdown={pipDown}></div>
        <Stage bind:this={stage} name={sketch.name} {onError} onState={(s) => (runState = s)} onRunRequest={run} />
      </div>
      <div class="mpane" class:show={mtab === "console"}>
        <Console />
      </div>
    </div>
  {:else}
    <PaneGroup direction="horizontal" autoSaveId="qanvas-studio-h">
      <Pane defaultSize={46} minSize={25}>
        <div class="col">
          {@render editorHeader()}
          {@render editor()}
        </div>
      </Pane>
      <PaneResizer class="resizer v" />
      <Pane defaultSize={54} minSize={25}>
        <PaneGroup direction="vertical" autoSaveId="qanvas-studio-v">
          <Pane defaultSize={70} minSize={25}>
            <Stage bind:this={stage} name={sketch.name} {onError} onState={(s) => (runState = s)} onRunRequest={run} />
          </Pane>
          <PaneResizer class="resizer h" />
          <Pane defaultSize={30} minSize={10}>
            <Console />
          </Pane>
        </PaneGroup>
      </Pane>
    </PaneGroup>
  {/if}
</div>

<Gallery bind:open={galleryOpen} tab={galleryTab} onPick={openExample} onOpenSketch={(s) => { galleryOpen = false; open(s); app.go(`sketch/${s.id}`); }} />

{#if toast}<div class="toast" role="status">{toast}</div>{/if}

<style>
  .studio {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .studio.hidden {
    display: none;
  }
  .col {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--code-bg);
    container-type: inline-size;
  }
  /* a narrow editor pane (phone landscape, dragged resizer): icons only, so the name stays readable */
  @container (max-width: 420px) {
    .lbl {
      display: none;
    }
  }
  .edhead {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px 4px 12px;
    background: var(--surface);
  }
  .edsub {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 4px 8px 6px 12px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .name {
    font: inherit;
    font-weight: 650;
    font-size: 14.5px;
    color: var(--text);
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 3px 6px;
    min-width: 0;
    width: 14ch;
    flex: 0 1 auto;
  }
  .name:hover,
  .name:focus {
    border-color: var(--line);
    background: var(--surface-2);
    outline: none;
  }
  .saved {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11.5px;
    color: var(--text-3);
    white-space: nowrap;
  }
  .spacer {
    flex: 1;
  }
  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text-2);
    cursor: pointer;
    user-select: none;
  }
  .toggle input {
    accent-color: var(--accent);
    margin: 0;
  }
  .edbody {
    flex: 1;
    min-height: 0;
  }
  :global(.resizer) {
    background: var(--line);
    position: relative;
    transition: background var(--dur);
  }
  :global(.resizer.v) {
    width: 1px;
  }
  :global(.resizer.h) {
    height: 1px;
  }
  :global(.resizer::after) {
    content: "";
    position: absolute;
    inset: -4px;
  }
  :global(.resizer[data-active]),
  :global(.resizer:hover) {
    background: var(--accent);
  }
  /* mobile */
  .mtabs {
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .mtabs button {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-2);
    font-weight: 600;
    font-size: 14px;
  }
  .mtabs button.on {
    background: var(--surface-2);
    border-color: var(--line);
    color: var(--text);
  }
  .mbody {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .mpane {
    position: absolute;
    inset: 0;
    display: none;
    flex-direction: column;
    background: var(--code-bg);
  }
  .mpane.show {
    display: flex;
  }
  .mstage {
    position: absolute;
    inset: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .mstage.show {
    visibility: visible;
    pointer-events: auto;
  }
  .mstage.pip {
    inset: auto 12px 60px auto;
    width: 118px;
    height: 118px;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: var(--shadow-lg);
    z-index: 5;
    border: 1px solid var(--line-strong);
  }
  .mstage.pip :global(.bar) {
    display: none;
  }
  .pipx {
    display: flex;
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 3;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, #000 55%, transparent);
    color: #fff;
  }
  .pipclick {
    touch-action: none;
    display: none;
  }
  .mstage.pip .pipclick {
    display: block;
    position: absolute;
    inset: 0;
    z-index: 2;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(var(--bottomnav-h) + 24px);
    transform: translateX(-50%);
    background: var(--text);
    color: var(--bg);
    padding: 10px 16px;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 550;
    box-shadow: var(--shadow-lg);
    z-index: 80;
    animation: rise 200ms var(--ease);
  }
  @keyframes rise {
    from { opacity: 0; transform: translate(-50%, 8px); }
  }
</style>
