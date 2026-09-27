<script lang="ts">
  import type { Explained } from "../lib/explain";
  import { CircleX, Lightbulb } from "./icons";

  interface Props {
    e: Explained;
    compact?: boolean;
    onJump?: () => void;
  }
  let { e, compact = false, onJump }: Props = $props();
</script>

<div class="err" class:compact role="alert">
  <div class="head">
    <CircleX size={15} />
    <span class="name">'{e.name}</span>
    {#if e.help && !compact}<span class="help">{e.help}</span>{/if}
    {#if onJump && e.where}<button class="jump" onclick={onJump}>show me</button>{/if}
  </div>
  {#if e.caretLine !== undefined}
    <pre class="code"><span>{e.caretLine}</span>
<span class="caret">{" ".repeat(e.caretCol ?? 0)}{"^".repeat(e.caretLen ?? 1)}</span></pre>
  {/if}
  {#if e.hint}<p class="hint">{e.hint}</p>{/if}
  {#if e.tip}<p class="tip"><Lightbulb size={14} /> {e.tip}</p>{/if}
</div>

<style>
  .err {
    border: 1px solid color-mix(in srgb, var(--bad) 40%, transparent);
    background: var(--bad-soft);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--text);
    font-size: 13.5px;
  }
  .err.compact {
    padding: 8px 10px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--bad);
    flex-wrap: wrap;
  }
  .name {
    font-family: var(--font-code);
    font-weight: 700;
  }
  .help {
    color: var(--text-2);
    font-size: 12.5px;
  }
  .jump {
    margin-left: auto;
    border: none;
    background: none;
    color: var(--bad);
    font-weight: 600;
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
  }
  .code {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.45;
    overflow-x: auto;
    color: var(--text);
  }
  .caret {
    color: var(--bad);
    font-weight: 700;
  }
  .hint {
    margin: 0;
    line-height: 1.45;
  }
  .tip {
    margin: 0;
    display: flex;
    gap: 6px;
    align-items: flex-start;
    color: var(--text-2);
    font-size: 13px;
  }
  .tip :global(svg) {
    flex: none;
    margin-top: 2px;
    color: var(--warn);
  }
</style>
