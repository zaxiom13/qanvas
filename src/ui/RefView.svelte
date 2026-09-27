<script lang="ts">
  import { tick } from "svelte";
  import { app } from "../lib/app.svelte";
  import { KIND_LABEL, REFERENCE, REF_BY_NAME, type RefEntry } from "../content/reference";
  import { runHeadless } from "../qanvas/headless";
  import { highlightToHtml } from "../editor/qlang";
  import { explainError } from "../lib/explain";
  import type { QValue } from "../q/index";
  import ErrorCard from "./ErrorCard.svelte";
  import ValueView, { hasVisual, isTabular } from "./ValueView.svelte";
  import { ArrowLeft, BookOpen, Search, Terminal } from "./icons";

  let { mobile }: { mobile: boolean } = $props();

  let query = $state("");
  let kindFilter = $state<string>("all");
  let detail = $state<HTMLElement>();

  const KINDS: [string, string][] = [
    ["all", "All"],
    ["q", "q language"],
    ["draw", "Drawing"],
    ["helper", "Helpers"],
    ["input", "Inputs"],
    ["complex", "Complex"],
  ];
  const kindOf = (r: RefEntry) => (r.kind === "glyph" || r.kind === "keyword" || r.kind === "iterator" || r.kind === "system" ? "q" : r.kind);

  const selected = $derived(REF_BY_NAME.get(decodeURIComponent(app.route.parts.join("/"))));

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return REFERENCE.filter((r) => {
      if (kindFilter !== "all" && kindOf(r) !== kindFilter) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q) || r.sig.toLowerCase().includes(q);
    });
  });

  const groups = $derived.by(() => {
    const m = new Map<string, RefEntry[]>();
    for (const r of filtered) {
      const k = r.cat;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m.entries()];
  });

  interface ExOut {
    code: string;
    text: string;
    value?: QValue;
    image?: string;
    error?: ReturnType<typeof explainError>;
  }

  const results = $derived.by((): ExOut[] => {
    const r = selected;
    if (!r) return [];
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    const h = runHeadless("", { ctx, scale: 0.5 });
    const s = h.session;
    const out: ExOut[] = [];
    for (const code of r.ex) {
      const before = JSON.stringify(h.api.drawn);
      s.deadline = performance.now() + 1500;
      const res = s.evaluate(code);
      s.deadline = 0;
      const drewSomething = JSON.stringify(h.api.drawn) !== before;
      const o: ExOut = { code, text: res.text, value: res.silent ? undefined : res.value };
      if (res.error) o.error = explainError(res.error, code);
      if (drewSomething) {
        o.image = canvas.toDataURL("image/webp", 0.85);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#15141d";
        ctx.fillRect(0, 0, 300, 300);
        ctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
        h.api.reset();
        h.api.style.ink = { kind: "one", css: "#f6f1e7" };
      }
      out.push(o);
    }
    return out;
  });

  $effect(() => {
    if (selected) tick().then(() => detail?.scrollTo({ top: 0 }));
  });

  function pick(r: RefEntry) {
    app.go(`ref/${encodeURIComponent(r.name)}`);
  }
</script>

