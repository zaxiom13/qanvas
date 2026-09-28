# Promo video and guide screenshots

Everything in [`docs/promo`](../../docs/promo) and [`docs/guide/img`](../../docs/guide/img) is generated from the real app by these scripts. Nothing is hand-edited, so after a UI change you can regenerate it all.

| File | Does |
| --- | --- |
| `capture.mjs` | Drives the app at phone size (390×844 @2x) with Playwright. The browser clock is faked and stepped one video frame (1/30 s) at a time, so the footage is smooth and deterministic whatever the machine. Each clip is a folder of JPEGs in `clips/`, plus an event log (keystrokes, taps, the Dojo success) in `clips/meta.json`. |
| `stills.mjs` | The screenshots for the guide (`node capture.mjs stills`). |
| `timeline.mjs` | The edit: scenes on a 120 BPM grid at 30 fps, so one beat is exactly 15 frames and every cut lands on a bar line. |
| `synth.mjs` | Music and sound effects, synthesized from scratch into `soundtrack.wav`: kick, clap, hats, bass, pads and a plucked arpeggio (Am–F–C–G), plus typing clicks, tap pops, whooshes on every cut, a riser into the drop and a chime for the Dojo check. The effects are placed from the capture event log, so they line up with what's on screen. |
| `stage.html` | The frame compositor: a 1080×1920 page with SVG/CSS animation (phone mockup, captions, logo, confetti) and a `render(frame)` function. |
| `render.mjs` | Calls `render(f)` for every frame, pipes the screenshots into ffmpeg with the soundtrack, and writes `docs/promo/qanvas-promo.mp4` and `poster.jpg`. |

## Run it

```bash
# in the repo root: build and serve the app
npm install && npm run build && npm run preview   # http://127.0.0.1:5173

# in another terminal
cd tools/promo
npm install
node capture.mjs          # ~3 min: all clips (or name some: node capture.mjs type dojo)
node capture.mjs stills   # guide screenshots -> docs/guide/img
node synth.mjs            # soundtrack.wav
node render.mjs           # ~4 min -> docs/promo/qanvas-promo.mp4
node render.mjs --stills 0,300,900   # quick look at single frames -> preview/
```

Set `QANVAS_URL` to capture from somewhere other than the local preview server.
