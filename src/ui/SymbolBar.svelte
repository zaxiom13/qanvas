<script lang="ts">
  // q is glyph-heavy; phone keyboards hide most glyphs. This bar puts them one tap away.
  interface Props {
    onInsert: (t: string) => void;
  }
  let { onInsert }: Props = $props();
  const KEYS = [":", ";", "[", "]", "{", "}", "(", ")", "`", "\"", "+", "-", "*", "%", "#", "_", ",", "!", "?", "@", "$", "&", "|", "^", "~", "'", "/", "\\", "<", ">", "=", "."];
</script>

<div class="bar" role="toolbar" aria-label="q symbols">
  {#each KEYS as k (k)}
    <button type="button" onpointerdown={(e) => e.preventDefault()} onclick={() => onInsert(k)} aria-label={`insert ${k}`}>{k}</button>
  {/each}
</div>

<style>
  .bar {
    display: flex;
    gap: 5px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    overflow-x: auto;
    background: var(--surface);
    border-top: 1px solid var(--line);
    scrollbar-width: none;
  }
  .bar::-webkit-scrollbar {
    display: none;
  }
  button {
    flex: none;
    min-width: 38px;
    height: 38px;
    border-radius: 9px;
    border: 1px solid var(--line);
    background: var(--surface-2);
    font-family: var(--font-code);
    font-size: 17px;
    color: var(--text);
    -webkit-tap-highlight-color: transparent;
  }
  button:active {
    background: var(--accent);
    color: var(--accent-text);
  }
</style>
