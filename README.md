# Qanvas

A p5.js-style creative coding environment where your sketches are written in
**q/kdb+**. Runs three ways — pick the one you have:


| Backend     | q license?  | Network?  | What runs your code                                                          |
| ----------- | ----------- | --------- | ---------------------------------------------------------------------------- |
| **Browser** | No          | No        | **[jqport](./packages/q-engine)** — q interpreter in a Web Worker |
| **Local q** | Yes         | localhost | Your own `q` process over WebSocket (`server/q-bridge.js`)                   |
| **Cloud q** | Server-side | Yes       | A hosted `q` (see `deploy/docker-cloud-q/`)                                  |


All three backends speak the **same JSON-over-WebSocket protocol**, so a sketch
that runs in the browser runs unchanged against a licensed q or a cloud q —
you just get more speed, bigger data, and the full q stdlib.

Qanvas is tuned for array-heavy creative coding: heatmaps, particle systems,
tabular visualizations, and anything that benefits from q's vectorization.

---

## Requirements

- **Node.js** 20 or newer (recommended for Vite 7 and the workspace tooling).
- **npm** with workspaces (install from the repository root).
- **Local q** or **cloud q** paths above only when you use those backends; the browser backend needs no `q` binary.

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
[`server/qanvas-boot.q`](./server/qanvas-boot.q) for you.

If you'd rather run q yourself (or on another port):

```bash
npm run q:direct       # q server/qanvas-boot.q -p 5042
```

### 3. Cloud q

See [`deploy/docker-cloud-q/README.md`](./deploy/docker-cloud-q/README.md) —
one `docker compose up` gets you `qanvas-boot.q` behind a WebSocket on a
public host. Then point Settings → Runtime → *Cloud q* at
`wss://your-host/ws`.

---

## Writing a sketch

Every sketch defines two functions:

```q
setup:{`size`bg!(800 600; 0)}

draw:{[state;frameInfo;input;canvas]
  background[10];
  / vectorized — one call per 500 particles
  n:500;
  t:"f"$til n;
  f:frameInfo`frameNum;
  p:(400 300f) + flip(300 * sin (f mod 30)+t; 200 * cos (f mod 25)+t);
  circle[([]
    p:p;
    r:n#3f;
    fill:n#255
  )];
  state
 }
```

- `setup[]` returns config (`size`, `bg`, …) and the initial state.
- `draw[state;frameInfo;input;canvas]` is called per frame; return the next state.
- Drawing primitives (`background`, `circle`, `rect`, `line`, `text`, `image`,
`pixel`, `generic`) append **tables** of commands — one row per primitive
— so you can paint thousands of shapes in a single vectorized call. In the
examples, positions and velocities lean toward pair arrays like `p` and `v`
instead of separate `x`/`y` scalar columns.
- Qanvas provides color constants as dotted globals: `Color.BLUE`,
`Color.YELLOW`, `Color.CREAM`, `Color.INK`, and friends. They work anywhere a
24-bit color long is expected and autocomplete in the editor.

See [`examples/`](./examples/) for array-heatmap, table-bars, and a
QSQL-driven particle system. The jqport test suite loads those `.q` files each run (`npm test --workspace @qpad/engine`).

---

## Architecture

```
┌────────────────────────────────────────────┐
│  app/  (Svelte 5 + Vite + CodeMirror)      │
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

Monorepo packages:

- `app/` — Svelte UI, CodeMirror editor with q highlighting, runtime adapters. Optional **Capacitor** wrappers live under `app/ios/` and `app/android/` for native shells (`npm run mobile:ios` / `mobile:android` from `app/` after a build).
- `packages/q-core` (`@qpad/core`), `packages/q-engine` (`@qpad/engine`), `packages/q-language` (`@qpad/language`) — TypeScript jqport engine, shared core, and editor language support for browser execution.
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

Root `package.json`:

```bash
npm run dev           # app only (browser backend)
npm run dev:web       # same
npm run dev:local-q   # app + q bridge
npm run build         # build app
npm run preview       # same host/port as dev: 127.0.0.1:4173
npm run static        # build zero-install static site to ./dist-static
npm run typecheck     # Svelte/TS check for the app workspace
npm run q:serve       # node server/q-bridge.js
npm run q:direct      # q server/qanvas-boot.q -p 5042
```

App workspace (`app/`): `npm run test`, `npm run test:browser`, `npm run mobile:sync`, etc. See [`app/package.json`](./app/package.json).

## End-to-end test

```bash
node scripts/smoke-local-q.mjs
```

Boots q, opens a WebSocket, runs `start` → `frame` → `query` → `stop`. Override the q binary with `QANVAS_Q_BIN` if it is not at `$HOME/.kx/bin/q`.
