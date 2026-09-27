---
title: Remembering things
chapter: Motion
blurb: Keep values from frame to frame — and turn one bouncing ball into a thousand.
---

`draw` runs from the top every frame. To remember something between frames — a position, a speed, a score — keep it in a **global**: a name defined outside `draw`.

```q sketch
px:0
draw:{
  background 20;
  px+:3;
  circle[(px mod 600;300);30]
 }
```

`px+:3` means "add 3 to `px` and keep the result". It works with any operator: `-:`, `*:`, `,:` and friends.

> **Why not call it x?** Inside `{ }`, the names `x`, `y` and `z` are special — they're the function's own arguments. A global called `x` can't be seen from inside a function that uses `x`.

> **Heads up:** inside a function, a plain `name:value` creates a brand-new **local** that's forgotten when the function ends. To change a global, use `+:` (or `-:`, `*:` …), or assign with a double colon: `name::value`.

## A bouncing ball

A ball needs a position and a velocity, and both are points — pairs of numbers:

```q sketch
p:300 150f
v:4 0f
draw:{
  background 20;
  v+:0 0.4;
  p+:v;
  if[p[1]>560; v[1]*:-0.9; p[1]:560];
  if[(p[0]<40)|p[0]>560; v[0]*:-1];
  ink `coral;
  circle[p;40]
 }
```

- `v+:0 0.4` is gravity: a little extra downward speed every frame.
- `p+:v` moves x and y together — the pair `v` is added to the pair `p`.
- `if[condition; …]` runs the statements after the condition only when it's true.

## A thousand balls

Here's the magic. Turn `p` and `v` into **rows** of points and the same ideas move a thousand balls. Each `if` becomes a `?[ ]`, because every ball decides for itself:

```q sketch
n:1000
p:(n?600f;n?300f)
v:(-3+n?6f;n#0f)
draw:{
  background 20;
  v[1]+:0.4;
  p+:v;
  hit:p[1]>590;
  v[1]:?[hit;-0.8*v 1;v 1];
  p[1]:?[hit;590f;p 1];
  v[0]:?[(p[0]<0)|p[0]>600;neg v 0;v 0];
  ink hsb[0.5+p[0]%1800;0.6;1];
  circle[p;4]
 }
```

`hit` is a list of 1000 booleans. One line decides which balls bounce, the next makes them bounce.

## Your turn

The sketch below should grow a circle forever, but it throws an error. Run it, read the message, then fix it.

```q challenge
%% goal Keep a counter r that grows by 2 every frame, and draw a circle of radius r mod 250.
r:0
draw:{
  background 20;
  r:r+2;
  circle[center;r mod 250]
 }
%% check r>0 | r should keep growing — update the global with r+:2.
%% hint Inside draw, r:r+2 makes a brand-new local r — and it has no value yet when r+2 is worked out.
%% hint Use r+:2 to update the global.
%% solution
r:0
draw:{
  background 20;
  r+:2;
  ink `mint;
  circle[center;r mod 250]
 }
```
