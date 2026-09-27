---
title: A network learns
chapter: Learning machines
blurb: Stack neurons into layers, and a network learns shapes no single neuron can — you'll see every weight.
---

One neuron can only draw a straight boundary. But what if the answer is a *circle* — points inside are 1, outside are 0? No straight line can do that.

The fix: a **hidden layer**. Several neurons each draw their own line; a final neuron combines their answers. Together they can carve out curves.

## The network

- Inputs: 2 numbers (x and y).
- Hidden layer: 8 neurons. Their weights are a 2×8 matrix `W1`.
- Output: 1 neuron, with 8 weights `W2`.

Running the network forwards is two matrix multiplies:

```q
sig:{1%1+exp neg x}
tanh:{-1+2*sig 2*x}
W1:(2 8)#0.5*til 16
W2:8#0.1
x:enlist 1 -1f
h:tanh x mmu W1
sig h mmu W2
```

`tanh` is the sigmoid's sibling: it squashes into -1…1, which helps hidden layers learn.

## Learning, backwards

To learn, the error flows **backwards** through the network — *backpropagation*. The output error tells us how to nudge `W2`; pushed back through `W2`, it tells each hidden neuron how wrong *it* was, and so how to nudge `W1`. In q that's four lines of matrix maths.

Here's everything together. Move your mouse over the canvas: the little diagram in the corner shows the network thinking about the point under your pointer. Each line is a weight — orange for positive, blue for negative, thicker for stronger — and each neuron lights up with its activation.

```q sketch
m:300
P:flip (m?1f;m?1f)
Y:"f"$0.06>sum each (P-\:0.5 0.5) xexp 2
X:4*P-0.5
H:8
W1:(2,H)#gauss 2*H
b1:H#0f
W2:0.5*gauss H
b2:0f
sig:{1%1+exp neg x}
tanh:{-1+2*sig 2*x}
fwd:{[x] h:tanh b1+/:x mmu W1; (h;sig b2+h mmu W2)}
train:{
  hy:fwd X; h:hy 0; yh:hy 1;
  d2:(yh-Y)%m;
  d1:(d2*\:W2)*1-h*h;
  W2-:2*(flip h) mmu d2; b2-:2*sum d2;
  W1-:2*(flip X) mmu d1; b1-:2*sum d1;
 }

/ where each neuron sits in the diagram
col:{[n;x0] (n#x0;505+(150%n)*(til n)-0.5*n-1)}
ni:col[2;440]; nh:col[H;505]; no:col[1;570]
ii:raze H#'til 2; jj:(2*H)#til H
links:{[a;b;w] pen (?[w>0;255;90];?[w>0;150;170];?[w>0;80;255]); weight 0.5+1.5*abs w; line[a;b]}

g:0.025*grid[40;40]
G:4*(flip g)-0.5
draw:{
  do[3; train[]];
  heatmap[40 cut last fwd G;`ocean];
  ink (80+175*Y;110+0*Y;255-165*Y); pen 255; weight 1;
  circle[600*flip P;4];
  x:4*(mouse%600)-0.5;
  hy:fwd enlist x;
  pen `none; ink 16 16 26 220; rect[415 415;175 175];
  links[ni[;ii];nh[;jj];raze W1];
  links[nh;no;W2];
  pen 255; weight 1;
  ink gray 255*0.5+0.125*x; circle[ni;7];
  ink gray 255*0.5+0.5*first hy 0; circle[nh;6];
  ink gray 255*first hy 1; circle[no;9]
 }
```

Take a moment with that `draw`: three training steps, a heatmap of what the network believes everywhere, the training points, and a live diagram of the whole network — and every one of those is a handful of array expressions.

> **Try it:** change `H:8` to `H:3` and watch the network struggle — three lines can't make a good circle. Try `H:16`.

## Your turn

```q challenge
%% goal Give the network 16 hidden neurons instead of 8.
m:300
P:flip (m?1f;m?1f)
Y:"f"$0.06>sum each (P-\:0.5 0.5) xexp 2
X:4*P-0.5
H:8
W1:(2,H)#gauss 2*H
b1:H#0f
W2:0.5*gauss H
b2:0f
sig:{1%1+exp neg x}
tanh:{-1+2*sig 2*x}
fwd:{[x] h:tanh b1+/:x mmu W1; (h;sig b2+h mmu W2)}
train:{hy:fwd X; h:hy 0; yh:hy 1; d2:(yh-Y)%m; d1:(d2*\:W2)*1-h*h; W2-:2*(flip h) mmu d2; b2-:2*sum d2; W1-:2*(flip X) mmu d1; b1-:2*sum d1}
g:0.025*grid[40;40]
G:4*(flip g)-0.5
draw:{do[3; train[]]; heatmap[40 cut last fwd G;`ocean]}
%% check 16=count W2 | The output neuron should have 16 weights.
%% check 2 16~count each (W1;first W1) | W1 should be a 2×16 matrix.
%% hint Everything else is built from H.
%% solution
m:300
P:flip (m?1f;m?1f)
Y:"f"$0.06>sum each (P-\:0.5 0.5) xexp 2
X:4*P-0.5
H:16
W1:(2,H)#gauss 2*H
b1:H#0f
W2:0.5*gauss H
b2:0f
sig:{1%1+exp neg x}
tanh:{-1+2*sig 2*x}
fwd:{[x] h:tanh b1+/:x mmu W1; (h;sig b2+h mmu W2)}
train:{hy:fwd X; h:hy 0; yh:hy 1; d2:(yh-Y)%m; d1:(d2*\:W2)*1-h*h; W2-:2*(flip h) mmu d2; b2-:2*sum d2; W1-:2*(flip X) mmu d1; b1-:2*sum d1}
g:0.025*grid[40;40]
G:4*(flip g)-0.5
draw:{do[3; train[]]; heatmap[40 cut last fwd G;`ocean]}
```
