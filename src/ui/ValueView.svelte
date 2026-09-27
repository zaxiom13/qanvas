<script lang="ts">
  import { NIL, QAtom, QDict, QFn, QTable, QVec, isKeyed, items, type QValue } from "../q/index";
  import { atomText, cellText, inlineText, isNumVec, numRows, shapeLabel, typeColor } from "../lib/shape";
  import ValueView from "./ValueView.svelte";
  import MiniPlot from "./MiniPlot.svelte";

  interface Props {
    value: QValue;
    depth?: number;
    showLabel?: boolean;
  }
  let { value, depth = 0, showLabel = true }: Props = $props();

  const MAX_CELLS = 48;
  const MAX_ROWS = 40;

  const kind = $derived.by(() => {
    const v = value;
    if (v === NIL) return "nil";
    if (v instanceof QAtom) return "atom";
    if (v instanceof QVec) {
      if (v.t === 10) return "string";
      if (v.t > 0) return "vec";
      if (numRows(v) && (v.d.length > 1 || depth === 0)) return "matrix";
      return "list";
    }
    if (v instanceof QTable) return "table";
    if (v instanceof QDict) return isKeyed(v) ? "keyed" : "dict";
    if (v instanceof QFn) return "fn";
    return "other";
  });
</script>

<div class="vv" class:nested={depth > 0}>
  {#if showLabel && depth === 0}
    <div class="label">
      <span class="dot" style:background={typeColor(value instanceof QAtom || value instanceof QVec ? value.t : value instanceof QFn ? 100 : 0)}></span>
      {shapeLabel(value)}
    </div>
  {/if}

  {#if kind === "nil"}
    <span class="faint mono">::</span>
  {:else if kind === "atom"}
    {@const a = value as QAtom}
    <span class="cell atom" style:--c={typeColor(a.t)} title={shapeLabel(a)}>{atomText(a)}</span>
  {:else if kind === "string"}
    {@const s = (value as QVec).d as string}
    {#if s.length <= 24 && depth === 0}
      <div class="strip">
        {#each Array.from(s) as ch, i (i)}
          <span class="cell char" style:--c="var(--type-char)" title={`index ${i}`}>{ch === " " ? "␣" : ch}</span>
        {/each}
      </div>
    {:else}
      <span class="cell str" style:--c="var(--type-char)">"{s.length > 200 ? s.slice(0, 200) + "…" : s}"</span>
    {/if}
  {:else if kind === "vec"}
    {@const v = value as QVec}
    <div class="strip">
      {#each Array.from({ length: Math.min(v.d.length, MAX_CELLS) }) as _, i (i)}
        {@const x = (v.d as any)[i]}
        <span
          class="cell"
          class:bool={v.t === 1}
          class:on={v.t === 1 && x}
          class:nul={typeof x === "number" && x !== x}
          style:--c={typeColor(v.t)}
          title={`index ${i}`}>{v.t === 1 ? "" : cellText(v.t, x)}</span>
      {/each}
      {#if v.d.length > MAX_CELLS}<span class="more">+{v.d.length - MAX_CELLS} more</span>{/if}
      {#if v.d.length === 0}<span class="faint mono">empty</span>{/if}
    </div>
    {#if depth === 0 && isNumVec(v) && v.d.length >= 3}
      <MiniPlot kind="line" data={[v.d as Float64Array]} />
    {/if}
  {:else if kind === "matrix"}
    {@const rows = numRows(value)!}
    {@const t = ((value as QVec).d as QVec[])[0].t}
    <div class="grid" style:--cols={Math.min(rows[0].length, 16)}>
      {#each rows.slice(0, 12) as r, i (i)}
        <div class="row">
          {#each Array.from(r.slice(0, 16)) as x, j (j)}
            <span class="cell" class:nul={x !== x} style:--c={typeColor(t)}>{cellText(t, x)}</span>
          {/each}
          {#if r.length > 16}<span class="more">+{r.length - 16}</span>{/if}
        </div>
      {/each}
      {#if rows.length > 12}<span class="more">+{rows.length - 12} rows</span>{/if}
    </div>
    {#if depth === 0 && rows.length === 2 && rows[0].length >= 2}
      <MiniPlot kind="scatter" data={rows} />
    {:else if depth === 0 && rows.length >= 4 && rows[0].length >= 4}
      <MiniPlot kind="heat" data={rows} />
    {/if}
  {:else if kind === "list"}
    {@const its = (value as QVec).d as QValue[]}
    <div class="stack">
      {#each its.slice(0, MAX_ROWS) as it, i (i)}
        <div class="item">
          <span class="idx">{i}</span>
          {#if depth < 3}<ValueView value={it} depth={depth + 1} />{:else}<span class="mono small">{inlineText(it)}</span>{/if}
        </div>
      {/each}
      {#if its.length > MAX_ROWS}<span class="more">+{its.length - MAX_ROWS} more</span>{/if}
      {#if its.length === 0}<span class="faint mono">()</span>{/if}
    </div>
  {:else if kind === "dict"}
    {@const d = value as QDict}
    {@const ks = items(d.k)}
    {@const vs = items(d.v)}
    <div class="dict">
      {#each ks.slice(0, MAX_ROWS) as k, i (i)}
        <div class="kv">
          <span class="key"><ValueView value={k} depth={depth + 1} /></span>
          <span class="arrow">→</span>
          {#if depth < 3}<ValueView value={vs[i]} depth={depth + 1} />{:else}<span class="mono small">{inlineText(vs[i])}</span>{/if}
        </div>
      {/each}
      {#if ks.length > MAX_ROWS}<span class="more">+{ks.length - MAX_ROWS} more</span>{/if}
    </div>
  {:else if kind === "table" || kind === "keyed"}
    {@const kt = kind === "keyed" ? ((value as QDict).k as QTable) : null}
    {@const vt = kind === "keyed" ? ((value as QDict).v as QTable) : (value as QTable)}
    {@const cols = [...(kt?.cols ?? []), ...vt.cols]}
    {@const data = [...(kt?.data ?? []), ...vt.data]}
    {@const n = vt.n}
    <div class="tablewrap scroll">
      <table>
        <thead>
          <tr>
            {#each cols as c, j (j)}
              {@const col = data[j]}
              <th class:key={kt && j < kt.cols.length} style:--c={typeColor(col instanceof QVec ? col.t : 0)}>{c}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each Array.from({ length: Math.min(n, MAX_ROWS) }) as _, i (i)}
            <tr>
              {#each data as col, j (j)}
                {@const cv = col as QVec}
                <td class:key={kt && j < kt.cols.length}>
                  {#if cv.t === 0}{inlineText((cv.d as QValue[])[i])}{:else}{cellText(cv.t, (cv.d as any)[i])}{/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
      {#if n > MAX_ROWS}<div class="more">+{n - MAX_ROWS} more rows</div>{/if}
    </div>
  {:else if kind === "fn"}
    <code class="fn">{inlineText(value)}</code>
  {/if}
</div>

<style>
  .vv {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .vv.nested {
    gap: 3px;
  }
  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .strip {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    align-items: center;
  }
  .cell {
    --c: var(--type-list);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    height: 26px;
    padding: 0 6px;
    border-radius: 6px;
    font-family: var(--font-code);
    font-size: 12.5px;
    color: var(--text);
    background: color-mix(in srgb, var(--c) 13%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
    white-space: nowrap;
  }
  .cell.atom {
    height: 30px;
    font-size: 14px;
    padding: 0 10px;
    align-self: flex-start;
  }
  .cell.char {
    min-width: 22px;
    padding: 0 4px;
  }
  .cell.str {
    white-space: pre-wrap;
    height: auto;
    min-height: 26px;
    padding: 3px 8px;
    align-self: flex-start;
  }
  .cell.bool {
    min-width: 18px;
    width: 18px;
    height: 18px;
    padding: 0;
    border-radius: 50%;
  }
  .cell.bool.on {
    background: var(--c);
  }
  .cell.nul {
    opacity: 0.45;
    border-style: dashed;
  }
  .more {
    font-size: 11.5px;
    color: var(--text-3);
    font-family: var(--font-code);
    padding: 0 4px;
  }
  .grid {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .row {
    display: flex;
    gap: 3px;
  }
  .grid .cell {
    min-width: 34px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-left: 2px solid var(--line);
    padding-left: 8px;
  }
  .item {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .idx {
    font-family: var(--font-code);
    font-size: 10.5px;
    color: var(--text-3);
    min-width: 12px;
    padding-top: 6px;
  }
  .dict {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .kv {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .arrow {
    color: var(--text-3);
    padding-top: 4px;
  }
  .tablewrap {
    max-width: 100%;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
  }
  table {
    border-collapse: collapse;
    font-family: var(--font-code);
    font-size: 12.5px;
  }
  th {
    --c: var(--type-list);
    text-align: left;
    font-weight: 650;
    padding: 6px 12px;
    border-bottom: 2px solid color-mix(in srgb, var(--c) 55%, transparent);
    color: var(--text);
    white-space: nowrap;
  }
  td {
    padding: 4px 12px;
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
    color: var(--text);
  }
  tr:last-child td {
    border-bottom: none;
  }
  th.key,
  td.key {
    background: var(--surface-2);
  }
  .fn {
    font-size: 12.5px;
    padding: 4px 8px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--type-fn) 10%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--type-fn) 35%, transparent);
    white-space: pre-wrap;
    align-self: flex-start;
  }
  .mono {
    font-family: var(--font-code);
  }
  .small {
    font-size: 12px;
  }
</style>
