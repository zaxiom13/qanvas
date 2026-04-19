#!/usr/bin/env node
// End-to-end smoke test for the local-q websocket protocol.
// Spawns q, opens a WebSocket, runs start/frame/stop and prints results.

import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5047; // use a different port so we don't collide with dev instances
const BOOT = resolve(ROOT, 'server/qanvas-boot.q');
const Q_BIN = process.env.QANVAS_Q_BIN || `${process.env.HOME}/.kx/bin/q`;

const q = spawn(Q_BIN, [BOOT, '-p', String(PORT)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, QHOME: process.env.QHOME || `${process.env.HOME}/.kx` },
});

let qReady = false;
q.stdout.on('data', (buf) => {
  const s = String(buf);
  process.stdout.write(`[q] ${s}`);
  if (s.includes('websocket handlers installed')) qReady = true;
});
q.stderr.on('data', (buf) => process.stderr.write(`[q:err] ${String(buf)}`));

function waitFor(cond, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const id = setInterval(() => {
      if (cond()) { clearInterval(id); resolve(); }
      else if (Date.now() - t0 > timeout) { clearInterval(id); reject(new Error('timeout')); }
    }, 40);
  });
}

(async () => {
  try {
    await waitFor(() => qReady);
    console.log('--> q ready, connecting ws://127.0.0.1:' + PORT);

    const ws = new WebSocket('ws://127.0.0.1:' + PORT);
    await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
    console.log('--> ws open');

    const pending = new Map();
    let nextId = 1;
    ws.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if ('evt' in msg) {
        console.log('   evt:', msg);
        return;
      }
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      p.resolve(msg);
    });

    function send(op, payload) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, op, payload }));
        setTimeout(() => { if (pending.delete(id)) reject(new Error('timeout on ' + op)); }, 3000);
      });
    }

    const startRes = await send('start', {
      runtimePath: 'local-q',
      files: [{
        name: 'sketch.q',
        content: 'setup:{`size`bg!(800 600;0)}\ndraw:{[s;f;i;c] background[0]; circle[([]p:enlist 100 200f;r:enlist 25f;fill:enlist 255)]; s}',
      }],
    });
    console.log('--> start ok:', JSON.stringify(startRes, null, 2));

    const frame1 = await send('frame', {
      frameInfo: { frameNum: 1, time: 16, dt: 16 },
      input: { mouse: null },
      canvas: { size: [800, 600] },
    });
    console.log('--> frame ok:', JSON.stringify(frame1, null, 2));

    const q1 = await send('query', { expression: '1+1' });
    console.log('--> query ok:', JSON.stringify(q1, null, 2));

    await send('stop', {});
    console.log('--> stop ok');

    ws.close();
    q.kill();
    process.exit(0);
  } catch (err) {
    console.error('SMOKE FAILED:', err);
    q.kill();
    process.exit(1);
  }
})();
