---
title: Complex numbers
chapter: Pixels
blurb: A complex number is a point. Square it, add, repeat — and the Mandelbrot set appears.
---

q doesn't have complex numbers built in, so Qanvas adds a small namespace, `.cx`, written in q itself. The idea is beautifully simple: **a complex number is a point** `(re;im)`. A whole grid of them is rows of points — exactly like everything else we've drawn.

```q
z:3 4f
.cx.abs z
```

The size of 3+4i is 5 — Pythagoras. Multiplying complex numbers *rotates and scales*:

```q
.cx.mul[0 1f;0 1f]
```

That's *i* × *i* = -1.

```q
.cx.str .cx.mul[1 2f;3 4f]
```

## Rotation by multiplication

Multiplying by a complex number with length just over 1 turns a point and pushes it out a little. Do it over and over — with scan — and you trace a spiral:

```q sketch
w:.cx.polar[1.04;0.3]
z:flip 60 {.cx.mul[w;x]}\ 1 0f
background 20
ink hsb[til[61]%61;0.7;1]
circle[center+10*z;4]
```

## The Mandelbrot set

For every point `c` on a grid, start at `z = 0` and repeat `z = z² + c`. Some points fly off to infinity; others stay near zero forever. Colour each point by how long it survives:

```q sketch
w:240; h:240
c:(-2.2+2.8*(til[w*h] mod w)%w; -1.4+2.8*(til[w*h] div w)%h)
z:0*c
k:0*c 0
do[40; z:.cx.add[.cx.sq z;c]; k+:4>.cx.abs2 z]
heatmap[w cut sqrt k;`magma]
```

Every pixel iterates together: `.cx.sq z` squares 57,600 complex numbers at once, and `k+:4>.cx.abs2 z` counts, for every pixel, how many steps it has stayed close.

## Julia sets

Flip it around: fix `c`, and start `z` at each pixel. (Inside `draw` we call it `zs` — remember, `x`, `y` and `z` are reserved for a function's own arguments.) Every `c` gives a different shape — so let the mouse choose `c`:

```q sketch
w:150; h:150
z0:(-1.6+3.2*(til[w*h] mod w)%w; -1.6+3.2*(til[w*h] div w)%h)
draw:{
  c:(mouse%300)-1 1;
  zs:z0; k:0*z0 0;
  do[24; zs:.cx.add[.cx.sq zs;c]; k+:4>.cx.abs2 zs];
  heatmap[w cut k;`inferno]
 }
```

## Your turn

```q challenge
%% goal Draw the Julia set for c = -0.8 0.156 as a single still image.
w:160; h:160
z:(-1.6+3.2*(til[w*h] mod w)%w; -1.6+3.2*(til[w*h] div w)%h)
c:0 0f
k:0*z 0
do[30; z:.cx.add[.cx.sq z;c]; k+:4>.cx.abs2 z]
heatmap[w cut k;`inferno]
%% check c~-0.8 0.156 | Set c to -0.8 0.156.
%% check 1=drawn`heatmap | Draw it with heatmap.
%% hint Only one line needs to change.
%% solution
w:160; h:160
z:(-1.6+3.2*(til[w*h] mod w)%w; -1.6+3.2*(til[w*h] div w)%h)
c:-0.8 0.156
k:0*z 0
do[30; z:.cx.add[.cx.sq z;c]; k+:4>.cx.abs2 z]
heatmap[w cut k;`inferno]
```
