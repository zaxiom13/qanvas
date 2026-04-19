#!/usr/bin/env node
/**
 * Qanvas q-bridge.
 *
 * A tiny Node WS server that spawns the user's q process and bridges the Qanvas
 * JSON protocol over WebSocket.
 *
 * Use this when:
 *   - You don't want to expose q's own listener port (e.g. on Windows via WSL).
 *   - You want to multiplex sessions, add auth, or deploy q behind a reverse proxy.
 *
 * The client ALWAYS speaks the same protocol:
 *   C -> S: {id, op, payload}
 *   S -> C: {id, ok, value|error} | {evt, value}
 *
 * Internally this bridge forwards each JSON message to q verbatim over a framed
 * stdin/stdout link (it evaluates the q code `.qv.handle[0N!-25!msg]` through a
 * unix pipe). For simplicity and portability, this reference bridge relies on
 * q's native WebSocket instead — it just serves static files and proxies the
 * user's browser connection to q's own `-p` listener.
 *
 * So the actual runtime topology looks like:
 *
 *   browser ──ws──> Node (this file) ──ws──> q
 *
 * You can get away with connecting the browser directly to q (and skipping this
 * bridge entirely) when you're on the same machine. This bridge only matters
 * when you want a single unified HTTP entry point (for cloud deployment) or
 * browser-origin restrictions forbid a direct connection.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { existsSync, readFileSync, statSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

const PORT       = Number(process.env.QANVAS_BRIDGE_PORT || 5050);
const Q_PORT     = Number(process.env.QANVAS_Q_PORT || 5042);
const Q_BIN      = process.env.QANVAS_Q_BIN || 'q';
const Q_BOOT     = resolve(__dirname, 'qanvas-boot.q');
const SPAWN_Q    = process.env.QANVAS_SPAWN_Q !== 'false'; // set to 'false' to connect to an already-running q
const SERVE_DIST = process.env.QANVAS_SERVE_DIST !== 'false';
const DIST_DIR   = resolve(ROOT, 'app', 'dist');

function log(...args) {
  console.log('[q-bridge]', ...args);
}

// ---------- optionally spawn q ----------

let qProc = null;
if (SPAWN_Q) {
  log(`spawning: ${Q_BIN} ${Q_BOOT} -p ${Q_PORT}`);
  qProc = spawn(Q_BIN, [Q_BOOT, '-p', String(Q_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, QHOME: process.env.QHOME || `${process.env.HOME}/.kx` },
  });
  qProc.stdout.on('data', (buf) => process.stdout.write(`[q] ${buf}`));
  qProc.stderr.on('data', (buf) => process.stderr.write(`[q:err] ${buf}`));
  qProc.on('exit', (code) => {
    log(`q exited with code ${code}. Bridge will keep running but will not be able to serve requests.`);
    qProc = null;
  });
}

// ---------- static fileserver for built app ----------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

function safeJoin(root, urlPath) {
  const p = resolve(root, `.${urlPath}`);
  return p.startsWith(root) ? p : null;
}

const httpServer = createServer((req, res) => {
  if (!SERVE_DIST || !existsSync(DIST_DIR)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Qanvas q-bridge running. Build the app (`npm run build`) or use Vite dev server separately.\n');
    return;
  }
  const urlPath = req.url?.split('?')[0] || '/';
  let filePath = safeJoin(DIST_DIR, urlPath === '/' ? '/index.html' : urlPath);
  if (filePath && existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }
  if (!filePath || !existsSync(filePath)) {
    // SPA fallback
    filePath = resolve(DIST_DIR, 'index.html');
  }
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

// ---------- websocket bridge ----------

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (client) => {
  log('client connected');
  let upstream = null;
  let queue = [];
  let upstreamReady = false;

  const connectUpstream = () => {
    const url = `ws://127.0.0.1:${Q_PORT}`;
    upstream = new WebSocket(url);
    upstream.on('open', () => {
      log('upstream q connected');
      upstreamReady = true;
      for (const m of queue) upstream.send(m);
      queue = [];
    });
    upstream.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) client.send(String(data));
    });
    upstream.on('close', () => {
      log('upstream q closed');
      upstreamReady = false;
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ evt: 'exit', code: 0 }));
        client.close();
      }
    });
    upstream.on('error', (err) => {
      log('upstream error:', err.message);
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ evt: 'stderr', value: `bridge: ${err.message}` }));
      }
    });
  };

  connectUpstream();

  client.on('message', (data) => {
    const msg = String(data);
    if (upstreamReady && upstream) upstream.send(msg);
    else queue.push(msg);
  });
  client.on('close', () => {
    log('client disconnected');
    try { upstream?.close(); } catch { /* ignore */ }
  });
});

// ---------- start listening ----------

httpServer.listen(PORT, () => {
  log(`listening on http://127.0.0.1:${PORT}`);
  log(`websocket endpoint: ws://127.0.0.1:${PORT}/ws`);
  if (SPAWN_Q) log(`bridged to q on port ${Q_PORT}`);
  if (SERVE_DIST) log(`serving built app from ${DIST_DIR}`);
});

// ---------- graceful shutdown ----------

function shutdown() {
  log('shutting down');
  try { wss.close(); } catch { /* ignore */ }
  try { httpServer.close(); } catch { /* ignore */ }
  if (qProc) try { qProc.kill(); } catch { /* ignore */ }
  setTimeout(() => process.exit(0), 250).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
