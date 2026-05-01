<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { browserGateway } from '$lib/browser';
  import type { MobileShellTabPrep, UxTourStepDefinition } from '$lib/onboarding/ux-tour-steps';
  import { buildUxTourSteps } from '$lib/onboarding/ux-tour-steps';
  import { appState } from '$lib/state/app-state.svelte';

  type Props = {
    mobile?: boolean;
  };

  let { mobile = false }: Props = $props();

  let steps = $derived(buildUxTourSteps(appState.workspaceMode, mobile));
  let safeStepIndex = $derived.by(() =>
    Math.min(Math.max(appState.uxTourStepIndex, 0), Math.max(steps.length - 1, 0)),
  );

  let currentStep = $derived<UxTourStepDefinition | undefined>(steps[safeStepIndex]);
  let tooltipCard = $state<HTMLElement | null>(null);
  let tooltipStyle = $state('opacity:0; pointer-events:auto;');
  /** Fixed overlay “hole” so dimming is never eaten by ancestor stacking contexts */
  let spotlightFrameStyle = $state<string | null>(null);
  let tourBackdropMode = $state<'spotlight' | 'full'>('full');

  let highlightEl: HTMLElement | null = null;
  let pendingClickRemoval: (() => void) | null = null;
  let stepToken = 0;

  function dismissUiChrome() {
    try {
      const menuClose = Reflect.get(browserGateway.menu as object, 'closeAll') as (() => void) | undefined;
      menuClose?.();
    } catch {
      /* noop */
    }
  }

  function prepareMobileNavigation(tab?: MobileShellTabPrep) {
    if (!mobile || !tab) return;
    window.dispatchEvent(new CustomEvent<MobileShellTabPrep>('qanvas:mobile-tour-tab', { detail: tab }));
  }

  function clearHighlight(markupReset: boolean) {
    if (highlightEl) {
      highlightEl.classList.remove('ux-tour-highlight');
      highlightEl.removeAttribute('data-ux-tour-active');
      highlightEl = null;
    }
    if (markupReset) {
      document.documentElement.classList.remove('ux-tour-active');
    }
  }

  function clearClickAdvancer() {
    pendingClickRemoval?.();
    pendingClickRemoval = null;
  }

  function applyHighlight(el: HTMLElement | null) {
    clearHighlight(false);
    if (!el) {
      spotlightFrameStyle = null;
      tourBackdropMode = 'full';
      document.documentElement.classList.add('ux-tour-active');
      return false;
    }

    spotlightFrameStyle = null;
    tourBackdropMode = 'spotlight';
    document.documentElement.classList.add('ux-tour-active');
    el.classList.add('ux-tour-highlight');
    el.dataset.uxTourActive = 'true';
    highlightEl = el;
    return true;
  }

  const SPOTLIGHT_PAD = 4;

  function frameMetricsFromRect(r: DOMRect) {
    if (!Number.isFinite(r.width) || !Number.isFinite(r.height) || r.width <= 0 || r.height <= 0) {
      return null;
    }

    const top = Math.max(0, r.top - SPOTLIGHT_PAD);
    const left = Math.max(0, r.left - SPOTLIGHT_PAD);
    const width = Math.min(r.width + SPOTLIGHT_PAD * 2, typeof window !== 'undefined' ? window.innerWidth - left : r.width + SPOTLIGHT_PAD * 2);
    const height = Math.min(r.height + SPOTLIGHT_PAD * 2, typeof window !== 'undefined' ? window.innerHeight - top : r.height + SPOTLIGHT_PAD * 2);

    return { top: Math.round(top), left: Math.round(left), width: Math.round(width), height: Math.round(height) };
  }

  function updateSpotlightAndTooltip(token: number) {
    requestAnimationFrame(() => {
      if (!tooltipCard || token !== stepToken) return;

      if (!highlightEl || tourBackdropMode !== 'spotlight') {
        spotlightFrameStyle = null;
        placeTooltip(null, tooltipCard);
        return;
      }

      const r = highlightEl.getBoundingClientRect();
      const metrics = frameMetricsFromRect(r);

      spotlightFrameStyle = metrics
        ? `top:${metrics.top}px;left:${metrics.left}px;width:${metrics.width}px;height:${metrics.height}px;`
        : null;

      placeTooltip(r.width > 0 && r.height > 0 ? r : null, tooltipCard);
    });
  }

  function placeTooltip(bounds: DOMRect | null, cardEl: HTMLElement) {
    const pad = mobile ? 10 : 18;
    const card = cardEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = pad;
    let left = (vw - card.width) / 2;

    if (bounds && bounds.height > 0 && bounds.width > 0) {
      top = bounds.bottom + 12;
      if (top + card.height > vh - pad) top = bounds.top - card.height - 12;
      if (top < pad) top = pad;
      const preferredLeft = bounds.left + bounds.width / 2 - card.width / 2;
      left = Math.min(Math.max(preferredLeft, pad), vw - card.width - pad);
    }

    tooltipStyle = `opacity:1; position:fixed; top:${Math.round(top)}px; left:${Math.round(left)}px; max-width:${Math.min(mobile ? 320 : 360, vw - 24)}px; z-index:12030; pointer-events:auto;`;
  }

  async function activateStep(step: UxTourStepDefinition, retryCount: number, token: number) {
    if (!appState.uxTourActive) return;

    dismissUiChrome();
    if (step.prepareTab) prepareMobileNavigation(step.prepareTab);

    await tick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    let targetEl: HTMLElement | null = step.target ? document.querySelector<HTMLElement>(step.target) : null;

    if (!targetEl && step.target && retryCount < 12) {
      applyHighlight(null);
      updateSpotlightAndTooltip(token);
      window.setTimeout(() => {
        if (!appState.uxTourActive || token !== stepToken) return;
        void activateStep(step, retryCount + 1, token);
      }, step.prepareTab ? 120 : 40);
      return;
    }

    if (token !== stepToken) return;

    clearClickAdvancer();
    applyHighlight(targetEl);

    if (step.advance === 'click-target' && targetEl) {
      const advanceHandler = (event: PointerEvent) => {
        if (!(event.target instanceof Element)) return;
        if (!targetEl?.contains(event.target)) return;
        targetEl.removeEventListener('pointerdown', advanceHandler, true);
        pendingClickRemoval = null;
        appState.advanceUxTourStep(steps.length);
      };
      targetEl.addEventListener('pointerdown', advanceHandler, { capture: true });
      pendingClickRemoval = () => targetEl.removeEventListener('pointerdown', advanceHandler, true);
    }

    updateSpotlightAndTooltip(token);
  }

  function refreshTooltipPosition() {
    if (!appState.uxTourActive || !tooltipCard || !currentStep) return;
    updateSpotlightAndTooltip(stepToken);
  }

  $effect(() => {
    const active = appState.uxTourActive;
    const idx = appState.uxTourStepIndex;
    void steps;

    if (!active || typeof document === 'undefined') {
      document.documentElement.classList.remove('ux-tour-pointer-lock');
      clearHighlight(true);
      clearClickAdvancer();
      spotlightFrameStyle = null;
      tourBackdropMode = 'full';
      tooltipStyle = 'opacity:0; pointer-events:none;';
      return;
    }

    document.documentElement.classList.add('ux-tour-pointer-lock');

    if (steps.length === 0) {
      appState.finishUxTour();
      return;
    }

    if (idx >= steps.length) {
      appState.finishUxTour();
      return;
    }

    stepToken++;
    clearClickAdvancer();

    const safeIndex = Math.max(0, Math.min(idx, steps.length - 1));
    const stepDefinition = steps[safeIndex];

    clearHighlight(true);
    void activateStep(stepDefinition, 0, stepToken);
  });

  $effect(() => {
    if (!appState.uxTourActive || !tooltipCard) return;

    const handler = () => refreshTooltipPosition();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  });

  $effect(() => {
    if (!appState.uxTourActive || !tooltipCard) return;
    void currentStep?.id;
    requestAnimationFrame(() => refreshTooltipPosition());
  });

  onDestroy(() => {
    clearClickAdvancer();
    clearHighlight(true);
    document.documentElement.classList.remove('ux-tour-pointer-lock');
  });
