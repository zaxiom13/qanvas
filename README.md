# Qanvas

A p5.js-style creative coding environment where your sketches are written in
**q/kdb+**. Runs three ways — pick the one you have:


| Backend     | q license?  | Network?  | What runs your code                                               |
| ----------- | ----------- | --------- | ----------------------------------------------------------------- |
| **Browser** | No          | No        | `[jqport](./packages/q-engine)` — a q interpreter in a Web Worker |
| **Local q** | Yes         | localhost | Your own `q` process over WebSocket (`server/q-bridge.js`)        |
| **Cloud q** | Server-side | Yes       | A hosted `q` (see `deploy/docker-cloud-q/`)                       |


All three backends speak the **same JSON-over-WebSocket protocol**, so a sketch
that runs in the browser runs unchanged against a licensed q or a cloud q —
you just get more speed, bigger data, and the full q stdlib.

Qanvas is tuned for array-heavy creative coding: heatmaps, particle systems,
tabular visualizations, and anything that benefits from q's vectorization.

---

## Quick start

### 1. Zero-install (browser-only, no q needed)

```bash
npm install
npm run dev:web        # http://127.0.0.1:4173
```

Or build a fully static site:

```bash
npm run static         # writes ./dist-static
npx http-server dist-static -p 8080
```

### 2. With your local q license

```bash
npm install
npm run dev:local-q    # starts the app + node WS bridge that spawns q
```

In the app's Settings → **Runtime**, pick *Local q (kdb+)* and point it at
`ws://127.0.0.1:5042` (the default). The bridge will boot
`[server/qanvas-boot.q](./server/qanvas-boot.q)` for you.

If you'd rather run q yourself (or on another port):

```bash
npm run q:direct       # q server/qanvas-boot.q -p 5042
```

### 3. Cloud q

See `[deploy/docker-cloud-q/README.md](./deploy/docker-cloud-q/README.md)` —
one `docker compose up` gets you `qanvas-boot.q` behind a WebSocket on a
public host. Then point Settings → Runtime → *Cloud q* at
`wss://your-host/ws`.

---

## Writing a sketch

Every sketch defines two functions:

```q
setup:{`size`bg!(800 600; 0)}

draw:{[state; frame; input; document]
  background 10;
  / vectorized — one call per 500 particles
  n:500;
  xs: 400 + 300 * sin frame % 30 + til n;
  ys: 300 + 200 * cos frame % 25 + til n;
  circle ([] p: xs ,' ys; r: n # 3f; fill: n # 255);
  state
 }
```

- `setup[]` returns config (`size`, `bg`, …) and the initial state.
- `draw[state;frame;input;document]` is called per frame; return the next state.
- Drawing primitives (`background`, `circle`, `rect`, `line`, `text`, `image`,
`pixel`, `generic`) append **tables** of commands — one row per primitive
— so you can paint thousands of shapes in a single vectorized call.

See `[examples/](./examples/)` for array-heatmap, table-bars, and a
QSQL-driven particle system.

---

## Architecture

```
┌────────────────────────────────────────────┐
│  app/  (Svelte 5 + Vite + Monaco)          │
│  ┌──────────────────────────────────────┐  │
│  │   window.browserAPI  (p5-style)      │  │
│  └───────────────┬──────────────────────┘  │
│                  │ QanvasRuntime            │
│        ┌─────────┼──────────────┐           │
│   browser        local-q       cloud-q      │
│   adapter        adapter       adapter      │
│     │              │              │         │
└─────┼──────────────┼──────────────┼─────────┘
      │              │              │
   Web Worker    WebSocket      WebSocket
   (jqport)         │              │
                 q-bridge.js   wss gateway
                    │              │
                    q              q
```

Packages:

- `app/` — Svelte UI, Monaco editor with q highlighting, runtime adapters.
- `packages/q-core`, `q-engine`, `q-language` — vendored
`[jqport](https://github.com/…)` for browser execution.
- `server/qanvas-boot.q` — q script implementing the protocol.
- `server/q-bridge.js` — Node WS server; optionally spawns q and proxies.
- `deploy/docker-cloud-q/` — Dockerized cloud deployment.
- `examples/` — starter sketches.

## Protocol (same across all three backends)

```
→ { id, op: "start",          payload: { files, entry } }
→ { id, op: "frame",          payload: { frame, input, document } }
→ { id, op: "query",          payload: { expr } }
→ { id, op: "start_commands", payload: {} }
→ { id, op: "stop" }

← { id, ok: true,  value: … }        // reply
← { id, ok: false, error: "…" }      // reply
← { evt: "hello"|"stdout"|"stderr"|"exit"|"info", … }
```

## Scripts

```bash
npm run dev           # app only (browser backend)
npm run dev:web       # same
npm run dev:local-q   # app + q bridge
npm run build         # build app
npm run static        # build zero-install static site
npm run q:serve       # node server/q-bridge.js
npm run q:direct      # q server/qanvas-boot.q -p 5042
```

## End-to-end test

```bash
node scripts/smoke-local-q.mjs
```

Boots q, opens a WebSocket, runs `start` → `frame` → `query` → `stop`.