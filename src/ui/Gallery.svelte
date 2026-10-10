<script lang="ts">
  import { Dialog } from "bits-ui";
  import { EXAMPLES, LEVELS, type Example } from "../content/examples";
  import { sketchesFromBundle, sketchesToBundle } from "../lib/backup";
  import { deleteSketch, listSketches, saveSketch, type Sketch } from "../lib/storage";
  import { thumbnail } from "../lib/thumbs";
  import { Download, Trash, Upload, X } from "./icons";

  interface Props {
    open: boolean;
    tab: "examples" | "mine";
    onPick: (e: Example) => void;
    onOpenSketch: (s: Sketch) => void;
  }
  let { open = $bindable(), tab, onPick, onOpenSketch }: Props = $props();
  let current = $state<"examples" | "mine">("examples");
  let mine = $state<Sketch[]>([]);
  let thumbs = $state<Record<string, string>>({});
  let note = $state("");
  let noteBad = $state(false);
  let fileInput = $state<HTMLInputElement>();

  $effect(() => {
    if (!open) return;
    current = tab;
    listSketches().then((l) => (mine = l));
    for (const ex of EXAMPLES) thumbnail("ex:" + ex.id, ex.code).then((u) => (thumbs = { ...thumbs, [ex.id]: u }));
  });

  $effect(() => {
    if (!open || current !== "mine") return;
    for (const s of mine.slice(0, 40)) thumbnail("sk:" + s.id + ":" + s.updated, s.code).then((u) => (thumbs = { ...thumbs, ["sk:" + s.id]: u }));
  });

  function download() {
    const blob = new Blob([sketchesToBundle(mine)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qanvas-sketches.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const parsed = sketchesFromBundle(await file.text(), mine.map((s) => s.id));
    if ("error" in parsed) {
      noteBad = true;
      note = parsed.error;
      return;
    }
    for (const s of parsed.add) await saveSketch(s);
    mine = await listSketches();
    const n = parsed.add.length;
    noteBad = false;
    note = n
      ? `Imported ${n} sketch${n === 1 ? "" : "es"}${parsed.skipped ? `. Skipped ${parsed.skipped}.` : "."}`
      : parsed.skipped
        ? `Nothing new. Skipped ${parsed.skipped}.`
        : "Nothing new in that file.";
  }

  async function remove(s: Sketch) {
    if (!confirm(`Delete “${s.name}”? This can't be undone.`)) return;
    await deleteSketch(s.id);
    mine = mine.filter((m) => m.id !== s.id);
  }

  const ago = (t: number) => {
    const d = (Date.now() - t) / 1000;
    if (d < 60) return "just now";
    if (d < 3600) return `${Math.floor(d / 60)} min ago`;
    if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
    return new Date(t).toLocaleDateString();
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="gal-overlay" />
    <Dialog.Content class="gal">
      <header>
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected={current === "examples"} class:on={current === "examples"} onclick={() => (current = "examples")}>Examples</button>
          <button role="tab" aria-selected={current === "mine"} class:on={current === "mine"} onclick={() => (current = "mine")}>My sketches <span class="count">{mine.length}</span></button>
        </div>
        <Dialog.Title class="sr">Sketch gallery</Dialog.Title>
        <Dialog.Close class="btn ghost icon" aria-label="Close"><X size={18} /></Dialog.Close>
      </header>
      <div class="body scroll">
        {#if current === "examples"}
          {#each LEVELS as lvl (lvl)}
            {@const list = EXAMPLES.filter((e) => e.level === lvl)}
            {#if list.length}
              <h3>{lvl}</h3>
              <div class="grid">
                {#each list as ex (ex.id)}
                  <button class="card" onclick={() => onPick(ex)}>
                    <div class="thumb">
                      {#if thumbs[ex.id]}<img src={thumbs[ex.id]} alt="" />{:else}<div class="shimmer"></div>{/if}
                    </div>
                    <div class="meta">
                      <strong>{ex.title}</strong>
                      <span>{ex.blurb}</span>
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          {/each}
        {:else}
          <div class="tools">
            <button class="btn sm" onclick={download} disabled={!mine.length}><Download size={14} /> Export</button>
            <button class="btn sm" onclick={() => fileInput?.click()}><Upload size={14} /> Import</button>
            <input bind:this={fileInput} class="file" type="file" accept="application/json,.json" onchange={onFile} aria-label="Import a sketch backup" />
          </div>
          {#if note}<p class="note" class:bad={noteBad} role="status">{note}</p>{/if}
          {#if !mine.length}
          <div class="empty">
            <p>Nothing saved yet. Everything you make in the studio is saved on this device automatically. Import brings a backup back onto this device without removing what is already here.</p>
          </div>
          {:else}
          <div class="grid">
            {#each mine as s (s.id)}
              <div class="card mine">
                <button class="open" onclick={() => onOpenSketch(s)}>
                  <div class="thumb">
                    {#if thumbs["sk:" + s.id]}<img src={thumbs["sk:" + s.id]} alt="" />{:else}<div class="shimmer"></div>{/if}
                  </div>
                  <div class="meta">
                    <strong>{s.name}</strong>
                    <span>{ago(s.updated)}</span>
                  </div>
                </button>
                <button class="del btn sm ghost icon" aria-label={`Delete ${s.name}`} onclick={() => remove(s)}><Trash size={14} /></button>
              </div>
            {/each}
          </div>
          {/if}
        {/if}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.gal-overlay) {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, #06050a 55%, transparent);
    backdrop-filter: blur(3px);
    z-index: 90;
    animation: fade 160ms var(--ease);
  }
  :global(.gal) {
    position: fixed;
    z-index: 91;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(980px, calc(100vw - 24px));
    height: min(760px, calc(100dvh - 24px));
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow: var(--shadow-lg);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: pop 220ms var(--ease-spring);
  }
  @keyframes fade {
    from { opacity: 0; }
  }
  @keyframes pop {
    from { opacity: 0; transform: translate(-50%, -48%) scale(0.98); }
  }
  header {
    display: flex;
    align-items: center;
    padding: 10px 10px 10px 14px;
    border-bottom: 1px solid var(--line);
  }
  .tabs {
    display: flex;
    gap: 4px;
    margin-right: auto;
  }
  .tabs button {
    border: none;
    background: transparent;
    padding: 7px 12px;
    border-radius: 9px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
  }
  .tabs button.on {
    background: var(--surface-2);
    color: var(--text);
  }
  .count {
    font-size: 11px;
    color: var(--text-3);
    margin-left: 3px;
  }
  :global(.sr) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .body {
    padding: 6px 18px 24px;
    flex: 1;
    min-height: 0;
  }
  h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    margin: 18px 0 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 14px;
  }
  .card {
    text-align: left;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 14px;
    overflow: hidden;
    padding: 0;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    transition: transform 160ms var(--ease), box-shadow 160ms var(--ease), border-color 160ms;
    position: relative;
  }
  .card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
    border-color: var(--line-strong);
  }
  .card.mine {
    cursor: default;
  }
  .open {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
  }
  .thumb {
    aspect-ratio: 1.4;
    background: var(--stage);
    overflow: hidden;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    animation: fade 300ms var(--ease);
  }
  .shimmer {
    width: 100%;
    height: 100%;
    background: linear-gradient(100deg, #1b1a25 30%, #26243a 50%, #1b1a25 70%);
    background-size: 300% 100%;
    animation: sh 1.4s linear infinite;
  }
  @keyframes sh {
    from { background-position: 100% 0; }
    to { background-position: -100% 0; }
  }
  .meta {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .meta strong {
    font-size: 14px;
  }
  .meta span {
    font-size: 12.5px;
    color: var(--text-2);
    line-height: 1.4;
  }
  .del {
    position: absolute;
    top: 8px;
    right: 8px;
    background: color-mix(in srgb, var(--surface) 85%, transparent);
  }
  .empty {
    color: var(--text-2);
    padding: 30px 0;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin: 14px 0 4px;
  }
  .file {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .note {
    margin: 10px 0 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--good-soft);
    color: var(--text);
    font-size: 13px;
  }
  .note.bad {
    background: var(--bad-soft);
  }
</style>
