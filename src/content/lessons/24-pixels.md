---
title: Pictures from numbers
chapter: Pixels
blurb: A matrix of numbers is an image. Compute every pixel at once, like a shader.
---

`pixels m` paints a matrix onto the whole canvas. Each number is one pixel: 0 is black and 1 is white.

```q sketch
k:til[64]%63
pixels k*\:k
```

A gradient: each cell is its row fraction times its column fraction.

## Every pixel, one formula

Here's the trick shader artists use, done in q: build the x and y of every pixel as two matrices, then write **one formula** for all of them at once.

```q sketch
w:200
k:til[w]%w
gx:w#enlist k
gy:flip gx
d:sqrt ((gx-0.5)*gx-0.5)+(gy-0.5)*gy-0.5
pixels 0.5+0.5*sin 60*d
```

- `gx` is 200 copies of the row `0 … 1`: every pixel's x.
- `gy` is the same thing flipped: every pixel's y.
- `d` is every pixel's distance from the middle — 40,000 distances in one line.

`heatmap` adds colour, and you can use any formula you like:

```q sketch
w:200
k:til[w]%w
gx:w#enlist k
gy:flip gx
heatmap[sin (10*gx)+(8*gy)+sin 12*gx*gy;`plasma]
```

## Moving pictures

Put the formula in `draw` and add `time`, and the whole image flows — a classic "plasma" effect:

```q sketch
w:120
k:til[w]%w
gx:w#enlist k
gy:flip gx
draw:{
  v:sin (10*gx)+time;
  v+:sin 10*gy+time%2;
  v+:sin (12*gx+gy)+time;
  heatmap[v;`plasma]
 }
```

> **Heads up:** we call them `gx` and `gy`, not `x` and `y`, because inside `draw` the names `x`, `y` and `z` are reserved for a function's own arguments.

## Your turn

```q challenge
%% goal Make a 100×100 matrix where every value in row i is i%99 — a top-to-bottom gradient — and draw it with pixels.
m:100#enlist til[100]%99
pixels m
%% check {(100=count x) and x[50]~100#50%99} arg[`pixels;0] | Row 50 should be all 50%99 — each row should be one shade.
%% hint Multiply each row number by a row of ones: (til[100]%99)*\:100#1f
%% solution
m:(til[100]%99)*\:100#1f
pixels m
```
