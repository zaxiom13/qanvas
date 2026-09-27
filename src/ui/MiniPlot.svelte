<script lang="ts">
  import { onMount } from "svelte";
  import { colormapLUT } from "../qanvas/color";

  interface Props {
    kind: "line" | "scatter" | "heat";
    data: Float64Array[];
  }
  let { kind, data }: Props = $props();
  let canvas: HTMLCanvasElement;

  function draw() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = kind === "heat" ? 140 : 240, H = kind === "heat" ? 140 : 64;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    const c = canvas.getContext("2d")!;
    c.scale(dpr, dpr);
    const accent = getComputedStyle(canvas).getPropertyValue("--accent").trim() || "#6b7bff";
    const pad = 6;
    const finite = (a: Float64Array) => Array.from(a).filter((v) => Number.isFinite(v));
    if (kind === "line") {
      const ys = data[0];
      const f = finite(ys);
      if (!f.length) return;
      let lo = Math.min(...f), hi = Math.max(...f);
      if (lo === hi) { lo -= 1; hi += 1; }
      c.strokeStyle = accent;
      c.lineWidth = 1.5;
      c.lineJoin = "round";
      c.beginPath();
      ys.forEach((v, i) => {
        const x = pad + (i / Math.max(1, ys.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
        if (i === 0 || !Number.isFinite(v)) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();
    } else if (kind === "scatter") {
      const [xs, ys] = data;
      const fx = finite(xs), fy = finite(ys);
      if (!fx.length || !fy.length) return;
      let x0 = Math.min(...fx), x1 = Math.max(...fx), y0 = Math.min(...fy), y1 = Math.max(...fy);
      if (x0 === x1) { x0 -= 1; x1 += 1; }
      if (y0 === y1) { y0 -= 1; y1 += 1; }
      // keep aspect ratio honest
      const sx = (W - pad * 2) / (x1 - x0), sy = (H - pad * 2) / (y1 - y0);
      const s = Math.min(sx, sy);
      const ox = (W - (x1 - x0) * s) / 2, oy = (H - (y1 - y0) * s) / 2;
      c.fillStyle = accent;
      const r = xs.length > 500 ? 1 : 2;
      for (let i = 0; i < xs.length; i++) {
        c.beginPath();
        c.arc(ox + (xs[i] - x0) * s, oy + (ys[i] - y0) * s, r, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      const h = data.length, w = data[0].length;
      let lo = Infinity, hi = -Infinity;
      for (const r of data) for (const v of r) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      const lut = colormapLUT("viridis");
      const img = new ImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = data[y][x];
        const k = Number.isFinite(v) && hi > lo ? Math.round(((v - lo) / (hi - lo)) * 255) * 3 : 0;
        const o = (y * w + x) * 4;
        img.data[o] = lut[k]; img.data[o + 1] = lut[k + 1]; img.data[o + 2] = lut[k + 2]; img.data[o + 3] = 255;
      }
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      off.getContext("2d")!.putImageData(img, 0, 0);
      c.imageSmoothingEnabled = false;
      const s = Math.min(W / w, H / h);
      c.drawImage(off, (W - w * s) / 2, (H - h * s) / 2, w * s, h * s);
    }
  }

  onMount(draw);
  $effect(() => {
    void data;
    void kind;
    draw();
  });
</script>

<canvas bind:this={canvas} class="mini" aria-hidden="true"></canvas>

<style>
  .mini {
    display: block;
    border-radius: 8px;
    background: var(--surface-2);
    border: 1px solid var(--line);
  }
</style>
