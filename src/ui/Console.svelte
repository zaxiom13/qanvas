<script lang="ts">
  import type { EditorView } from "@codemirror/view";
  import { tick } from "svelte";
  import { app, consoleHub, type ConsoleLine } from "../lib/app.svelte";
  import { explainError } from "../lib/explain";
  import { highlightToHtml } from "../editor/qlang";
  import { shapeLabel } from "../lib/shape";
  import { inline } from "../q/format";
  import CodeEditor from "./CodeEditor.svelte";
  import ErrorCard from "./ErrorCard.svelte";
  import ValueView from "./ValueView.svelte";
  import { Eye, Footprints, Trash } from "./icons";

  interface Props {
    compact?: boolean;
    title?: string;
    autofocus?: boolean;
  }
  let { compact = false, title = "Console", autofocus = false }: Props = $props();

  let input = $state("");
  let view = $state<EditorView | null>(null);
  let log: HTMLDivElement;
  let history: string[] = [];
  let hpos = 0;
  let expanded = $state<Record<number, boolean>>({});
  let traced = $state<Record<number, number>>({});

  function scrollDown() {
    tick().then(() => log?.scrollTo({ top: log.scrollHeight, behavior: "smooth" }));
  }

  export function run(src = input) {
    src = src.trim();
    if (!src) return;
    history = [...history.filter((h) => h !== src), src];
    hpos = history.length;
    consoleHub.push({ kind: "in", text: src });
    const t = consoleHub.target;
    const r = t.evaluate(src);
    if (!r) {
      consoleHub.push({ kind: "info", text: "Run a sketch first — this console talks to it." });
    } else if (r.error) {
      consoleHub.push({ kind: "err", text: r.errorText ?? "'" + r.error.qname, src, err: explainError(r.error, src) });
    } else if (!r.silent && r.value !== undefined) {
      consoleHub.push({ kind: "value", text: r.text, value: r.value, src });
    }
    input = "";
    view?.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "" } });
    scrollDown();
  }

  function explain(l: ConsoleLine) {
    if (!l.src) return;
    const t = consoleHub.target.trace(l.src);
    if (!t) return;
    consoleHub.lines = consoleHub.lines.map((x) => (x.id === l.id ? { ...x, trace: t.steps } : x));
    traced = { ...traced, [l.id]: 0 };
    scrollDown();
  }

  function onHistory(dir: -1 | 1): string | null {
    if (!history.length) return null;
    hpos = Math.max(0, Math.min(history.length, hpos + dir));
    return hpos === history.length ? "" : history[hpos];
  }

  $effect(() => {
    const inj = app.consoleInject;
    if (!inj) return;
    tick().then(() => run(inj.src));
  });

  $effect(() => {
    void consoleHub.lines.length;
    scrollDown();
  });

  $effect(() => {
    if (autofocus && view) view.focus();
  });

  const hl = (s: string) => highlightToHtml(s);
</script>

