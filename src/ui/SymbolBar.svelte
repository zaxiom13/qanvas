<script lang="ts">
  // q is glyph-heavy; phone keyboards hide most glyphs. This bar puts them one tap away.
interface Props {
  onInsert: (t: string) => void;
  /** The shell already pads the safe area, so the bar should not add it again. */
  flush?: boolean;
}
let { onInsert, flush = false }: Props = $props();
  const KEYS = [":", ";", "[", "]", "{", "}", "(", ")", "`", "\"", "+", "-", "*", "%", "#", "_", ",", "!", "?", "@", "$", "&", "|", "^", "~", "'", "/", "\\", "<", ">", "=", "."];
</script>

<div class="bar" class:flush role="toolbar" aria-label="q symbols">
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
  .bar.flush {
    padding-bottom: 6px;
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
