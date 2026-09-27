<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { createPlayer } from "../qanvas/headless";

  // The hero is itself a q sketch.
  const SKETCH = `
n:520
i:til n
draw:{
  background 21 20 29;
  a:(i*2.39996)+time*0.25*1+i mod 3;
  r:18+0.52*i;
  d:dist[mouse;center];
  p:center+(r*cos a;r*sin a);
  ink hsb[0.55+(i%2600)+0.08*sin time;0.65;1];
  circle[p;1.2+2.2*0.5+0.5*sin (i%18)-2*time]
 }
`;

  let canvas: HTMLCanvasElement;
  let raf = 0;
  let mouse: [number, number] = [300, 300];

  onMount(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    };
    fit();
    const ctx = canvas.getContext("2d")!;
    const scale = () => Math.max(canvas.width, canvas.height) / 600;
    let player = createPlayer(SKETCH, ctx, scale());
    const ro = new ResizeObserver(() => {
      fit();
      player = createPlayer(SKETCH, ctx, scale());
    });
    ro.observe(canvas);
    const tickFn = () => {
      // centre the 600×600 sketch in a non-square canvas
      const s = scale();
      const ox = (canvas.width - 600 * s) / 2, oy = (canvas.height - 600 * s) / 2;
      player.step(mouse, ox, oy);
      if (!reduce) raf = requestAnimationFrame(tickFn);
    };
    tickFn();
    return () => ro.disconnect();
  });

  onDestroy(() => cancelAnimationFrame(raf));

  function move(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    const s = Math.max(r.width, r.height) / 600;
    mouse = [(e.clientX - r.left - (r.width - 600 * s) / 2) / s, (e.clientY - r.top - (r.height - 600 * s) / 2) / s];
  }
</script>

<canvas bind:this={canvas} onpointermove={move} aria-label="An animated q sketch: a golden-angle spiral of coloured dots"></canvas>

<style>
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
