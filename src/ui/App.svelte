<script lang="ts">
  import { onMount } from "svelte";
  import { app, type Tab } from "../lib/app.svelte";
  import Console from "./Console.svelte";
  import StudioView from "./StudioView.svelte";
  import LearnView from "./LearnView.svelte";
  import DojoView from "./DojoView.svelte";
  import RefView from "./RefView.svelte";
  import { BookOpen, Compass, Monitor, Moon, Palette, Sun, Target, Terminal, X } from "./icons";

  const mq = matchMedia("(max-width: 760px)");
  let mobile = $state(mq.matches);
  onMount(() => {
    const on = () => (mobile = mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  });

  const TABS: { id: Tab; label: string; icon: typeof Compass }[] = [
    { id: "learn", label: "Learn", icon: Compass },
    { id: "sketch", label: "Sketch", icon: Palette },
    { id: "dojo", label: "Dojo", icon: Target },
    { id: "ref", label: "Reference", icon: BookOpen },
  ];

  const tab = $derived(app.route.tab);
  const consoleDocked = $derived(tab === "sketch");

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

<div class="shell" class:mobile>
  <header class="top">
    <button class="logo" onclick={() => app.go("learn")} aria-label="Qanvas home">
      <img src="./icon.svg" alt="" width="26" height="26" />
      <span class="word"><b>q</b>anvas</span>
    </button>
    {#if !mobile}
      <nav class="tabs" aria-label="Main">
        {#each TABS as t (t.id)}
          <button class:on={tab === t.id} aria-current={tab === t.id ? "page" : undefined} onclick={() => app.goTab(t.id)}>
            <t.icon size={16} />{t.label}
          </button>
        {/each}
      </nav>
    {/if}
    <div class="right">
      {#if !consoleDocked || mobile}
        <button class="btn ghost sm" class:active={app.consoleOpen} onclick={() => (app.consoleOpen = !app.consoleOpen)} title="Console (Ctrl+`)">
          <Terminal size={16} />{#if !mobile}<span>Console</span>{/if}
        </button>
      {/if}
      <button class="btn ghost sm icon" onclick={cycleTheme} title={`Theme: ${app.theme}`} aria-label="Change theme">
        {#if app.theme === "system"}<Monitor size={16} />{:else if app.theme === "dark"}<Moon size={16} />{:else}<Sun size={16} />{/if}
      </button>
    </div>
  </header>

  <main>
    <StudioView active={tab === "sketch"} {mobile} />
    {#if tab === "learn"}
      <LearnView {mobile} />
    {:else if tab === "dojo"}
      <DojoView {mobile} />
    {:else if tab === "ref"}
      <RefView {mobile} />
    {/if}
  </main>

  {#if mobile}
    <nav class="bottom" aria-label="Main">
      {#each TABS as t (t.id)}
        <button class:on={tab === t.id} aria-current={tab === t.id ? "page" : undefined} onclick={() => app.goTab(t.id)}>
          <t.icon size={21} />
          <span>{t.id === "ref" ? "Ref" : t.label}</span>
        </button>
      {/each}
    </nav>
  {/if}

  {#if app.consoleOpen && (!consoleDocked || mobile)}
    <div class="drawer" role="dialog" aria-label="Console">
      <button class="close btn ghost sm icon" onclick={() => (app.consoleOpen = false)} aria-label="Close console"><X size={16} /></button>
      <Console title="Console" autofocus />
    </div>
  {/if}
</div>

<style>
  /* viewport-fit=cover: keep content out of the notch and home indicator (landscape phones especially) */
  .shell {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .shell.mobile {
    padding-bottom: 0;
  }
  .top {
    height: var(--topbar-h);
    flex: none;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 10px 0 12px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    position: relative;
    z-index: 20;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: none;
    padding: 4px 6px 4px 2px;
    cursor: pointer;
    border-radius: 10px;
  }
  .word {
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
  }
  .word b {
    background: linear-gradient(135deg, var(--coral), #b86bff 55%, var(--accent));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .tabs {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 2px;
    padding: 3px;
    background: var(--surface-2);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 14px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--text-2);
    font-weight: 600;
    font-size: 13.5px;
    cursor: pointer;
    transition: background var(--dur) var(--ease), color var(--dur);
  }
  .tabs button:hover {
    color: var(--text);
  }
  .tabs button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .right {
    margin-left: auto;
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .right .active {
    background: var(--accent-soft);
    color: var(--accent);
  }
  main {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  main > :global(*) {
    flex: 1;
    min-height: 0;
  }
  .bottom {
    height: calc(var(--bottomnav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    flex: none;
    display: flex;
    background: var(--surface);
    border-top: 1px solid var(--line);
    z-index: 20;
  }
  .bottom button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: none;
    background: none;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    -webkit-tap-highlight-color: transparent;
  }
  .bottom button.on {
    color: var(--accent);
  }
  .drawer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: min(46vh, 460px);
    z-index: 50;
    border-top: 1px solid var(--line-strong);
    box-shadow: 0 -18px 50px -20px #0006;
    border-radius: 16px 16px 0 0;
    overflow: hidden;
    animation: up 240ms var(--ease);
  }
  .drawer {
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  .mobile .drawer {
    height: 62dvh;
    bottom: 0;
  }
  .close {
    position: absolute;
    top: 5px;
    right: 44px;
    z-index: 2;
  }
  @keyframes up {
    from { transform: translateY(100%); }
  }
</style>
