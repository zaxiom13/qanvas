<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { Pane, PaneGroup, PaneResizer } from "paneforge";
  import { app } from "../../app/state.svelte";
  import { DEFAULT_SKETCH, EXAMPLE_BY_ID, type Example } from "../../content/examples";
  import { newId, type Sketch } from "../../sketches/model";
  import { decodeShare, findSharedCopy, shareKey, shareOpenedNote, shareUrl, shareWarning } from "../../sketches/share";
  import { recoverPending } from "../../sketches/recovery";
  import { getSketch, listSketches, readPending } from "../../adapters/browser/persistence";
  import { createSketchWorkflow } from "../../app/bootstrap";
  import { thumbnail } from "../../adapters/browser/thumbnails";
  import type { Explained } from "../../presentation/explain";
  import { parse } from "../../q/parser";
  import type { RunState } from "../../adapters/browser/canvas-runtime";
  import CodeEditor from "../../ui/CodeEditor.svelte";
  import Console from "../../ui/Console.svelte";
  import Stage from "../../ui/Stage.svelte";
  import Gallery from "./Gallery.svelte";
  import { sketchHold } from "../../app/layout/visibility";
  import SymbolBar from "../../ui/SymbolBar.svelte";
  import TweakCode from "../../ui/TweakCode.svelte";
  import type { EditorView } from "@codemirror/view";
  import { Check, FolderOpen, Hand, Keyboard, Play, Plus, Share, Sparkles, Terminal, Wand } from "../../ui/icons";

  interface Props {
    active: boolean;
    mobile: boolean;
    phoneLand?: boolean;
  }
  let { active, mobile, phoneLand = false }: Props = $props();

  let sketch = $state<Sketch>({ id: newId(), name: "Untitled sketch", code: DEFAULT_SKETCH, created: Date.now(), updated: Date.now() });
  let code = $state(DEFAULT_SKETCH);
  let stage = $state<Stage>();
  let view = $state<EditorView | null>(null);
  let edError = $state<{ from: number; to: number; message: string } | null>(null);
  let saved = $state(true);
  let galleryOpen = $state(false);
  let galleryTab = $state<"examples" | "mine">("examples");
  // phones: change values by tapping (tweak) or write code with the keyboard (type)
  const MODE_KEY = "qanvas:studioMode";
  let mmode = $state<"tweak" | "type">((() => { try { return localStorage.getItem(MODE_KEY) === "type" ? "type" : "tweak"; } catch { return "tweak"; } })());
  function setMode(m: "tweak" | "type") {
    mmode = m;
    try { localStorage.setItem(MODE_KEY, m); } catch { /* storage unavailable */ }
  }
  let tweakTimer: ReturnType<typeof setTimeout> | undefined;
  function tweaked(v: string) {
    workflow.edit(v);
    clearTimeout(tweakTimer);
    tweakTimer = setTimeout(run, 120);
  }
  let runState = $state<RunState>("idle");
  let toast = $state("");
  let loadedKey: string | null = null;
  const workflow = createSketchWorkflow(untrack(() => ({ ...sketch })), {
    changed: (state) => { sketch = state.sketch; code = state.sketch.code; saved = state.saved; },
    saveFailed: () => flash("Couldn't save on this device (storage full or blocked). Use Share to keep a copy."),
    autoRun: () => app.autoRun && active, validate: parse, run,
  });

  let pendingRun = $state(false);
  $effect(() => {
    if (stage && pendingRun) {
      pendingRun = false;
      run();
    }
  });

  // Portrait, landscape and desktop each mount their own stage. Crossing
  // between them used to leave a blank canvas until the learner pressed Run.
  let stageMounts = 0;
  $effect(() => {
    if (!stage) return;
    stageMounts += 1;
    if (stageMounts === 1) return;
    untrack(() => run());
  });

  function run() {
    workflow.cancelRun();
    if (!stage) {
      pendingRun = true;
      return;
    }
    stage.run(code);
  }

  function onError(e: Explained | null) {
    edError = e?.where ? { ...e.where, message: [`'${e.name}`, e.hint ?? e.help, e.tip].filter(Boolean).join(" — ") } : null;
  }

  const codeChanged = (value: string) => workflow.edit(value);
  const persist = () => workflow.save();
  const flush = () => { void workflow.flush(); };

  onMount(() => {
    let held = false;
    const onHide = () => {
      const hidden = document.visibilityState === "hidden";
      if (hidden) flush();
      const next = sketchHold(runState, hidden, held);
      held = next.held;
      if (next.action === "pause") stage?.pause();
      else if (next.action === "resume") stage?.resume();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      workflow.dispose();
    };
  });

  function open(s: Sketch, runNow = true) {
    flush();
    sharedNote = "";
    sharedThumb = "";
    workflow.open(s);
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
    const draft = app.takeDraft();
    const s: Sketch = {
      id: newId(),
      name: draft?.name ?? "Untitled sketch",
      code: draft?.code ?? "background 20\ncircle[center;100;`coral]\n",
      created: Date.now(),
      updated: Date.now(),
      ...(draft?.from ? { from: draft.from } : {}),
    };
    open(s);
    app.go(`sketch/${s.id}`);
    persist();
  }

  let sharedNote = $state("");
  let sharedThumb = $state("");

  function showShared(name: string, code: string, key: string) {
    const note = shareOpenedNote(name);
    sharedNote = note;
    sharedThumb = "";
    thumbnail("share:" + key, code).then((u) => {
      if (sharedNote === note) sharedThumb = u;
    });
  }

  let shareWarn = $state("");
  let pendingShare = "";
  let cancelShare = $state<HTMLButtonElement>();

  async function copyShare(url: string) {
    shareWarn = "";
    pendingShare = "";
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied — the whole sketch is inside it.");
    } catch {
      prompt("Copy this link:", url);
    }
  }

  async function share() {
    const url = shareUrl(location.origin, location.pathname, sketch.name, code);
    const warning = shareWarning(url);
    if (warning) {
      pendingShare = url;
      shareWarn = warning;
      await tick();
      cancelShare?.focus();
      return;
    }
    void copyShare(url);
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
    let routeId = parts[0];
    if (parts[0] === "shared") {
      const d = parts[1] ? decodeShare(parts[1]) : null;
      if (d) {
        const key = shareKey(d.name, d.code);
        const copy = findSharedCopy(await listSketches().catch(() => []), key, d.code);
        const s: Sketch = copy ?? { id: newId(), name: d.name, code: d.code, created: Date.now(), updated: Date.now(), share: key };
        open(s);
        showShared(s.name, s.code, key);
        if (!copy) persist();
        history.replaceState(null, "", `#/sketch/${s.id}`);
        // replaceState fires no hashchange, so update the route ourselves
        loadedKey = s.id;
        app.route = { tab: "sketch", parts: [s.id] };
        return;
      }
      sharedNote = "";
      flash("This share link is damaged or incomplete, so it couldn't be opened.");
      history.replaceState(null, "", "#/sketch");
      loadedKey = "";
      app.route = { tab: "sketch", parts: [] };
      routeId = "";
    }
    if (parts[0] === "new") return newSketch();
    const id = routeId || localStorage.getItem("qanvas:lastSketch") || "";
    const s = id ? await getSketch(id) : undefined;
    const recovered = id ? recoverPending(id, s, readPending(id)) : null;
    if (recovered) {
      open(recovered, active);
      persist();
    } else if (s) open(s, active);
    else open(sketch, active);
  }

  onMount(loadRoute);
  $effect(() => {
    if (app.route.tab === "sketch" && app.route.parts) untrack(() => void loadRoute());
  });

  // pause when hidden
  $effect(() => {
    if (!active) {
      stage?.stop?.();
      untrack(flush);
    }
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

{#snippet editorHeader(sub: boolean)}
  <div class="edhead">
    <input
      class="name"
      value={sketch.name}
      aria-label="Sketch name"
      onchange={(e) => {
        workflow.rename((e.currentTarget as HTMLInputElement).value);
      }}
    />
    <span class="saved" title={saved ? "Saved on this device" : "Saving…"}>{#if saved}<Check size={13} /> saved{:else}saving…{/if}</span>
    <div class="spacer"></div>
    <button class="btn sm ghost" onclick={() => { galleryTab = "examples"; galleryOpen = true; }} title="Examples"><Sparkles size={15} />{#if !mobile}<span class="lbl">Examples</span>{/if}</button>
    <button class="btn sm ghost" onclick={() => { galleryTab = "mine"; galleryOpen = true; }} title="My sketches"><FolderOpen size={15} />{#if !mobile}<span class="lbl">Mine</span>{/if}</button>
    <button class="btn sm ghost icon" onclick={newSketch} title="New sketch" aria-label="New sketch"><Plus size={16} /></button>
    <button class="btn sm ghost icon" onclick={share} title="Copy a share link" aria-label="Share"><Share size={15} /></button>
  </div>
  {#if sub}
  <div class="edsub">
    <label class="toggle" title="Re-run automatically as you type">
      <input type="checkbox" checked={app.autoRun} onchange={(e) => app.setAutoRun((e.currentTarget as HTMLInputElement).checked)} />
      <Wand size={13} /> live
    </label>
    <div class="spacer"></div>
    <button class="btn sm go" onclick={run} title="Run (Ctrl+Enter)"><Play size={14} /> Run</button>
  </div>
  {/if}
{/snippet}

{#snippet editor()}
  <div class="edbody">
    <CodeEditor value={code} onChange={codeChanged} onRun={run} error={edError} bind:view label="Sketch code" />
  </div>
{/snippet}

<div class="studio" class:hidden={!active}>
  {#if sharedNote}
    <div class="arrival" role="status">
      {#if sharedThumb}<img src={sharedThumb} alt="" />{:else}<span class="arrival-ph" aria-hidden="true"></span>{/if}
      <p>{sharedNote}</p>
      <button class="btn sm ghost" onclick={() => (sharedNote = "")}>Dismiss</button>
    </div>
  {/if}
  {#if mobile}
    {@render editorHeader(false)}
    <div class="mcanvas">
      <Stage bind:this={stage} name={sketch.name} {onError} onState={(s) => (runState = s)} onRunRequest={run} compact hideToolbar />
    </div>
    <div class="mbar">
      <div class="seg" role="tablist" aria-label="How to change the code">
        <button role="tab" aria-selected={mmode === "tweak"} class:on={mmode === "tweak"} onclick={() => setMode("tweak")}><Hand size={17} /> Tweak</button>
        <button role="tab" aria-selected={mmode === "type"} class:on={mmode === "type"} onclick={() => setMode("type")}><Keyboard size={17} /> Type</button>
      </div>
      <button class="btn sm icon" onclick={() => (app.consoleOpen = !app.consoleOpen)} aria-label="Console"><Terminal size={18} /></button>
      <button class="btn sm go" onclick={run}><Play size={16} /> Run</button>
    </div>
    <div class="mbody">
      {#if mmode === "tweak"}
        {#key sketch.id}
          <TweakCode {code} onChange={tweaked} hideComments hint="Tap a number or colour to change it. Switch to Type to write code." label="Sketch code" />
        {/key}
      {:else}
        {@render editor()}
        <SymbolBar onInsert={insert} />
      {/if}
    </div>
  {:else if phoneLand}
    <div class="land">
      <div class="col">
        {@render editorHeader(true)}
        {@render editor()}
        <SymbolBar onInsert={insert} flush />
      </div>
      <Stage bind:this={stage} name={sketch.name} {onError} onState={(s) => (runState = s)} onRunRequest={run} />
    </div>
  {:else}
    <PaneGroup direction="horizontal" autoSaveId="qanvas-studio-h">
      <Pane defaultSize={46} minSize={25}>
        <div class="col">
          {@render editorHeader(true)}
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

{#if shareWarn}
  <div class="share-warn" role="alertdialog" aria-label="Long share link">
    <p>{shareWarn}</p>
    <div class="warn-actions">
      <button class="btn sm" bind:this={cancelShare} onclick={() => (shareWarn = "")}>Cancel</button>
      <button class="btn sm primary" onclick={() => copyShare(pendingShare)}>Copy anyway</button>
    </div>
  </div>
{/if}

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
  .arrival {
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
    background: var(--surface);
  }
  .arrival img,
  .arrival-ph {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    object-fit: cover;
    background: #15141d;
    flex: none;
  }
  .arrival p {
    margin: 0;
    flex: 1;
    min-width: 0;
    font-size: 14px;
    font-weight: 600;
  }
  .col {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--code-bg);
    container-type: inline-size;
  }
  /* a narrow editor pane (dragged resizer, or a phone on its side): icons only, so the name stays readable */
  @container (max-width: 420px) {
    .lbl {
      display: none;
    }
  }
  .land {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(240px, 0.85fr);
  }
  .land .col {
    min-width: 0;
    border-right: 1px solid var(--line);
  }
  .land .lbl {
    display: none;
  }
  .land > :global(.stage) {
    min-width: 0;
    min-height: 0;
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
  /* ---------- phone: canvas on top, code below ---------- */
  .mcanvas {
    flex: none;
    height: min(calc(100vw + 30px), 44dvh);
    border-bottom: 1px solid var(--line);
  }
  .mbar {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .seg {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
  .seg button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--text-2);
    font-weight: 600;
    font-size: 14.5px;
    touch-action: manipulation;
  }
  .seg button.on {
    background: var(--key);
    color: var(--text);
    box-shadow: 0 2px 0 var(--key-edge), inset 0 0 0 1px var(--key-line);
  }
  .mbody {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--code-bg);
  }
  .mbody > :global(.tweak),
  .mbody > :global(.edbody) {
    flex: 1;
    min-height: 0;
  }
  .share-warn {
    position: fixed;
    z-index: 80;
    left: 50%;
    bottom: calc(var(--dock-h) + 16px);
    transform: translateX(-50%);
    width: min(440px, calc(100vw - 24px));
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--line-strong);
    border-radius: 14px;
    box-shadow: var(--shadow-lg);
    padding: 14px 14px 12px;
  }
  .share-warn p {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.45;
  }
  .warn-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(var(--dock-h) + 24px);
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