</script>

<svelte:window
  onkeydown={(event: KeyboardEvent) => {
    if (!appState.uxTourActive) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      appState.finishUxTour();
    }
    if (event.key === 'Enter') {
      const el = document.activeElement;
      if (el instanceof HTMLElement && el.closest('.ux-tour-card')) {
        return;
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.getAttribute?.('contenteditable')) {
        return;
      }
      event.preventDefault();
      appState.advanceUxTourStep(steps.length);
    }
  }}
/>

{#if appState.uxTourActive && currentStep}
  <div class="ux-tour-root" aria-hidden="false">
    {#if tourBackdropMode === 'full'}
      <div class="ux-tour-dimming ux-tour-dimming--full" aria-hidden="true"></div>
    {:else if spotlightFrameStyle}
      <div class="ux-tour-spotlight" style={spotlightFrameStyle} aria-hidden="true"></div>
    {:else}
      <div class="ux-tour-dimming ux-tour-dimming--full ux-tour-dimming--soft" aria-hidden="true"></div>
    {/if}
    <div
      bind:this={tooltipCard}
      class="ux-tour-card"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      style={tooltipStyle}
    >
      <p class="ux-tour-chip">
        Guided tour · {Math.min(appState.uxTourStepIndex + 1, steps.length)}/{steps.length}
      </p>
      <h3 class="ux-tour-title">{currentStep.title}</h3>
      <p class="ux-tour-copy">{currentStep.body}</p>
      {#if currentStep.advance === 'click-target'}
        <p class="ux-tour-hint">
          Highlighted control reacts on tap—pressing <kbd>Enter</kbd> or Next skips ahead if needed.
        </p>
      {/if}
      <div class="ux-tour-actions">
        <button class="btn-secondary ux-tour-skip" type="button" onclick={() => appState.finishUxTour()}>Exit tour</button>
        <button class="btn-primary ux-tour-next" type="button" onclick={() => appState.advanceUxTourStep(steps.length)}>
          {appState.uxTourStepIndex >= steps.length - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  </div>
{/if}