<section class="console" class:compact aria-label={title}>
  <header>
    <span class="title">{title}</span>
    <span class="target">{consoleHub.target.name === "scratch" ? "scratchpad" : "connected to " + consoleHub.target.name}</span>
    <button class="btn ghost sm icon" title="Clear console" aria-label="Clear console" onclick={() => consoleHub.clear()}><Trash size={14} /></button>
  </header>

  <div class="log scroll" bind:this={log} aria-live="polite">
    {#if !consoleHub.lines.length}
      <div class="empty">
        <p>Type any q expression and press <span class="kbd">Enter</span>.</p>
        <div class="tries">
          {#each ["til 10", "2*til 5", "sum 1 2 3", "`a`b`c!1 2 3", "([]x:1 2 3;y:`a`b`c)"] as s (s)}
            <button class="try" onclick={() => run(s)}><code>{s}</code></button>
          {/each}
        </div>
      </div>
    {/if}
    {#each consoleHub.lines as l (l.id)}
      {#if l.kind === "in"}
        <div class="line in"><span class="prompt">q)</span><code>{@html hl(l.text)}</code></div>
      {:else if l.kind === "value"}
        <div class="line value">
          <pre class="out">{l.text}</pre>
          <div class="tools">
            <button class="tool" class:on={expanded[l.id]} onclick={() => (expanded = { ...expanded, [l.id]: !expanded[l.id] })}>
              <Eye size={13} /> {l.value ? shapeLabel(l.value) : "value"}
            </button>
            {#if l.src && /[+\-*%&|,#_$?@.!~^<>=]|\b(til|sum|count|each|where|flip|neg|max|min|avg|reverse|first|last)\b/.test(l.src)}
              <button class="tool" class:on={!!l.trace} onclick={() => explain(l)}><Footprints size={13} /> explain</button>
            {/if}
          </div>
          {#if expanded[l.id] && l.value}
            <div class="visual"><ValueView value={l.value} /></div>
          {/if}
          {#if l.trace && l.src}
            <div class="trace">
              <div class="trace-head">q reads right to left — here's each step:</div>
              {#each l.trace as st, i (i)}
                <div class="step">
                  <span class="n">{i + 1}</span>
                  <code class="expr">{l.src.slice(0, st.s)}<mark>{l.src.slice(st.s, st.e)}</mark>{l.src.slice(st.e)}</code>
                  <span class="arrow">→</span>
                  <code class="res">{inline(st.value, 7).slice(0, 80)}</code>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if l.kind === "err"}
        <div class="line"><ErrorCard e={l.err!} {compact} /></div>
      {:else if l.kind === "out"}
        <pre class="line out">{l.text}</pre>
      {:else if l.kind === "info"}
        <div class="line info">{l.text}</div>
      {/if}
    {/each}
  </div>

  <div class="input">
    <span class="prompt">q)</span>
    <div class="ed">
      <CodeEditor
        value={input}
        onChange={(v) => (input = v)}
        onRun={() => run(view?.state.doc.toString() ?? input)}
        compact
        consoleMode
        {onHistory}
        bind:view
        placeholder="try: 2*til 5"
        label="q console input"
      />
    </div>
  </div>
</section>

<style>
  .console {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--surface);
  }
  header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px 6px 14px;
    border-bottom: 1px solid var(--line);
    min-height: 38px;
  }
  .title {
    font-weight: 650;
    font-size: 13px;
  }
  .target {
    font-size: 11.5px;
    color: var(--text-3);
    margin-right: auto;
  }
  .log {
    flex: 1;
    min-height: 0;
    padding: 10px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .empty {
    color: var(--text-2);
    font-size: 13.5px;
  }
  .empty p {
    margin: 4px 0 10px;
  }
  .tries {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .try {
    border: 1px solid var(--line);
    background: var(--surface-2);
    border-radius: 8px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .try:hover {
    border-color: var(--accent);
  }
  .line {
    font-family: var(--font-code);
    font-size: 13px;
    margin: 0;
  }
  .line.in {
    display: flex;
    gap: 8px;
    color: var(--text);
    margin-top: 4px;
  }
  .prompt {
    color: var(--accent);
    font-family: var(--font-code);
    font-weight: 700;
    font-size: 13px;
    user-select: none;
  }
  .out {
    margin: 0;
    white-space: pre;
    overflow-x: auto;
    color: var(--text);
    font-size: 13px;
    line-height: 1.5;
  }
  .line.info {
    color: var(--text-3);
    font-family: var(--font-ui);
    font-style: italic;
  }
  .tools {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .tool {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text-3);
    font-size: 11px;
    font-family: var(--font-ui);
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
    padding: 10px;
    border-radius: 10px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    font-family: var(--font-ui);
  }
  .trace {
    margin-top: 8px;
    border-left: 2px solid var(--accent);
    padding: 6px 0 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .trace-head {
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--text-2);
  }
  .step {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
    animation: stepIn 320ms var(--ease) both;
  }
  .step:nth-child(2) { animation-delay: 60ms; }
  .step:nth-child(3) { animation-delay: 180ms; }
  .step:nth-child(4) { animation-delay: 300ms; }
  .step:nth-child(5) { animation-delay: 420ms; }
  .step:nth-child(6) { animation-delay: 540ms; }
  .step:nth-child(n + 7) { animation-delay: 660ms; }
  @keyframes stepIn {
    from { opacity: 0; transform: translateX(-6px); }
  }
  .n {
    font-family: var(--font-ui);
    font-size: 10.5px;
    font-weight: 700;
    color: var(--accent-text);
    background: var(--accent);
    border-radius: 999px;
    min-width: 17px;
    height: 17px;
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
    padding: 0 1px;
  }
  .arrow {
    color: var(--text-3);
  }
  .res {
    color: var(--syn-number);
  }
  .input {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    border-top: 1px solid var(--line);
    padding: 2px 8px 2px 14px;
    background: var(--code-bg);
  }
  .input .prompt {
    padding-top: 11px;
  }
  .ed {
    flex: 1;
    min-width: 0;
    max-height: 160px;
    overflow: auto;
  }
  .ed :global(.cm-line) {
    padding-left: 2px;
  }
  :global(.tk-keyword) { color: var(--syn-keyword); font-weight: 550; }
  :global(.tk-api) { color: var(--syn-api); font-weight: 550; }
  :global(.tk-number) { color: var(--syn-number); }
  :global(.tk-string) { color: var(--syn-string); }
  :global(.tk-atom) { color: var(--syn-symbol); }
  :global(.tk-comment) { color: var(--syn-comment); font-style: italic; }
  :global(.tk-adverb) { color: var(--syn-adverb); font-weight: 700; }
  :global(.tk-operator) { color: var(--syn-op); font-weight: 600; }
  :global(.tk-local) { color: var(--syn-local); font-style: italic; }
  :global(.tk-bracket), :global(.tk-punct) { color: var(--syn-bracket); }
  :global(.tk-def) { font-weight: 650; }
</style>
