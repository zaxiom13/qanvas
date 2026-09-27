import "../test/dom-shims";
import { mockCtx } from "../test/helpers";
import { runHeadless } from "../src/qanvas/headless";
const code = String.raw`
m:300
P:flip (m?1f;m?1f)
Y:"f"$0.06>sum each (P-\:0.5 0.5) xexp 2
X:4*P-0.5
H:HH
W1:(2,H)#gauss 2*H
b1:H#0f
W2:0.5*gauss H
b2:0f
sig:{1%1+exp neg x}
tanh:{-1+2*sig 2*x}
fwd:{[x] h:tanh b1+/:x mmu W1; (h;sig b2+h mmu W2)}
lr:LR
train:{
  hy:fwd X; h:hy 0; yh:hy 1;
  d2:(yh-Y)%m;
  d1:(d2*\:W2)*1-h*h;
  W2-:lr*(flip h) mmu d2; b2-:lr*sum d2;
  W1-:lr*(flip X) mmu d1; b1-:lr*sum d1;
 }
acc:{avg Y=0.5<last fwd X}
`;
for (const [lr, hh] of [["1", "8"], ["2", "8"], ["4", "8"], ["2", "12"], ["4", "12"]]) {
  const r = runHeadless(code.replace("LR", lr).replace("HH", hh), { ctx: mockCtx().ctx, budgetMs: 60000 });
  if (r.error) {
    console.log(lr, "error", r.error.qname, r.error.hint);
    continue;
  }
  const s = r.session;
  s.deadline = 0;
  const t0 = performance.now();
  const accs: string[] = [];
  for (let i = 0; i < 8; i++) {
    s.run("do[50; train[]]");
    accs.push((s.run("acc[]") as any).v.toFixed(2));
  }
  console.log("lr", lr, "H", hh, "acc every 50 steps:", accs.join(" "), "ms/step", ((performance.now() - t0) / 400).toFixed(2));
}
