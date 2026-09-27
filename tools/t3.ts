import "../test/dom-shims";
import { mockCtx } from "../test/helpers";
import { runHeadless } from "../src/qanvas/headless";
const code = String.raw`w:150; h:150
z0:(-1.6+3.2*(til[w*h] mod w)%w; -1.6+3.2*(til[w*h] div w)%h)
draw:{
  c:(mouse%300)-1 1;
  z:z0; k:0*z0 0;
  do[24; z:.cx.add[.cx.sq z;c]; k+:4>.cx.abs2 z];
  heatmap[w cut k;${"`"}inferno]
 }`;
const t0 = performance.now();
const r = runHeadless(code, { ctx: mockCtx().ctx, frames: 2, budgetMs: 10000, mouse: [0, 0] });
console.log(r.counts, JSON.stringify(r.session.evaluate("draw[]")), r.session.evaluate("type draw").text, r.error?.qname, r.error?.hint, ((performance.now() - t0) / 5).toFixed(1), "ms/frame");