<div class="ref" class:mobile>
  {#if !mobile || !selected}
    <nav class="side" aria-label="Reference index">
      <div class="search">
        <Search size={16} />
        <input bind:value={query} placeholder="Search — try til, where, circle, table…" aria-label="Search the reference" />
      </div>
      <div class="kinds" role="tablist">
        {#each KINDS as [k, label] (k)}
          <button role="tab" aria-selected={kindFilter === k} class:on={kindFilter === k} onclick={() => (kindFilter = k)}>{label}</button>
        {/each}
      </div>
      <div class="index scroll">
        {#each groups as [cat, list] (cat)}
          <div class="cat">{cat}</div>
          {#each list as r (r.name)}
            <button class="entry" class:on={selected?.name === r.name} onclick={() => pick(r)}>
              <code class="nm">{r.name}</code>
              <span class="sm">{r.summary}</span>
            </button>
          {/each}
        {/each}
        {#if !filtered.length}<p class="none">Nothing matches “{query}”.</p>{/if}
      </div>
    </nav>
  {/if}

  {#if selected}
    <article class="detail scroll" bind:this={detail}>
      <div class="inner">
        {#if mobile}<button class="btn ghost sm" onclick={() => app.go("ref")}><ArrowLeft size={15} /> Index</button>{/if}
        <div class="chips">
          <span class="chip">{KIND_LABEL[selected.kind]}</span>
          <span class="chip">{selected.cat}</span>
        </div>
        <h1><code>{selected.name}</code></h1>
        <pre class="sig">{@html highlightToHtml(selected.sig)}</pre>
        <p class="summary">{selected.summary}</p>
        {#if selected.detail}<p class="more">{selected.detail}</p>{/if}

        {#if results.length}
          <h2>Examples</h2>
          <div class="examples">
            {#each results as ex, i (i)}
              <div class="ex">
                <div class="code">
                  <span class="prompt">q)</span>
                  <code>{@html highlightToHtml(ex.code)}</code>
                  <button class="btn ghost sm icon try" title="Try in the console" aria-label="Try in the console" onclick={() => app.tryInConsole(ex.code)}><Terminal size={14} /></button>
                </div>
                {#if ex.error}
                  <ErrorCard e={ex.error} compact />
                {:else if ex.image}
                  <img class="shot" src={ex.image} alt={`Result of ${ex.code}`} />
                {:else if ex.text}
                  {#if !ex.value || !isTabular(ex.value)}<pre class="out">{ex.text}</pre>{/if}
                  {#if ex.value && hasVisual(ex.value)}<div class="vis"><ValueView value={ex.value} /></div>{/if}
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if selected.see?.length}
          <h2>See also</h2>
          <div class="see">
            {#each selected.see.filter((n) => REF_BY_NAME.has(n)) as n (n)}
              <button class="btn sm" onclick={() => pick(REF_BY_NAME.get(n)!)}><code>{n}</code></button>
            {/each}
          </div>
        {/if}
      </div>
    </article>
  {:else if !mobile}
    <section class="welcome">
      <BookOpen size={40} />
      <h2>The q reference, alive</h2>
      <p>Every primitive, keyword and Qanvas function — each example runs right here, and drawings draw.</p>
      <div class="starters">
        {#each ["til", "where", "#", "each", "/", "select", "circle", "hsb", "noise", ".cx.sq"] as n (n)}
          <button class="btn sm" onclick={() => pick(REF_BY_NAME.get(n)!)}><code>{n}</code></button>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .ref {
    height: 100%;
    display: grid;
    grid-template-columns: 340px minmax(0, 1fr);
    min-height: 0;
  }
  .ref.mobile {
    grid-template-columns: 1fr;
  }
  .side {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--line);
    background: var(--surface);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 12px 8px;
    padding: 0 12px;
    height: 40px;
    border: 1px solid var(--line);
    border-radius: 11px;
    background: var(--surface-2);
    color: var(--text-3);
  }
  .search:focus-within {
    border-color: var(--accent);
  }
  .search input {
    flex: 1;
    border: none;
    background: none;
    outline: none;
    font: inherit;
    font-size: 14px;
    color: var(--text);
    min-width: 0;
  }
  .kinds {
    display: flex;
    gap: 4px;
    padding: 0 12px 8px;
    flex-wrap: wrap;
  }
  .kinds button {
    border: 1px solid var(--line);
    background: transparent;
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
  }
  .kinds button.on {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }
  .index {
    flex: 1;
    min-height: 0;
    padding: 0 8px 30px;
  }
  .cat {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    margin: 14px 8px 4px;
  }
  .entry {
    display: flex;
    flex-direction: column;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 6px 8px;
    border-radius: 8px;
    cursor: pointer;
  }
  .entry:hover {
    background: var(--surface-2);
  }
  .entry.on {
    background: var(--accent-soft);
  }
  .nm {
    font-size: 13.5px;
    font-weight: 650;
    color: var(--text);
  }
  .sm {
    font-size: 12.5px;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .none {
    color: var(--text-3);
    padding: 12px;
  }
  .detail {
    min-height: 0;
  }
  .inner {
    max-width: 780px;
    margin: 0 auto;
    padding: 30px 28px 60px;
  }
  .mobile .inner {
    padding: 14px 16px 40px;
  }
  .chips {
    display: flex;
    gap: 6px;
    margin: 8px 0 10px;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 40px;
    letter-spacing: -0.02em;
  }
  h1 code {
    font-size: 1em;
  }
  .sig {
    margin: 0 0 14px;
    font-size: 15px;
    padding: 10px 14px;
    border-radius: 10px;
    background: var(--code-bg);
    border: 1px solid var(--line);
    white-space: pre-wrap;
  }
  .summary {
    font-size: 17px;
    line-height: 1.55;
    margin: 0 0 8px;
  }
  .more {
    color: var(--text-2);
    line-height: 1.6;
  }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-3);
    margin: 28px 0 10px;
  }
  .examples {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .ex {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .code {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-family: var(--font-code);
    font-size: 13.5px;
  }
  .code code {
    flex: 1;
    white-space: pre-wrap;
  }
  .prompt {
    color: var(--accent);
    font-weight: 700;
  }
  .try {
    align-self: center;
  }
  .out {
    margin: 0;
    font-size: 13px;
    white-space: pre;
    overflow-x: auto;
  }
  .vis {
    padding-top: 4px;
  }
  .shot {
    width: 180px;
    height: 180px;
    border-radius: 10px;
    border: 1px solid var(--line);
  }
  .see {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: var(--text-2);
    padding: 20px;
  }
  .welcome h2 {
    all: unset;
    font-size: 24px;
    font-weight: 700;
    color: var(--text);
    margin: 12px 0 6px;
  }
  .welcome p {
    max-width: 44ch;
    line-height: 1.5;
  }
  .starters {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 12px;
  }
</style>
