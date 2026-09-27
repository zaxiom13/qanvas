---
title: A neuron
chapter: Learning machines
blurb: The smallest learning machine — weights, a sum, a squash, and a nudge after every mistake.
---

A **neuron** takes some inputs, multiplies each by a **weight**, adds them up with a **bias**, and squashes the result into the range 0 to 1:

```q
sig:{1%1+exp neg x}
sig -5 0 5
```

`sig` — the *sigmoid* — turns any number into "how sure am I, from 0 to 1".

With two inputs, the neuron's guess for a point `x y` is `sig b+(w0*x)+w1*y`. For a whole matrix of points `X` — one row per point — that's a single `mmu`:

```q
X:(0 0f;0 1f;1 0f;1 1f)
w:2 -1f
X mmu w
```

`mmu` takes each row of `X`, multiplies it by the weights and adds up: four dot products in one go.

## Learning

Learning means nudging the weights so the error shrinks. For a sigmoid neuron the nudge is beautifully short:

- the error on each point: `e: guess - answer`
- the nudge: `w -: rate * (flip X) mmu e`

That's **gradient descent**. Let's teach a neuron to tell apart points on either side of a line. The background shows what the neuron believes; watch its boundary slide into place:

```q sketch
m:200
P:flip (m?1f;m?1f)
Y:"f"$(P[;1])>0.2+0.6*P[;0]
X:4*P-0.5
w:0 0f; b:0f
sig:{1%1+exp neg x}
g:0.025*grid[40;40]
G:4*(flip g)-0.5
draw:{
  do[3; e:((sig b+X mmu w)-Y)%m; w-:2*(flip X) mmu e; b-:2*sum e];
  heatmap[40 cut sig b+G mmu w;`ocean];
  ink (80+175*Y;110+0*Y;255-165*Y); pen 255; weight 1;
  circle[600*flip P;4]
 }
```

- `P` holds the points as rows of `x y` pairs (a 200×2 matrix), because `mmu` wants one row per point.
- `X:4*P-0.5` centres the inputs around zero — neurons learn much faster that way.
- `G` is every point of a 40×40 grid, so the background is the neuron's guess *everywhere*.

> **Why:** everything in this learning loop is whole-matrix maths. That's why array languages — and GPUs — are so good at machine learning.

## Your turn

```q challenge
%% goal Change the labels so the neuron learns a different line: points where y > 0.8-0.6*x get label 1.
m:200
P:flip (m?1f;m?1f)
Y:"f"$(P[;1])>0.2+0.6*P[;0]
X:4*P-0.5
w:0 0f; b:0f
sig:{1%1+exp neg x}
g:0.025*grid[40;40]
G:4*(flip g)-0.5
draw:{
  do[3; e:((sig b+X mmu w)-Y)%m; w-:2*(flip X) mmu e; b-:2*sum e];
  heatmap[40 cut sig b+G mmu w;`ocean];
  ink (80+175*Y;110+0*Y;255-165*Y); pen 255; weight 1;
  circle[600*flip P;4]
 }
%% check Y~"f"$(P[;1])>0.8-0.6*P[;0] | Label a point 1 when its y is bigger than 0.8-0.6*x.
%% hint Only the line that defines Y needs to change.
%% solution
m:200
P:flip (m?1f;m?1f)
Y:"f"$(P[;1])>0.8-0.6*P[;0]
X:4*P-0.5
w:0 0f; b:0f
sig:{1%1+exp neg x}
g:0.025*grid[40;40]
G:4*(flip g)-0.5
draw:{
  do[3; e:((sig b+X mmu w)-Y)%m; w-:2*(flip X) mmu e; b-:2*sum e];
  heatmap[40 cut sig b+G mmu w;`ocean];
  ink (80+175*Y;110+0*Y;255-165*Y); pen 255; weight 1;
  circle[600*flip P;4]
 }
```
