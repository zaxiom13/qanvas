<script lang="ts">
  import { onMount } from "svelte";
  import { app, type Tab } from "./state.svelte";
  import Console from "../ui/Console.svelte";
  import PlayView from "../features/play/PlayView.svelte";
  import StudioView from "../features/studio/StudioView.svelte";
  import LearnView from "../features/learn/LearnView.svelte";
  import DojoView from "../features/dojo/DojoView.svelte";
  import RefView from "../features/reference/RefView.svelte";
  import { BookOpen, Gamepad, Monitor, Moon, Palette, Route, Sun, Target, Terminal, X } from "../ui/icons";
  import { NARROW_QUERY, PHONE_LANDSCAPE_QUERY } from "./layout/viewport";
  import { installKeyHaptics } from "../ui/haptics";

  const narrowMq = matchMedia(NARROW_QUERY);
  const landMq = matchMedia(PHONE_LANDSCAPE_QUERY);
  let mobile = $state(narrowMq.matches);
  let phoneLand = $state(landMq.matches);
  onMount(() => {
    installKeyHaptics();
    const onNarrow = () => (mobile = narrowMq.matches);
    const onLand = () => (phoneLand = landMq.matches);
    narrowMq.addEventListener("change", onNarrow);
    landMq.addEventListener("change", onLand);
    return () => {
      narrowMq.removeEventListener("change", onNarrow);
      landMq.removeEventListener("change", onLand);
    };
  });

  const TABS: { id: Tab; label: string; short: string; icon: typeof Palette; tint: string }[] = [
    { id: "play", label: "Play", short: "Play", icon: Gamepad, tint: "var(--accent)" },
    { id: "learn", label: "Learn", short: "Learn", icon: Route, tint: "var(--go)" },
    { id: "sketch", label: "Make", short: "Make", icon: Palette, tint: "var(--cyan)" },
    { id: "dojo", label: "Practice", short: "Practice", icon: Target, tint: "var(--pink)" },
    { id: "ref", label: "Look up", short: "Look up", icon: BookOpen, tint: "var(--violet)" },
  ];

  const tab = $derived(app.route.tab);
  let studioVisited = $state(false);
  $effect(() => {
    if (tab === "sketch") studioVisited = true;
  });
  const dock = $derived(mobile && !phoneLand);
  const consoleDocked = $derived(tab === "sketch" && !mobile && !phoneLand);

  function cycleTheme() {
    app.setTheme(app.theme === "system" ? (app.dark ? "light" : "dark") : app.theme === "dark" ? "light" : "system");
  }

  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "`") {
      e.preventDefault();
      app.consoleOpen = !app.consoleOpen;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="shell" class:dockmode={dock} class:slim={phoneLand}>
  {#if !dock}
    <nav class="rail" aria-label="Main">
      <button class="logo" onclick={() => app.go("")} aria-label="Qanvas home">
        <img src="./icon.svg" alt="" width="34" height="34" />
      </button>
      <div class="keys">
        {#each TABS as t (t.id)}
          <button class:on={tab === t.id} style:--tint={t.tint} aria-current={tab === t.id ? "page" : undefined} onclick={() => app.goTab(t.id)} title={t.label}>
            <span class="ico"><t.icon size={21} strokeWidth={2.2} /></span>
            {#if !phoneLand}<span class="lbl">{t.label}</span>{/if}
          </button>
        {/each}
      </div>
      <div class="foot">
        {#if !consoleDocked}
          <button class:on={app.consoleOpen} onclick={() => (app.consoleOpen = !app.consoleOpen)} title="Console (Ctrl+`)" aria-label="Console" style:--tint="var(--go)">
            <span class="ico"><Terminal size={19} /></span>
          </button>
        {/if}
        <button onclick={cycleTheme} title={`Theme: ${app.theme}`} aria-label="Change theme" style:--tint="var(--text)">
          <span class="ico">{#if app.theme === "system"}<Monitor size={19} />{:else if app.theme === "dark"}<Moon size={19} />{:else}<Sun size={19} />{/if}</span>
        </button>
      </div>
    </nav>
  {/if}

  <main>
    {#if studioVisited}
      <StudioView active={tab === "sketch"} {mobile} {phoneLand} />
    {/if}
    {#if tab === "play"}
      <PlayView {mobile} onTheme={cycleTheme} />
    {:else if tab === "learn"}
      <LearnView {mobile} />
    {:else if tab === "dojo"}
      <DojoView {mobile} {phoneLand} />
    {:else if tab === "ref"}
      <RefView {mobile} />
    {/if}
  </main>

  {#if dock}
    <nav class="dock" aria-label="Main">
      {#each TABS as t (t.id)}
        <button class:on={tab === t.id} style:--tint={t.tint} aria-current={tab === t.id ? "page" : undefined} onclick={() => app.goTab(t.id)}>
          <span class="ico"><t.icon size={22} strokeWidth={2.2} /></span>
          <span class="lbl">{t.short}</span>
        </button>
      {/each}
    </nav>
  {/if}

  {#if app.consoleOpen && (!consoleDocked || mobile)}
    <div class="drawer" role="dialog" aria-label="Console">
      <button class="close btn sm icon" onclick={() => (app.consoleOpen = false)} aria-label="Close console"><X size={18} /></button>
      <Console title="Console" autofocus />
    </div>
  {/if}
</div>

<style>
  /* viewport-fit=cover: keep content out of the notch and home indicator */
  .shell {
    height: 100dvh;
    display: flex;
    overflow: hidden;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .shell.dockmode {
    flex-direction: column;
    padding-bottom: 0;
  }

  /* ---------- desktop rail ---------- */
  .rail {
    width: var(--rail-w);
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 0;
    background: var(--surface);
    border-right: 1px solid var(--line);
    z-index: 20;
  }
  .slim .rail {
    width: 60px;
    padding: 6px 0;
  }
  .logo {
    border: none;
    background: none;
    padding: 4px;
    margin-bottom: 10px;
    cursor: pointer;
    border-radius: 12px;
    transition: transform 160ms var(--ease-spring);
  }
  .logo:hover {
    transform: rotate(-8deg) scale(1.06);
  }
  .slim .logo {
    margin-bottom: 2px;
  }
  .keys,
  .foot {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }
  .foot {
    margin-top: auto;
  }
  .rail button:not(.logo) {
    width: 68px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 7px 0 6px;
    border: none;
    border-radius: 14px;
    background: transparent;
    color: var(--text-3);
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: color var(--dur), background var(--dur);
  }
  .slim .rail button:not(.logo) {
    width: 50px;
    padding: 4px 0;
  }
  .rail button:not(.logo):hover {
    color: var(--text);
  }
  .ico {
    display: grid;
    place-items: center;
    width: 46px;
    height: 36px;
    border-radius: 12px;
    transition: background var(--dur), color var(--dur), transform 120ms var(--ease-spring), box-shadow var(--dur);
  }
  .rail button:not(.logo):active .ico,
  .dock button:active .ico {
    transform: translateY(2px) scale(0.96);
  }
  .rail button.on,
  .dock button.on {
    color: var(--text);
  }
  .rail button.on .ico,
  .dock button.on .ico {
    background: var(--tint);
    color: var(--bg);
    box-shadow: 0 3px 0 color-mix(in srgb, var(--tint) 45%, #000), 0 0 22px -4px var(--tint);
  }

  main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  main > :global(*) {
    flex: 1;
    min-height: 0;
  }

  /* ---------- phone dock ---------- */
  .dock {
    height: calc(var(--dock-h) + env(safe-area-inset-bottom));
    padding: 4px 4px env(safe-area-inset-bottom);
    flex: none;
    display: flex;
    background: var(--surface);
    border-top: 1px solid var(--line);
    z-index: 20;
  }
  .dock button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: none;
    background: none;
    color: var(--text-3);
    font-size: 11.5px;
    font-weight: 600;
    touch-action: manipulation;
  }
  .dock .ico {
    width: 52px;
    height: 34px;
    border-radius: 12px;
  }

  .drawer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: min(46vh, 460px);
    z-index: 50;
    border-top: 1px solid var(--line-strong);
    box-shadow: 0 -18px 50px -20px #0008;
    border-radius: 20px 20px 0 0;
    overflow: hidden;
    animation: up 240ms var(--ease);
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .dockmode .drawer {
    height: 62dvh;
  }
  .close {
    position: absolute;
    top: 6px;
    right: 52px;
    z-index: 2;
  }
  @keyframes up {
    from { transform: translateY(100%); }
  }
</style>
