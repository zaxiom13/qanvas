<script lang="ts" module>
  import { QDict, QTable, QVec, isKeyed, type QValue } from "../q/index";
  import { isNumVec, numRows } from "../lib/shape";

  /** Does this value have a picture worth showing? */
  export function hasVisual(v: QValue): boolean {
    if (v instanceof QTable || v instanceof QDict) return true;
    if (v instanceof QVec && v.t === 1 && v.d.length > 1) return true;
    if (isNumVec(v) && v.d.length >= 3) return true;
    const rows = numRows(v);
    if (rows && rows.length === 2 && rows[0].length >= 2) return true;
    if (rows && rows.length >= 4 && rows[0].length >= 4) return true;
    return false;
  }
  export const isTabular = (v: QValue) => v instanceof QTable || v instanceof QDict;
  void isKeyed;
</script>

<script lang="ts">
  import { cellText, inlineText } from "../lib/shape";
  import MiniPlot from "./MiniPlot.svelte";

  let { value }: { value: QValue } = $props();
  const MAX_ROWS = 40;
</script>

{#if value instanceof QVec && value.t === 1}
  <div class="bits" aria-label="booleans">
    {#each Array.from((value.d as Float64Array).slice(0, 120)) as b, i (i)}<span class="bit" class:on={b} title={`index ${i}`}></span>{/each}
    {#if value.d.length > 120}<span class="more">+{value.d.length - 120}</span>{/if}
  </div>
{:else if isNumVec(value)}
  <MiniPlot kind="line" data={[value.d as Float64Array]} />
{:else if value instanceof QTable || (value instanceof QDict && isKeyed(value))}
  {@const kt = value instanceof QDict ? (value.k as QTable) : null}
  {@const vt = value instanceof QDict ? (value.v as QTable) : value}
  {@const cols = [...(kt?.cols ?? []), ...vt.cols]}
  {@const data = [...(kt?.data ?? []), ...vt.data]}
  <div class="tablewrap scroll">
    <table>
      <thead><tr>{#each cols as c, j (j)}<th class:key={kt && j < kt.cols.length}>{c}</th>{/each}</tr></thead>
      <tbody>
        {#each Array.from({ length: Math.min(vt.n, MAX_ROWS) }) as _, i (i)}
          <tr>
            {#each data as col, j (j)}
              {@const cv = col as QVec}
              <td class:key={kt && j < kt.cols.length}>{cv.t === 0 ? inlineText((cv.d as QValue[])[i]) : cellText(cv.t, (cv.d as any)[i]).replace(/^`/, "")}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    {#if vt.n > MAX_ROWS}<div class="more">+{vt.n - MAX_ROWS} more rows</div>{/if}
  </div>
{:else if value instanceof QDict}
  {@const ks = value.k as QVec}
  {@const vs = value.v}
  <div class="tablewrap scroll">
    <table>
      <tbody>
        {#each Array.from({ length: Math.min(ks.d.length, MAX_ROWS) }) as _, i (i)}
          <tr>
            <td class="key">{ks.t === 0 ? inlineText((ks.d as QValue[])[i]) : cellText(ks.t, (ks.d as any)[i]).replace(/^`/, "")}</td>
            <td>{vs instanceof QVec ? (vs.t === 0 ? inlineText((vs.d as QValue[])[i]) : cellText(vs.t, (vs.d as any)[i])) : ""}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  {@const rows = numRows(value)}
  {#if rows && rows.length === 2}<MiniPlot kind="scatter" data={rows} />{:else if rows}<MiniPlot kind="heat" data={rows} />{/if}
{/if}

<style>
  .bits {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .bit {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1.5px solid var(--type-bool);
  }
  .bit.on {
    background: var(--type-bool);
  }
  .more {
    font-size: 11.5px;
    color: var(--text-3);
    font-family: var(--font-code);
  }
  .tablewrap {
    max-width: 100%;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    width: fit-content;
  }
  table {
    border-collapse: collapse;
    font-family: var(--font-code);
    font-size: 12.5px;
  }
  th {
    text-align: left;
    font-weight: 650;
    padding: 6px 14px;
    border-bottom: 2px solid var(--line-strong);
    white-space: nowrap;
  }
  td {
    padding: 4px 14px;
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
  }
  tr:last-child td {
    border-bottom: none;
  }
  .key {
    background: var(--surface-2);
    font-weight: 600;
  }
</style>
