<script lang="ts">
  import {
    BROWSER_ENGINE_OPTIONS,
    runtimeBackendLabel,
    type BrowserEngineMode,
  } from '$lib/state/browser-engine-mode';

  type Props = {
    value: BrowserEngineMode;
    onchange: (mode: BrowserEngineMode) => void;
    compact?: boolean;
    activeBackend?: RuntimeBackend | null;
  };

  let { value, onchange, compact = false, activeBackend = null }: Props = $props();
</script>

<div class="browser-engine-picker" class:browser-engine-picker--compact={compact}>
  <div
    class="browser-engine-grid"
    class:browser-engine-grid--compact={compact}
    role="radiogroup"
    aria-label="Browser q engine"
  >
    {#each BROWSER_ENGINE_OPTIONS as option}
      <button
        type="button"
        class="browser-engine-card"
        class:selected={value === option.id}
        role="radio"
        aria-checked={value === option.id}
        onclick={() => onchange(option.id)}
      >
        <div class="browser-engine-title">{option.title}</div>
        <div class="browser-engine-sub">{option.subtitle}</div>
      </button>
    {/each}
  </div>
  {#if activeBackend}
    <p class="browser-engine-active">
      Last run used <strong>{runtimeBackendLabel(activeBackend)}</strong>.
    </p>
  {/if}
</div>

<style>
  .browser-engine-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .browser-engine-grid--compact {
    grid-template-columns: 1fr;
  }

  .browser-engine-card {
    text-align: left;
    background: #fff;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    padding: 0.75rem 0.875rem;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .browser-engine-card:hover {
    border-color: #c0c0c0;
  }

  .browser-engine-card.selected {
    border-color: #4f7fff;
    box-shadow: 0 0 0 2px rgba(79, 127, 255, 0.2);
  }

  .browser-engine-title {
    font-weight: 600;
    font-size: 0.95rem;
    margin-bottom: 2px;
  }

  .browser-engine-sub {
    font-size: 0.75rem;
    line-height: 1.35;
    opacity: 0.72;
  }

  .browser-engine-active {
    margin: 0.75rem 0 0;
    font-size: 0.8rem;
    opacity: 0.75;
  }
</style>
